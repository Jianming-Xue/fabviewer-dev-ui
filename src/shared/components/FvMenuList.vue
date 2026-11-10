<script setup lang="ts">
/** v-menu 弹出锚向（Vuetify Anchor 字面量口径常用档；Anchor 类型包出口不通，本地声明子集） */
type MenuLocation =
  | 'bottom end'
  | 'bottom start'
  | 'bottom'
  | 'top end'
  | 'top start'
  | 'top'
  | 'end'
  | 'start'

/**
 * 全局下拉菜单列表（shared，2026-11-10 收敛批）：v-menu + 紧凑 v-list + v-list-item 三件组合的统一收口
 * （顶栏语言/用户菜单、FvTable more 菜单同款），禁止业务层裸拼三件套。
 * - items 声明菜单项；点击抛 `select(key)`；item.active 项自动挂勾选尾图标（语言菜单当前项口径）。
 * - 预设 location="bottom end" + v-list density=compact/py-1；minWidth 可调（150 默认档）。
 * - #activator 插槽转发 v-menu activator props（可与 v-tooltip 合并 activator，FvShell/FvTable 同款模式）。
 * - 受控开合经 v-model 透传 v-menu（modelValue 未声明、自动 fallthrough）。
 */
export interface FvMenuListItem {
  key: string
  label: string
  icon?: string
  color?: string
  disabled?: boolean
  /** 当前选中项：挂勾选尾图标 + active 底色 */
  active?: boolean
}

withDefaults(
  defineProps<{
    items: FvMenuListItem[]
    minWidth?: string | number
    location?: MenuLocation
  }>(),
  { minWidth: 150, location: 'bottom end' },
)

const emit = defineEmits<{ select: [key: string] }>()
</script>

<template>
  <v-menu :location="location">
    <template #activator="{ props: activatorProps }">
      <slot name="activator" :props="activatorProps" />
    </template>
    <v-list density="compact" class="py-1" :min-width="minWidth">
      <v-list-item
        v-for="it in items"
        :key="it.key"
        :title="it.label"
        :prepend-icon="it.icon"
        :color="it.color"
        :disabled="it.disabled"
        :active="it.active"
        @click="emit('select', it.key)"
      >
        <template v-if="it.active" #append>
          <v-icon icon="fas fa-check" size="14" />
        </template>
      </v-list-item>
    </v-list>
  </v-menu>
</template>
