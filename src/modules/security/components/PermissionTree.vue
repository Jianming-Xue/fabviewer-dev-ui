<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import FvTree, { type FvTreeNode, type FvTreeState } from '@/shared/components/FvTree.vue'
import type { FvFeature } from '@/shared/module'
import { getModules } from '@/modules/registry'

/**
 * 权限树（security 模块，2026-10-16 自 shared 迁入）：基于全局 FvTree 的适配器。
 * 经 `states` 下发展示态、`@toggle` 接管选择行为；v-model = 权限字符串清单（角色 permissions 同构）。
 *
 * 全局通配 `*`（2026-11-03 UI-2 联调定稿）：树顶第一级「全部」= `*`（后端管理员口径，如 ADMIN 角色）——
 * 清单含 `*` → 整树自动选中、保存只存 `["*"]` 不展开；明细模式勾齐全部模块（无任何 Deny）亦自动
 * 收敛为 `["*"]`——提交只发一个星（2026-11-03 三次定稿）；此时取消任一子项 = 「全部」**直接取消选中**
 * （空框，二次定稿：不呈被动选中半选态）：先把 `*` 展开为全树明细串（全 Function + 全精确 Control），
 * 再在明细上执行该取消（此后与原明细语义完全一致，不存在 `*` 与 Deny 的混合态）；
 * 取消「全部」本身 = 清空整树。
 *
 * 三态机（用户定稿 2026-10-16）：不选中 ⇄ 选中 ⇄ 被动选中——
 * - on（对号）= 自身显式授权：模块/功能 = 自身 Function 串；控件 = 精确 Control 串
 * - part（小方块）= 被动选中：任一祖先为 on 而自身无显式授权
 * - off = 无授权，或带 `Deny:` 排除串（祖先授权期间的显式取消，前端约定串、后端不关心格式；
 *   权限 store 同步做减法，见 app/stores/permission.ts）
 * 点击迁移：off→on、part→on、on→off（级联取消子级）；part→off（显式排除）。
 * 勾选父行级联：Function 串 + 子树带控件功能的 Control 通配串 + 清除子树 Deny。
 */
const props = withDefaults(defineProps<{ /** 查看态：透传 FvTree 只读 */ readonly?: boolean }>(), { readonly: false })

const list = defineModel<string[]>({ required: true })

const { t } = useI18n()

const FN = 'Function:'
const CTL = 'Control:'
const DENY = 'Deny:'

/** 功能 URL 是否放行：自身或祖先链任一命中 Function 串（原 shared/permission/treeModel，2026-10-16 并入） */
function functionState(list: string[], url: string, ancestors: string[] = []): boolean {
  const granted = new Set(list.filter((s) => s.startsWith(FN)).map((s) => s.slice(FN.length)))
  return [url, ...ancestors].some((u) => granted.has(u))
}

/** `*` 展开为全树明细串（UI-2：通配在场时取消子项的先行退场——全模块/功能 Function 串 + 全精确控件串，
 *  与旧版工具条全选产物同构）；此后该取消在明细上按原语义执行 */
function expandWildcard(current: string[]): string[] {
  const out = current.filter((s) => s !== '*')
  for (const m of meta.values()) {
    if (m.kind === 'module') out.push(`${FN}${m.url}`)
    else if (m.kind === 'feature' && m.url) out.push(`${FN}${m.url}`)
    else if (m.kind === 'control') out.push(`${CTL}${m.featureUrl}:${m.controlId}`)
  }
  return out
}

/** 勾/取消功能节点：开=落本级短串并清除子孙冗余；关=本级及子孙全清 */
function toggleFunction(list: string[], url: string, on: boolean): string[] {
  const others = list.filter(
    (s) => !(s.startsWith(FN) && (s === FN + url || s.slice(FN.length).startsWith(url + '/'))),
  )
  return on ? [...others, FN + url] : others
}

type Meta = {
  kind: 'all' | 'module' | 'feature' | 'control'
  url?: string
  moduleUrl?: string
  featureUrl?: string
  controlId?: string
  leafUrls: string[]
  controlUrls: string[]
  parentId?: string
  childIds: string[]
  /** 自身排除串 */
  denyKey: string
  /** 自身+子树排除串（级联取消用） */
  subtreeDenyKeys: string[]
}

const meta = new Map<string, Meta>()

function leafUrls(features: FvFeature[]): string[] {
  return features.flatMap((f) => (f.children?.length ? leafUrls(f.children) : f.url ? [f.url] : []))
}

function controlUrlsOf(features: FvFeature[]): string[] {
  return features.flatMap((f) =>
    f.children?.length ? controlUrlsOf(f.children) : f.controls?.length && f.url ? [f.url] : [],
  )
}

