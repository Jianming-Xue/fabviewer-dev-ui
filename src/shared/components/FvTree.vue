<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useI18n } from 'vue-i18n'

import FvTreeList from './FvTreeList.vue'

/**
 * 全局树组件（shared，2026-10-16 自权限树拆出）：组合外框 = 树滚动区 + 横向虚线 +
 * 底部居中图标钮工具条（全选/取消全选/展开全部/折叠全部，固定显示不随树滚动）。
 * 行渲染与递归见内部 FvTreeList。
 *
 * 选择行为对外暴露：勾选经 `@toggle(id, on)` 回抛、主动选中集经 `v-model:checked`（节点 id
 * 清单）回流；**默认行为 = 选中本级，子级行被动选中**（cascade 派生，`:cascade="false"` 关闭）。
 * 三态机（用户定稿 2026-10-16）：不选中 ⇄ 选中  被动选中——
 *   不选中 → 选中 或 被动选中（被父级勾选覆盖）；被动选中 → 选中；选中 → 不选中（级联取消子级）；
 *   选中不可直接转被动选中。样式：选中=对号、被动选中=小方块、不选=空框。
 * 展示态默认由 checked 派生；业务语义独立的调用方可经 `states` 下发展示态覆盖派生。
 * 折叠展开：存在下一级的行在选择框**之前**显示折叠/展开钮（整行其余区域点击=勾选）；
 *   展开 = 展开当前层之下全部行，收起 = 隐藏整棵子树。
 * 一键动作：工具条内置；亦经 defineExpose 暴露 `expandAll()/collapseAll()/checkAll(on)`。
 * 视觉定稿：除折叠钮与可选行图标外行内无图标、选择框悬停不变色、label 紧贴选择框、行色统一。
 */
export interface FvTreeNode {
  id: string
  /** 默认 label 文案（可用 #label 插槽覆盖） */
  label?: string
  /** 行图标（FA 类名，置于文本之前；可选，由实现层决定是否下发） */
  icon?: string
  children?: FvTreeNode[]
}

export type FvTreeState = 'on' | 'off' | 'part'

const props = withDefaults(
  defineProps<{
    nodes: FvTreeNode[]
    /** 节点勾选态映射：提供时覆盖 checked 派生态（业务语义独立的调用方用） */
    states?: Record<string, FvTreeState>
    /** 默认选择行为：勾选级联（本级主动 + 子级被动）；关闭后由调用方经 v-model:checked 自行维护 */
    cascade?: boolean
    /** 只读查看态（2026-10-16）：选择框禁用、行点击不勾选、隐藏全选钮（折叠钮保留供浏览） */
    readonly?: boolean
  }>(),
  { states: undefined, cascade: true, readonly: false },
)

/** 主动选中集（节点 id） */
const checked = defineModel<string[]>('checked', { default: () => [] })

const emit = defineEmits<{
  toggle: [id: string, on: boolean]
  /** 一键全选/取消全选（checkAll）回抛；states 接管态的调用方据此整体落状态 */
  'toggle-all': [on: boolean]
}>()

defineSlots<{
  /** 客制节点 label（默认渲染 行图标+node.label） */
  label?(props: { node: FvTreeNode }): unknown
}>()

const { t } = useI18n()

/** 折叠态共享映射：根实例创建、递归下发（父层才能操作整棵子树） */
const collapseMap = reactive<Record<string, boolean>>({})

/** 显式排除集共享映射：默认模式下「祖先授权期间取消本级」的落点（被动→取消选中的唯一一致解） */
const deniedMap = reactive<Record<string, boolean>>({})

function branchIds(list: FvTreeNode[]): string[] {
  return list.flatMap((n) => (n.children?.length ? [n.id, ...branchIds(n.children as FvTreeNode[])] : []))
}

/** 一键展开/折叠：操作共享折叠映射的全部分支节点 */
function expandAll() {
  for (const id of branchIds(props.nodes)) collapseMap[id] = false
}

function collapseAll() {
  for (const id of branchIds(props.nodes)) collapseMap[id] = true
}

function allIds(list: FvTreeNode[]): string[] {
  return list.flatMap((n) => [n.id, ...(n.children?.length ? allIds(n.children as FvTreeNode[]) : [])])
}

/** 全选/取消全选（用户定稿 2026-10-16）：全部行转**主动选中**（非被动）；
    回抛 toggle-all 供 states 接管态整体落状态；默认模式全量写主动集并清排除集。
    defineModel 的 prop 回流异步，合批写防同循环旧值覆盖 */
function checkAll(on: boolean) {
  emit('toggle-all', on)
  if (!props.cascade) return
  if (on) for (const key of Object.keys(deniedMap)) delete deniedMap[key]
  checked.value = on ? allIds(props.nodes) : []
}

