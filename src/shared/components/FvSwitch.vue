<script setup lang="ts">
/**
 * 全局开关（shared，2026-10-15 Apple 风格定稿）：组件库开关 + 全局主题色。
 * 轨道更高更窄（20×34 胶囊）；滑块白色小圆、内嵌于轨道（与主题色分离，不再同色等高）——
 * 关 = 中性灰轨道，开 = 主题色轨道 + 白色滑块。v-model/loading 透传。
 * disabled（2026-10-16 定稿）= 锁定交互的禁用态：**保持原配色不置灰**（不走 Vuetify disabled
 * 的 opacity 灰化）——pointer-events 封锁 + tabindex 移除 + 模型更新守卫三重拦截。
 */
const props = withDefaults(defineProps<{ disabled?: boolean; loading?: boolean }>(), {
  disabled: false,
  loading: false,
})

const model = defineModel<boolean>({ required: true })

/** 禁用态吞掉更新（键盘/程序路径兜底；指针路径由 pointer-events 封锁）；
    Vuetify 开关更新值含 null（clearable 路径），归一为 boolean */
function onUpdate(v: boolean | null) {
  if (props.disabled) return
  model.value = !!v
}
</script>

<template>
  <v-switch
    :model-value="model"
    class="fv-switch"
    :class="{ 'fv-switch--locked': disabled }"
    color="primary"
    density="compact"
    hide-details
    :tabindex="disabled ? -1 : undefined"
    :aria-disabled="disabled || undefined"
    :loading="loading"
    @click.stop
    @update:model-value="onUpdate"
  />
</template>

<style scoped>
/* 禁用态：仅封锁指针交互，配色保持开/关原样（不置灰，用户定稿 2026-10-16） */
.fv-switch--locked {
  pointer-events: none;
}

/* Apple 风格尺寸：轨道 20px 高 × 34px 宽（默认 14×36 槽），滑块 14px 白色圆 */
.fv-switch {
  --v-switch-track-height: 20px;
  --v-switch-thumb-height: 14px;
  --v-switch-thumb-width: 14px;
  --v-selection-control-size: 34px; /* 输入槽随轨道收窄（默认 40px） */
}

:deep(.v-switch__track) {
  box-sizing: border-box; /* 默认 content-box：width 不含 padding（34+6=40 的差异来源） */
  width: 34px; /* 高宽比 ≈ 1.7（Apple 口径） */
  min-width: 34px;
  opacity: 1; /* 实色轨道（默认 0.6 发灰） */
  padding: 0 3px; /* 滑块与轨道端缘留隙（内嵌感） */
}

/* 关态轨道：默认 surface-variant 太淡——加深为文字色 45% 的中性灰（双主题都清晰可辨） */
:deep(.v-selection-control:not(.v-selection-control--dirty) .v-switch__track) {
  background-color: color-mix(in srgb, var(--vui-text) 45%, transparent);
}

/* 滑块颜色与主题色分离：恒为白色（iOS 口径），轨道负责状态色 */
:deep(.v-switch__thumb) {
  background-color: #fff !important;
  color: transparent !important;
}

/* 滑行距离按新轨道校准：34 − 14 − 2×3 = 14px 行程（±7），
   Vuetify 默认 ±10px 按 36px 轨道校准（在本轨道上滑块会贴边）；
   !important：对方规则带 .v-locale--is-ltr 前缀（4 类优先级）。
   注意不能用 .v-switch 前缀——scoped 编译后它要求本组件根为宿主后代，永不匹配 */
:deep(.v-selection-control__input) {
  transform: translateX(-7px) !important;
}

:deep(.v-selection-control--dirty .v-selection-control__input) {
  transform: translateX(7px) !important;
}
</style>