function buildFeatures(features: FvFeature[], moduleUrl: string, path: string, parentId: string): FvTreeNode[] {
  // 与旧权限树投影一致：无控件的叶子功能不入权限树（无受管控项可配）
  return features.filter((f) => f.children?.length || f.controls?.length).map((f, i) => {
    const childPath = `${path}/${i}`
    const id = `f:${f.id}`
    // 功能组（children 非空）的 controls 一律失效（用户定稿 2026-10-16）
    const controls = f.children?.length ? [] : f.controls ?? []
    const childNodes = [
      ...buildFeatures(f.children ?? [], moduleUrl, childPath, id),
      ...controls.map((c) => {
        const cid = `c:${f.url}:${c.id}`
        meta.set(cid, {
          kind: 'control',
          featureUrl: f.url,
          controlId: c.id,
          moduleUrl,
          leafUrls: [],
          controlUrls: [],
          parentId: id,
          childIds: [],
          denyKey: `${DENY}${f.url}:${c.id}`,
          subtreeDenyKeys: [`${DENY}${f.url}:${c.id}`],
        })
        return { id: cid, label: t(c.key) } satisfies FvTreeNode
      }),
    ]
    const selfDeny = `${DENY}${f.url ?? id}`
    meta.set(id, {
      kind: 'feature',
      url: f.url,
      moduleUrl,
      leafUrls: leafUrls(f.children ?? []),
      controlUrls: f.children?.length ? controlUrlsOf(f.children) : controls.length && f.url ? [f.url] : [],
      parentId,
      childIds: childNodes.map((c) => c.id),
      denyKey: selfDeny,
      subtreeDenyKeys: [selfDeny, ...childNodes.flatMap((c) => meta.get(c.id)?.subtreeDenyKeys ?? [])],
    })
    return { id, label: t(f.key), children: childNodes } satisfies FvTreeNode
  })
}

const nodes: FvTreeNode[] = getModules().map((m) => {
  const id = `m:${m.id}`
  const children = buildFeatures(m.features, m.url, '', id)
  const selfDeny = DENY + m.url
  meta.set(id, {
    kind: 'module',
    url: m.url,
    leafUrls: leafUrls(m.features),
    controlUrls: controlUrlsOf(m.features),
    childIds: children.map((c) => c.id),
    denyKey: selfDeny,
    subtreeDenyKeys: [selfDeny, ...children.flatMap((c) => meta.get(c.id)?.subtreeDenyKeys ?? [])],
  })
  // 模块行带注册表图标（实现层决定图标有无：功能/控件行不带）
  return { id, label: t(m.key), icon: m.icon, children } satisfies FvTreeNode
})

/** 「全部」节点（UI-2）：树顶第一级 = 全局通配 `*`；全部模块为其子集（带折叠箭头）——
 *  嵌套纯展示层级：模块 parentId 保持空、「全部」不进祖先链授权计算，也不参与 Deny 机制 */
const ALL_ID = 'perm:all'
const moduleIds = nodes.map((n) => n.id)
meta.set(ALL_ID, { kind: 'all', leafUrls: [], controlUrls: [], childIds: [], denyKey: '', subtreeDenyKeys: [] })
const rootNodes: FvTreeNode[] = [{ id: ALL_ID, label: t('security.roles.permAll'), children: nodes }]

/**
 * 同步工作副本：v-model 的 prop 回流是异步的，checkAll 等同步连发 toggle 时
 * 逐次读 list.value 会拿到旧值、后写覆盖前写——换算一律基于 work，写完同步回传 list。
 */
const work = ref<string[]>([...list.value])
watch(list, (v) => {
  if (v !== work.value) work.value = [...v]
})

/** 全选收敛（2026-11-03 三次定稿：提交时「全部」被选中 = 只提交一个星）：明细模式达到
 *  「全部模块选中且无任何 Deny」即视作「全部」选中，模型自动收敛为 ["*"] 单串——视觉不变
 *  （通配呈全选）、v-model/提交自然只发 `*`；immediate 令打开弹窗时对存量全明细数据同样收敛 */
watch(
  work,
  (v) => {
    if (
      v.length &&
      moduleIds.length > 0 &&
      !v.includes('*') &&
      !v.some((s) => s.startsWith(DENY)) &&
      moduleIds.every((id) => functionState(v, meta.get(id)!.url ?? ''))
    ) {
      work.value = ['*']
      list.value = ['*']
    }
  },
  { immediate: true },
)

/** 递归三态（memo 每轮 computed 重建）：任一祖先 on 而自身无显式授权 = 被动选中；
 *  `*` 在场 → 全部常规节点恒 on（取消子项时 `*` 已先行展开退场，故无混合态） */