/** 全行展示态遍历（与 FvTreeList.stateOf 同规则）：states 优先；否则 排除→off、主动→on、被主动祖先覆盖→part */
function walkStates(list: FvTreeNode[], ancestorActive: boolean, out: FvTreeState[]): FvTreeState[] {
  const set = new Set(checked.value)
  for (const n of list) {
    let st: FvTreeState
    if (props.states) {
      st = props.states[n.id] ?? 'off'
    } else if (deniedMap[n.id]) {
      st = 'off'
    } else {
      st = set.has(n.id) ? 'on' : ancestorActive ? 'part' : 'off'
    }
    out.push(st)
    if (n.children?.length) walkStates(n.children as FvTreeNode[], ancestorActive || set.has(n.id), out)
  }
  return out
}

/**
 * 工具条两枚状态联动切换钮（用户定稿 2026-10-16）：图标呈现当前聚合态、点击在两极间切换，
 * 树内操作实时刷新按钮态。
 * 全选钮：全选中=对号、部分选中=方块、全不选=空框；点击 全选⇄取消全选。
 * 折叠钮：全展开=双下箭头、部分展开=双右箭头、全折叠=双上箭头；点击 全展开⇄全折叠。
 */
const checkState = computed<'on' | 'part' | 'off'>(() => {
  const sts = walkStates(props.nodes, false, [])
  const off = sts.filter((s) => s === 'off').length
  if (off === sts.length) return 'off'
  return off === 0 ? 'on' : 'part'
})
/* 全选钮图标（与树行勾选同款原始 glyph，仅主题色）：全选中=check-square、
   部分选中=空框+小实体方框（::after）、全不选=空框 */
const checkAllIcon = computed(() => (checkState.value === 'on' ? 'fas fa-check-square' : 'far fa-square'))
function onCheckAllToggle() {
  if (checkState.value === 'on') checkAll(false)
  else checkAll(true)
}

const collapseState = computed<'expanded' | 'part' | 'collapsed'>(() => {
  const ids = branchIds(props.nodes)
  if (!ids.length) return 'expanded'
  const collapsed = ids.filter((id) => collapseMap[id]).length
  return collapsed === 0 ? 'expanded' : collapsed === ids.length ? 'collapsed' : 'part'
})
/* 折叠钮图标（用户定稿 2026-10-16）：全展开=双下箭头、部分展开=双右箭头、全折叠=双上箭头 */
const collapseAllIcon = computed(() =>
  collapseState.value === 'expanded'
    ? 'fas fa-angles-down'
    : collapseState.value === 'part'
      ? 'fas fa-angles-right'
      : 'fas fa-angles-up',
)
function onCollapseToggle() {
  if (collapseState.value === 'expanded') collapseAll()
  else expandAll()
}

defineExpose({ expandAll, collapseAll, checkAll })
</script>

<template>
  <div class="fv-tree-box">
    <div class="fv-tree-box__scroll">
      <FvTreeList
        v-model:checked="checked"
        :nodes="nodes"
        :states="states"
        :cascade="cascade"
        :readonly="readonly"
        :collapse="collapseMap"
        :denied="deniedMap"
        @toggle="(id: string, on: boolean) => emit('toggle', id, on)"
      >
        <template #label="{ node }">
          <slot name="label" :node="node">{{ node.label }}</slot>
        </template>
      </FvTreeList>
    </div>
    <div class="fv-tree-box__divider" />
    <div class="fv-tree-box__actions">
      <!-- 只读态隐藏全选钮（折叠钮保留供浏览） -->
      <v-btn
        v-if="!readonly"
        icon
        variant="text"
        size="x-small"
        :class="`fv-tree-box__check--${checkState}`"
        :aria-label="checkState === 'on' ? t('common.unselectAll') : t('common.selectAll')"
        @click="onCheckAllToggle"
      >
        <v-icon :icon="checkAllIcon" size="16" />
      </v-btn>
      <v-btn
        icon
        variant="text"
        size="x-small"
        :aria-label="collapseState === 'expanded' ? t('common.collapseAll') : t('common.expandAll')"
        @click="onCollapseToggle"
      >
        <v-icon :icon="collapseAllIcon" size="15" />
      </v-btn>
    </div>
  </div>
</template>

<style scoped>
/* 组合外框：边框 + 圆角同输入控件档；树区内部滚动，工具条固定在外框底部 */
.fv-tree-box {
  display: flex;
  flex-direction: column;
  max-height: 460px;
  border: 1px solid var(--vui-border);
  border-radius: var(--vui-radius-s);
}

.fv-tree-box__scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 8px;
}

/* 树与工具条之间的横向虚线隔离 */
.fv-tree-box__divider {
  border-top: 1px dashed var(--vui-border);
}

.fv-tree-box__actions {
  flex: 0 0 auto;
  display: flex;
  justify-content: center;
  gap: 8px;
  padding: 4px 8px;
}

/* 工具条图标（全选钮三态 + 折叠钮）统一主题色（用户定稿 2026-10-16） */
.fv-tree-box__actions .v-icon {
  color: var(--vui-primary);
}

/* 全选钮部分选中态：框中心小实体方框（与框留白） */
.fv-tree-box__check--part .v-icon {
  position: relative;
}

.fv-tree-box__check--part .v-icon::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 6px;
  height: 6px;
  transform: translate(-50%, -50%);
  background: currentColor;
}
</style>
