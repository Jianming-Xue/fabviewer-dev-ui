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

/** 勾/取消功能节点：开=落本级短串并清除子孙冗余；关=本级及子孙全清 */
function toggleFunction(list: string[], url: string, on: boolean): string[] {
  const others = list.filter(
    (s) => !(s.startsWith(FN) && (s === FN + url || s.slice(FN.length).startsWith(url + '/'))),
  )
  return on ? [...others, FN + url] : others
}

type Meta = {
  kind: 'module' | 'feature' | 'control'
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

/**
 * 同步工作副本：v-model 的 prop 回流是异步的，checkAll 等同步连发 toggle 时
 * 逐次读 list.value 会拿到旧值、后写覆盖前写——换算一律基于 work，写完同步回传 list。
 */
const work = ref<string[]>([...list.value])
watch(list, (v) => {
  if (v !== work.value) work.value = [...v]
})

/** 递归三态（memo 每轮 computed 重建）：任一祖先 on 而自身无显式授权 = 被动选中 */
const states = computed<Record<string, FvTreeState>>(() => {
  const memo = new Map<string, FvTreeState>()
  const has = (s: string) => work.value.includes(s)
  function anyAncestorOn(pid?: string): boolean {
    if (!pid) return false
    return nodeState(pid) === 'on' || anyAncestorOn(meta.get(pid)?.parentId)
  }
  function nodeState(id: string): FvTreeState {
    const hit = memo.get(id)
    if (hit) return hit
    const m = meta.get(id)!
    let st: FvTreeState
    if (has(m.denyKey)) {
      st = 'off'
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

/** 勾选回抛：父行级联 Function 串 + 子树控件通配 + 子树 Deny 清除/写入；控件行补/删精确串与 Deny */
function onToggle(id: string, on: boolean) {
  const m = meta.get(id)
  if (!m) return
  let next = work.value
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

/** 一键全选/取消全选：全部节点落**自身授权串**（全 Function 串 + 全精确控件串）→ 全行主动选中；
    取消 = 清空清单（含 Deny）。不走父级级联，避免子级呈被动选中 */
function onToggleAll(on: boolean) {
  if (!on) {
    work.value = []
    list.value = []
    return
  }
  const out: string[] = []
  for (const m of meta.values()) {
    if (m.kind === 'module') out.push(`Function:${m.url}`)
    else if (m.kind === 'feature' && m.url) out.push(`Function:${m.url}`)
    else if (m.kind === 'control') out.push(`Control:${m.featureUrl}:${m.controlId}`)
  }
  work.value = out
  list.value = out
}
</script>

<template>
  <FvTree
    :nodes="nodes"
    :states="states"
    :cascade="false"
    :readonly="props.readonly"
    @toggle="onToggle"
    @toggle-all="onToggleAll"
  >
    <template #label="{ node }">
      <!-- 模块行加粗体现层级；其余行字体颜色/字号统一（FvTree 定稿视觉） -->
      <span class="vui-perm-label" :class="{ 'vui-perm-label--module': node.id.startsWith('m:') }">
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