const states = computed<Record<string, FvTreeState>>(() => {
  const memo = new Map<string, FvTreeState>()
  const has = (s: string) => work.value.includes(s)
  const wildcard = has('*')
  function anyAncestorOn(pid?: string): boolean {
    if (!pid) return false
    return nodeState(pid) === 'on' || anyAncestorOn(meta.get(pid)?.parentId)
  }
  function nodeState(id: string): FvTreeState {
    const hit = memo.get(id)
    if (hit) return hit
    const m = meta.get(id)!
    let st: FvTreeState
    if (m.kind === 'all') {
      // 「全部」聚合态（UI-2，2026-11-03 二次定稿）：二态呈现、不设半选——通配在场=on；
      // 否则仅当「无任何 Deny 且全部模块 on」呈 on，其余一律**直接取消选中**（空框）——
      // 通配在场时取消任一子项 → 明细+Deny 在场，「全部」直接退选为空框、不呈被动选中方块
      if (wildcard) st = 'on'
      else {
        const denied = work.value.some((s) => s.startsWith(DENY))
        st = !denied && moduleIds.every((mid) => nodeState(mid) === 'on') ? 'on' : 'off'
      }
    } else if (has(m.denyKey)) {
      st = 'off'
    } else if (wildcard) {
      st = 'on'
    } else if (m.kind === 'module') {
      // 操作只影响本级与下级：模块态只看自身授权，不随后代勾选变化
      st = functionState(work.value, m.url ?? '') ? 'on' : 'off'
    } else if (m.kind === 'feature') {
      const selfFn = !!m.url && functionState(work.value, m.url)
      st = selfFn ? 'on' : anyAncestorOn(m.parentId) ? 'part' : 'off'
    } else {
      const exact = has(`${CTL}${m.featureUrl}:${m.controlId}`)
      if (exact) st = 'on'
      else st = anyAncestorOn(m.parentId) ? 'part' : 'off'
    }
    memo.set(id, st)
    return st
  }
  const out: Record<string, FvTreeState> = {}
  for (const id of meta.keys()) out[id] = nodeState(id)
  return out
})

/** 功能级控件串整体置位：开=一条通配 Control:<url>；关=清通配与全部精确串 */
function setFeatureControls(current: string[], url: string, on: boolean): string[] {
  const rest = current.filter((s) => s !== CTL + url && !s.startsWith(`${CTL}${url}:`))
  return on ? [...rest, CTL + url] : rest
}

/** 勾选回抛：「全部」= 通配两极（选中存 `["*"]` / 取消清空）；其余——`*` 在场时取消任一子项
 *  先展开明细退场（「全部」自动退选，用户定稿 2026-11-03），再按原语义执行该取消；
 *  常规路径：父行级联 Function 串 + 子树控件通配 + 子树 Deny 清除/写入；控件行补/删精确串与 Deny */
function onToggle(id: string, on: boolean) {
  const m = meta.get(id)
  if (!m) return
  if (m.kind === 'all') {
    const next = on ? ['*'] : []
    work.value = next
    list.value = next
    return
  }
  let next = work.value.includes('*') && !on ? expandWildcard(work.value) : work.value
  if (m.kind === 'module' || m.kind === 'feature') {
    // 开=仅落本级串（子级经祖先链覆盖呈被动选中）；关=级联移除子树功能串
    // （模块组 URL 与功能路由 URL 分离后，路径前缀级联不再覆盖功能串，需显式移除）
    if (m.kind === 'module') {
      next = toggleFunction(next, m.url ?? '', on)
      if (!on) for (const url of m.leafUrls) next = toggleFunction(next, url, false)
    } else {
      if (m.url) next = toggleFunction(next, m.url, on)
      if (!on) for (const url of m.leafUrls) next = toggleFunction(next, url, false)
    }
    for (const url of m.controlUrls) next = setFeatureControls(next, url, on)
    next = on
      ? next.filter((s) => !m.subtreeDenyKeys.includes(s))
      : [...next.filter((s) => !m.subtreeDenyKeys.includes(s)), ...m.subtreeDenyKeys]
  } else {
    const exact = `${CTL}${m.featureUrl}:${m.controlId}`
    next = on
      ? [...next.filter((s) => s !== m.denyKey), ...(next.includes(exact) ? [] : [exact])]
      : [...next.filter((s) => s !== exact && s !== m.denyKey), m.denyKey]
  }
  work.value = next
  list.value = next
}

/** 一键全选/取消全选（工具条，UI-2 升级为通配两极）：选中 = 存 `["*"]`（与「全部」节点一致，
 *  不展开明细）；取消 = 清空清单（含 Deny） */
function onToggleAll(on: boolean) {
  const next = on ? ['*'] : []
  work.value = next
  list.value = next
}
</script>

<template>
  <FvTree
    :nodes="rootNodes"
    :states="states"
    :cascade="false"
    :readonly="props.readonly"
    @toggle="onToggle"
    @toggle-all="onToggleAll"
  >
    <template #label="{ node }">
      <!-- 模块行加粗体现层级（「全部」顶级行同款）；其余行字体颜色/字号统一（FvTree 定稿视觉） -->
      <span
        class="vui-perm-label"
        :class="{ 'vui-perm-label--module': node.id === 'perm:all' || node.id.startsWith('m:') }"
      >
        {{ node.label }}
      </span>
    </template>
  </FvTree>
</template>

<style scoped>
.vui-perm-label {
  font-size: 14px;
}

.vui-perm-label--module {
  font-weight: 600;
}
</style>
