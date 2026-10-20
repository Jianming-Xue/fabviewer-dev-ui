<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

interface Option {
  title: string
  value: string
}

/** 分页加载器：拉第 pageIndex 页（1 起），返回选项页 + 服务端总数 */
type PageLoader = (
  pageIndex: number,
  pageSize: number,
) => Promise<{ items: Option[]; totalSize: number }>

/**
 * 字段外观契约（2026-10-20 与 FvTextInput 同批定稿）：label / hint / showHint / required——
 * 底部 detail 行不展示 hint（tokens.css「字段错误气泡」段），hint 文案走 label 后问号图标
 * tooltip（showHint 开关控显隐）；required=true 时 label 前红星；校验错误由 detail 渲染、
 * 全局样式浮成控件右上角气泡。
 */
const props = withDefaults(
  defineProps<{
    /** 静态选项（字符串数组或 {title,value}）；传 pageLoader 时忽略 */
    items?: (string | Option)[]
    mode?: 'single' | 'multiple'
    prependIcon?: string
    /** 分页滚动加载（2026-10-19 定稿）：给出后 mount 拉第一页（pageSize 笔），
        菜单触底自动拉下一页，已加载数 ≥ totalSize 后不再请求 */
    pageLoader?: PageLoader
    pageSize?: number
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
    items: () => [],
    mode: 'single',
    prependIcon: undefined,
    pageLoader: undefined,
    pageSize: 10,
    label: undefined,
    hint: undefined,
    showHint: false,
    required: false,
  },
)

/** 是否接管 label 渲染（红星或问号任一需要即走自定义槽，否则保持 Vuetify 原生渲染） */
const customLabel = computed(() => props.required || (props.showHint && !!props.hint))

const model = defineModel<string | string[] | undefined>()
/** loaded=分页加载累计项（pageLoader 模式）；open=下拉被点开（调用方借机刷新选项数据，2026-10-20 加） */
const emit = defineEmits<{ loaded: [accumulated: Option[]]; open: [] }>()

const isMulti = computed(() => props.mode === 'multiple')

const normItems = computed<Option[]>(() =>
  props.pageLoader
    ? loaded.value
    : props.items.map((it) => (typeof it === 'object' ? it : { title: String(it), value: String(it) })),
)
const multiCount = computed(() => (Array.isArray(model.value) ? model.value.length : 0))

/* ===== 分页滚动加载 ===== */
const loaded = ref<Option[]>([])
const totalSize = ref(0)
const pageIndex = ref(0)
const busy = ref(false)
/** 已拉完（有成功页且累计数 ≥ totalSize） */
const exhausted = computed(
  () => props.pageLoader != null && pageIndex.value > 0 && loaded.value.length >= totalSize.value,
)

async function fetchPage(force = false): Promise<boolean> {
  if (!props.pageLoader || busy.value) return false
  if (!force && exhausted.value) return false
  busy.value = true
  let acc: Option[] | null = null
  try {
    const res = await props.pageLoader(pageIndex.value + 1, props.pageSize)
    pageIndex.value += 1
    totalSize.value = res.totalSize
    const seen = new Set(loaded.value.map((i) => i.value))
    for (const it of res.items) if (!seen.has(it.value)) loaded.value.push(it)
    acc = [...loaded.value]
  } catch {
    // 失败保持已有页；触底/调用方 loadAll 可重试（错误呈现归调用方 loader 内处理）
  } finally {
    busy.value = false
  }
  // busy 复位后才广播：监听器（如编辑弹窗回显解析）在 loaded 事件里同步调 loadAll 不会被 busy 拒
  if (acc) emit('loaded', acc)
  return acc !== null
}
/** 拉完剩余全部页（调用方需全量解析时用，如编辑弹窗名称→id 回显） */
async function loadAll() {
  let guard = 100
  while (!exhausted.value && guard-- > 0) {
    if (!(await fetchPage(true))) break
  }
}
defineExpose({ loadAll })

