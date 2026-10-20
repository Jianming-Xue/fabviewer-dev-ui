<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'

/**
 * 全局单行输入框（shared，2026-10-16 抽取；同日 type 收敛定稿）：
 * 沿用全局 outlined+compact 样式（36px、Label 在上），其余属性（label/rules/hint/
 * persistent-hint/readonly/hide-details/autocomplete……）经 attrs 透传给底层 VTextField/VTextarea。
 *
 * type 三态：
 * - text（默认）：单行文本。prependIcon/appendIcon 自定义前后图标。
 * - comment：备注形态——框高拉为控件标准高的 3 倍（108px），文本到边界自动软换行、从左上起编辑，
 *   且**拦截 Enter**——值永远是不含换行符的单行字符串，语义与单行输入完全一致。
 *   （浏览器硬约束：原生 input 无法换行，故 comment 形态借 textarea 作渲染内核，
 *   外观逐项对齐 text-field：字体、内边距、定高、去除 VTextarea 自带的 mask 渐隐遮罩。）
 * - password：密码形态——前后图标组件自带且托管：前缀 fa-lock，后缀 fa-eye/fa-eye-slash
 *   点击切换明文（内部状态，随组件卸载自动重置）；调用方无需再传图标与切换逻辑。
 *
 * 通用入参：
 * - clear = true：后置图标覆盖为清空图标（仅在有内容时显示，点击清空值）。
 *   仅 text 形态生效：comment 形态不渲染清空图标（保持与 text-field 视觉一致，
 *   2026-10-16 用户定稿）；password 形态后缀为明文切换，同样不适用。
 * - disabled = true：禁用态。原生 disabled 会禁止选字（无法复制），故用 readonly 模拟；
 *   置灰只作用于输入框本体的文字与边框，label 与 hint 保持原色，内容可选中复制。
 * - label / hint / showHint / required（2026-10-20 用户定稿）：底部 detail 行不再展示 hint
 *   （样式收口 tokens.css「字段错误气泡」段）——hint 文案改挂 label 后问号图标的 tooltip，
 *   showHint 开关控制图标显隐；required=true（规则含必填的字段由调用点标注）时 label 前红星；
 *   错误消息经 #message 槽渲染为右上角气球徽标（每错一枚，悬停出红字 tooltip）。
 */
const props = withDefaults(
  defineProps<{
    /** 输入形态：text 单行文本 / comment 备注（3 倍高软换行）/ password 密码（图标内置托管） */
    type?: 'text' | 'comment' | 'password'
    /** 前置图标（FA 类名）；password 形态缺省 fa-lock，显式传入可覆盖 */
    prependIcon?: string
    /** 后置图标（FA 类名）；clear=true 时被清空图标覆盖；password 形态为明文切换（不可覆盖） */
    appendIcon?: string
    /** 清空按钮：后置图标覆盖为清空图标，点击清空（禁用态下不显示） */
    clear?: boolean
    /** 禁用态：readonly 模拟（可选中复制），外观对齐原生 disabled */
    disabled?: boolean
    /** 字段 Label（顶部；红星/问号接管渲染时组件自绘，否则透传 Vuetify 原生） */
    label?: string
    /** 提示词文案（经问号图标 tooltip 展示，不再进底部 detail 行） */
    hint?: string
    /** 带提示词开关：true 且 hint 非空时 label 后显示问号图标，否则隐藏 */
    showHint?: boolean
    /** 必填标志（rules 含必填的字段由调用点标注）：label 前红星 */
    required?: boolean
  }>(),
  {
    type: 'text',
    prependIcon: undefined,
    appendIcon: undefined,
    clear: false,
    disabled: false,
    label: undefined,
    hint: undefined,
    showHint: false,
    required: false,
  },
)

/** 是否接管 label 渲染（红星或问号任一需要即走自定义槽，否则保持 Vuetify 原生渲染） */
const customLabel = computed(() => props.required || (props.showHint && !!props.hint))

/** Vuetify 的 clear 动作把 model 回写为 null——在组件边界归一为空串，
    否则 null 流进调用方的 rules（v.trim() 抛 TypeError 中断校验、红 hint 不显示）与提交载荷 */
const model = defineModel<string>({ set: (v) => v ?? '' })

/** 密码明文切换：组件内部状态（弹窗/卡片重挂载即重置） */
const pwdVisible = ref(false)

const isPwd = computed(() => props.type === 'password')
const effectivePrepend = computed(() => props.prependIcon ?? (isPwd.value ? 'fas fa-lock' : undefined))
const effectiveAppend = computed(() => {
  if (isPwd.value) return pwdVisible.value ? 'fas fa-eye' : 'fas fa-eye-slash'
  return props.clear ? undefined : props.appendIcon
})

/** comment 形态 Enter 键：拦截换行符写入，转为表单提交（与单行 input 的 Enter 语义一致） */
function onCommentEnter(event: KeyboardEvent) {
  event.preventDefault()
  const form = (event.target as HTMLElement).closest('form')
  if (form && typeof form.requestSubmit === 'function') form.requestSubmit()
}

const fieldRef = ref()

/** 点清空图标后 Vuetify 在同 tick 调 resetValidation（设计为「清空即重置校验」），
    必填红 hint 会被抹掉且不再触发——下一 tick 补一次 validate 恢复错误呈现 */
function onClearClick() {
  nextTick(() => {
    void fieldRef.value?.validate()
  })
}
</script>

