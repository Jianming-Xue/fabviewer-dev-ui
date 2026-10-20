<script setup lang="ts">
import { computed, reactive } from 'vue'

import FvCheckbox from '@/shared/components/FvCheckbox.vue'

import FvTreeList from './FvTreeList.vue'
import type { FvTreeNode, FvTreeState } from './FvTree.vue'

/**
 * FvTree 内部递归渲染器（不对外）：行 = 折叠钮 + 三态选择框 + 可选行图标 + label。
 * 主动选中集经 v-model:checked 与 FvTree 共享；展示态三态机、勾选迁移规则见 FvTree 文档。
 */
const props = withDefaults(
  defineProps<{
    nodes: FvTreeNode[]
    states?: Record<string, FvTreeState>
    cascade?: boolean
    depth?: number
    collapse?: Record<string, boolean>
    /** 显式排除集（递归内部使用：根实例创建、逐层下发） */
    denied?: Record<string, boolean>
    /** 只读查看态：选择框禁用、行点击不勾选 */
    readonly?: boolean
  }>(),
  { states: undefined, cascade: true, depth: 0, collapse: undefined, denied: undefined, readonly: false },
)

/** 与 FvTree 同名 checked 通道（具名 defineModel，勿省名字绑到 modelValue） */
const checked = defineModel<string[]>('checked', { default: () => [] })
const emit = defineEmits<{ toggle: [id: string, on: boolean] }>()

defineSlots<{
  label?(props: { node: FvTreeNode }): unknown
}>()

const collapseMap = props.collapse ?? reactive<Record<string, boolean>>({})
const deniedMap = props.denied ?? reactive<Record<string, boolean>>({})

const hasChildren = (n: FvTreeNode) => !!n.children?.length

function subtreeIds(n: FvTreeNode): string[] {
  return [n.id, ...(n.children ?? []).flatMap(subtreeIds)]
}

/** 祖先链映射（被动态派生用） */
const ancestors = computed(() => {
  const map = new Map<string, string[]>()
  const walk = (list: FvTreeNode[], chain: string[]) => {
    for (const n of list) {
      map.set(n.id, chain)
      if (n.children?.length) walk(n.children as FvTreeNode[], [...chain, n.id])
    }
  }
  walk(props.nodes, [])
  return map
})

/**
 * 展示态三态机（用户定稿 2026-10-16）：checked 存「主动选中」集；
 * on = 主动（对号）；part = 被动（小方块）：仅当被主动祖先覆盖——
 * **操作只影响本级与全部下级，不带动上一级**（有主动后代不改变本级展示）；
 * off = 不选中，或带显式排除（denied，祖先授权期间取消选中所得）。
 * states 下发时覆盖本派生（业务语义独立的适配器用）。
 */
function stateOf(n: FvTreeNode): FvTreeState {
  if (props.states) return props.states[n.id] ?? 'off'
  if (deniedMap[n.id]) return 'off'
  const set = new Set(checked.value)
  if (set.has(n.id)) return 'on'
  return (ancestors.value.get(n.id) ?? []).some((id) => set.has(id)) ? 'part' : 'off'
}

/** 勾选迁移：off/part→on（清除子树排除）、on→off（子树写入排除并移除主动态） */
function onCheck(n: FvTreeNode, on: boolean) {
  emit('toggle', n.id, on)
  if (!props.cascade) return
  const set = new Set(checked.value)
  if (on) {
    for (const id of subtreeIds(n)) delete deniedMap[id]
    set.add(n.id)
  } else {
    for (const id of subtreeIds(n)) {
      deniedMap[id] = true
      set.delete(id)
    }
  }
  checked.value = [...set]
}

/** 整行点击 = 选中/取消；折叠钮区域双重防御排除；只读态不勾选 */
function onRowClick(event: MouseEvent, n: FvTreeNode) {
  if (props.readonly) return
  if ((event.target as HTMLElement).closest('.fv-tree__expander')) return
  onCheck(n, stateOf(n) !== 'on')
}

function setCollapsed(n: FvTreeNode, value: boolean) {
  if (value) {
    collapseMap[n.id] = true
  } else {
    for (const id of subtreeIds(n)) collapseMap[id] = false
  }
}