// mount 即拉第一页；pageLoader 定义期给出、运行期不切换
if (props.pageLoader) void fetchPage()
watch(
  () => props.pageLoader,
  (v, old) => {
    if (v && !old) void fetchPage()
  },
)

/* 触底监听：Vuetify 4 的 select 浮层内容（.v-select__content）常驻 DOM、关合仅隐藏——
   focus 后找可见者挂 scroll 监听（微任务重试至多 ~800ms 等浮层显示） */
let scrollHost: HTMLElement | null = null
let attachTimer: ReturnType<typeof setTimeout> | null = null
function onScroll(e: Event) {
  const el = e.target as HTMLElement
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) void fetchPage()
}
function detachScroll() {
  // 捕获阶段挂的必须按 capture 摘除（scroll 不冒泡，实际滚动元素可能是后代——捕获两相通吃）
  scrollHost?.removeEventListener('scroll', onScroll, { capture: true })
  scrollHost = null
}
function attachSoon(n = 0) {
  const el = [...document.querySelectorAll<HTMLElement>('.v-select__content')].find(
    (x) => x.getClientRects().length > 0,
  )
  if (el) {
    if (scrollHost !== el) {
      detachScroll()
      scrollHost = el
      el.addEventListener('scroll', onScroll, { passive: true, capture: true })
    }
    return
  }
  if (n < 10) attachTimer = setTimeout(() => attachSoon(n + 1), 80)
}
function onActivate() {
  if (props.pageLoader) attachSoon()
}
onBeforeUnmount(() => {
  if (attachTimer) clearTimeout(attachTimer)
  detachScroll()
})

function onSelect(v: string | string[] | null | undefined) {
  if (isMulti.value) {
    model.value = Array.isArray(v) ? v : []
    return
  }
  model.value = !v ? undefined : (v as string)
}
</script>

<template>
  <v-select
    :model-value="model"
    :items="normItems"
    item-title="title"
    item-value="value"
    :multiple="isMulti"
    :chips="isMulti"
    :closable-chips="isMulti"
    :clearable="!isMulti"
    :loading="busy"
    :label="label"
    :prepend-inner-icon="props.prependIcon"
    class="fv-text-select"
    v-bind="$attrs"
    @focus="onActivate"
    @click="emit('open')"
    @update:model-value="onSelect"
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
    <!-- 校验错误：右上角气球徽标（同 FvTextInput 口径，样式在 tokens.css 字段气泡段） -->
    <template #message="{ message }">
      <v-tooltip :text="message" content-class="vui-table-tip vui-field-err-tip">
        <template #activator="{ props: tipProps }">
          <span v-bind="tipProps" class="fv-field__err-badge"><v-icon size="12">fas fa-comment-dots</v-icon></span>
        </template>
      </v-tooltip>
    </template>
    <!-- 多选 chip 定制：首项显真实标签（关闭行为经 chip props 透传），第二位显 [+剩余数]，其余不渲染 -->
    <template v-if="isMulti" #chip="{ item, index, props: chipProps }">
      <v-chip v-if="index === 0" v-bind="chipProps" closable size="small" :text="item.title" />
      <span v-else-if="index === 1 && multiCount > 1" class="fv-text-select__overflow">[+{{ multiCount - 1 }}]</span>
    </template>
  </v-select>
</template>

<style scoped>
/* 溢出计数文本：弱化灰（同表格多值 [+N] 观感） */
.fv-text-select__overflow {
  font-size: 12px;
  color: var(--vui-text-secondary);
  white-space: nowrap;
}

/* chip 关闭图标与框内前缀图标同规（用户定稿 2026-10-19）：15px 同尺寸、currentColor 同色
   （Vuetify 4 字段图标即正文色，勿再压灰） */
.fv-text-select :deep(.v-chip__close),
.fv-text-select :deep(.v-chip__close .v-icon) {
  font-size: 15px;
  width: 15px;
  height: 15px;
}
</style>