<template>
  <v-textarea
    v-if="props.type === 'comment'"
    v-model="model"
    class="fv-text-input fv-text-input--comment"
    :class="{ 'fv-text-input--disabled': props.disabled }"
    :label="label"
    variant="outlined"
    density="compact"
    rows="1"
    no-resize
    :readonly="props.disabled"
    :aria-disabled="props.disabled || undefined"
    :indent-details="false"
    :prepend-inner-icon="effectivePrepend"
    :append-inner-icon="effectiveAppend"
    @keydown.enter="onCommentEnter"
    v-bind="$attrs"
  >
    <template v-if="customLabel" #label>
      <span v-if="props.required" class="fv-field__required-star">*</span>
      <span>{{ label }}</span>
      <v-tooltip v-if="props.showHint && props.hint" :text="props.hint" content-class="vui-table-tip">
        <template #activator="{ props: tipProps }">
          <span v-bind="tipProps" class="fv-field__hint-icon"><v-icon size="13">fas fa-circle-question</v-icon></span>
        </template>
      </v-tooltip>
    </template>
    <!-- 校验错误：右上角气球徽标（每条消息一枚，颜色/锚点配方在 tokens.css 字段气泡段），悬停出红字 tooltip -->
    <template #message="{ message }">
      <v-tooltip :text="message" content-class="vui-table-tip vui-field-err-tip">
        <template #activator="{ props: tipProps }">
          <span v-bind="tipProps" class="fv-field__err-badge"><v-icon size="12">fas fa-comment-dots</v-icon></span>
        </template>
      </v-tooltip>
    </template>
  </v-textarea>
  <v-text-field
    v-else
    ref="fieldRef"
    v-model="model"
    class="fv-text-input"
    :class="{ 'fv-text-input--disabled': props.disabled }"
    :label="label"
    :type="isPwd ? (pwdVisible ? 'text' : 'password') : 'text'"
    :readonly="props.disabled"
    :aria-disabled="props.disabled || undefined"
    :clearable="props.clear && !props.disabled && !isPwd"
    :indent-details="false"
    :prepend-inner-icon="effectivePrepend"
    :append-inner-icon="effectiveAppend"
    @click:append-inner="isPwd && (pwdVisible = !pwdVisible)"
    @click:clear="onClearClick"
    v-bind="$attrs"
  >
    <template v-if="customLabel" #label>
      <span v-if="props.required" class="fv-field__required-star">*</span>
      <span>{{ label }}</span>
      <v-tooltip v-if="props.showHint && props.hint" :text="props.hint" content-class="vui-table-tip">
        <template #activator="{ props: tipProps }">
          <span v-bind="tipProps" class="fv-field__hint-icon"><v-icon size="13">fas fa-circle-question</v-icon></span>
        </template>
      </v-tooltip>
    </template>
    <!-- 校验错误：右上角气球徽标（每条消息一枚，颜色/锚点配方在 tokens.css 字段气泡段），悬停出红字 tooltip -->
    <template #message="{ message }">
      <v-tooltip :text="message" content-class="vui-table-tip vui-field-err-tip">
        <template #activator="{ props: tipProps }">
          <span v-bind="tipProps" class="fv-field__err-badge"><v-icon size="12">fas fa-comment-dots</v-icon></span>
        </template>
      </v-tooltip>
    </template>
  </v-text-field>
</template>

<style scoped>
/* comment 形态：视觉与单行输入完全一致，仅定高拉为 3 倍（108px）+ 边界软换行、从左上起编辑。
   高度写死 36×3：不可用 var(--v-input-control-height)——VTextarea 在 .v-field 上有
   --v-textarea-control-height(40px) 与 --v-input-control-height 的互换机制，会让 calc 得 120px */
.fv-text-input--comment {
  --fv-comment-height: 108px;
}

.fv-text-input--comment :deep(.v-field) {
  height: var(--fv-comment-height);
  min-height: var(--fv-comment-height);
}

/* textarea 即 .v-field__input：
   - min-height:0 + height:100% + border-box 压掉 tokens 对 compact 的 36px 定高，撑满 108 框
   - 上内边距 8px ≈ 单行输入 36px 垂直居中的首行文字位（(36-21)/2≈7.5），首行观感一致；
     tokens 的 padding-block:0 !important 需同权重压制
   - VTextarea 自带 mask-image 渐隐（顶部淡入 + 右侧滚动条位淡出）——text-field 没有此效果，压掉 */
.fv-text-input--comment :deep(textarea.v-field__input) {
  min-height: 0;
  height: 100%;
  box-sizing: border-box;
  font-family: Arial, sans-serif; /* 对齐单行 input 的 UA 默认字体（textarea 默认等宽） */
  padding-block: 8px !important;
  overflow-y: auto;
  -webkit-mask-image: none;
  mask-image: none;
}

/* 禁用态（用户定稿 2026-10-16）：只灰「输入框本体」的文字与边框，label 与 hint 保持原色——
   不整块压 .v-field opacity（label 在 .v-field 内部会被连带）。
   文字取文字色 45% 混透明（同 FvSwitch 关态灰配方）；边框经 outline SVG 的 path 描边降透明 */
.fv-text-input--disabled :deep(input),
.fv-text-input--disabled :deep(textarea) {
  color: color-mix(in srgb, var(--vui-text) 45%, transparent);
}

/* v4 outlined 边框是 div border: currentColor（非 SVG path），改 outline 色即改边框色 */
.fv-text-input--disabled :deep(.v-field__outline) {
  color: color-mix(in srgb, var(--vui-text) 45%, transparent);
}
</style>