const toggleCollapse = (n: FvTreeNode) => setCollapsed(n, !collapseMap[n.id])
</script>

<template>
  <div class="fv-tree">
    <div v-for="n in nodes" :key="n.id" class="fv-tree__node">
      <!-- 整行（除折叠钮外）点击 = 选中/取消；折叠钮自身 click.stop 只折叠 -->
      <div
        class="fv-tree__row"
        :style="{ paddingLeft: `${depth * 14}px` }"
        @click="onRowClick($event, n)"
      >
        <!-- 折叠/展开钮：仅有下一级的行显示，置于选择框之前；叶子行占位保持同级选择框对齐 -->
        <v-icon
          v-if="hasChildren(n)"
          class="fv-tree__expander"
          :icon="collapseMap[n.id] ? 'fas fa-chevron-right' : 'fas fa-chevron-down'"
          size="12"
          @click.stop="toggleCollapse(n)"
        />
        <span v-else class="fv-tree__expander fv-tree__expander--placeholder" />
        <!-- 三态样式（用户定稿 2026-10-16）：选中/不选 = Vuetify 原始 glyph 仅换主题色；
             被动选中 = 外框（far fa-square）+ 中心小实体方框（::after 心） -->
        <FvCheckbox
          icon-only
          :model-value="stateOf(n) === 'on'"
          :indeterminate="stateOf(n) === 'part'"
          indeterminate-icon="far fa-square"
          :disabled="readonly"
          @click.stop
          @update:model-value="(v: boolean) => onCheck(n, v)"
        />
        <v-icon v-if="n.icon" class="fv-tree__icon" :icon="n.icon" size="15" />
        <slot name="label" :node="n">
          <span class="fv-tree__label">{{ n.label }}</span>
        </slot>
      </div>
      <div v-if="hasChildren(n)" v-show="!collapseMap[n.id]" class="fv-tree__children">
        <!-- 递归：插槽逐层转发，toggle 逐层上抛，折叠态/主动集共享 -->
        <FvTreeList
          v-model:checked="checked"
          :nodes="n.children as FvTreeNode[]"
          :states="states"
          :cascade="cascade"
          :depth="depth + 1"
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
    </div>
  </div>
</template>

<style scoped>
.fv-tree__row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  cursor: pointer;
  user-select: none;
}

/* 折叠钮定宽（叶子行占位同宽保对齐）+ 主题色（用户定稿 2026-10-16） */
.fv-tree__expander {
  flex: 0 0 12px;
  width: 12px;
  color: var(--vui-primary);
}

/* 行选择框缩小（用户定稿 2026-10-16）：默认 24px 盒体在 32px 行内喧宾夺主，收到 16px 档 */
.fv-tree :deep(.v-selection-control) {
  min-height: 0;
}

.fv-tree :deep(.v-selection-control__wrapper) {
  width: 16px;
  height: 16px;
}

/* 选择框三态 glyph 统一主题色（用户定稿 2026-10-16） */
.fv-tree :deep(.v-selection-control__input .v-icon) {
  font-size: 16px;
  color: var(--vui-primary);
}

/* 被动选中：外层方框中心的小实体方框，与外框留约 4px 空白（16px 框 / 6px 心） */
.fv-tree :deep(.v-selection-control__input:has(> input[aria-checked="mixed"]) > .v-icon) {
  position: relative;
}

.fv-tree :deep(.v-selection-control__input:has(> input[aria-checked="mixed"]) > .v-icon)::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 6px;
  height: 6px;
  transform: translate(-50%, -50%);
  background: currentColor;
}

.fv-tree__icon {
  flex: 0 0 auto;
}

.fv-tree__label {
  font-size: 14px;
}

/* 选择框悬停不变色：已升为全局交互基线（tokens.css，2026-10-20 Checkbox 并入），本组件不再逐处压制 */

/* 选择框不占满剩余宽度（VSelectionControl 根默认伸展），label 紧贴选择框而非被推到行尾 */
.fv-tree :deep(.v-selection-control) {
  flex: 0 0 auto;
}
</style>
