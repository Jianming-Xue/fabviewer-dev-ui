<script setup lang="ts">
/**
 * 侧栏导航列表（Fv 族，2026-11-09 System Misc 首抽）：纯「左类目右内容」页的左侧单选列表——
 * items 由调用方拼好（含本地固定项，如 System Misc 的 "All" 恒首，模块5 · 02 §3.2），
 * v-model 为选中项 value；选中态 16px bold 主色 / 未选 14px 次要文字色，不显示条数。
 * 容器占满父高、内部滚动（滚动链归调用方 min-height:0）。
 * 分工边界：**不含勾选框/工具条**（勾选树用 FvTree）、**不是应用壳菜单**（壳菜单用 FvNavItem）。
 */
withDefaults(
  defineProps<{
    items: { label: string; value: string }[]
  }>(),
  {},
)

const model = defineModel<string>({ required: true })
</script>

<template>
  <nav class="fv-side-list">
    <button
      v-for="it in items"
      :key="it.value"
      type="button"
      class="fv-side-list__item"
      :class="{ 'fv-side-list__item--active': it.value === model }"
      @click="model = it.value"
    >
      {{ it.label }}
    </button>
  </nav>
</template>

<style scoped>
.fv-side-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  height: 100%;
  overflow-y: auto;
  padding: 6px;
}

.fv-side-list__item {
  flex: 0 0 auto;
  text-align: left;
  padding: 8px 12px;
  border: none;
  border-radius: var(--vui-radius-s);
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  line-height: 22px;
  color: var(--vui-text-secondary);
  transition: background-color 0.15s ease, color 0.15s ease;
}

.fv-side-list__item:hover {
  background: var(--vui-fill-alter);
}

.fv-side-list__item--active,
.fv-side-list__item--active:hover {
  background: var(--vui-primary-bg);
  color: var(--vui-primary);
  font-size: 16px;
  font-weight: 700;
}
</style>
