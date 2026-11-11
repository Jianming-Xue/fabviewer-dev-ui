<script setup lang="ts">

import FvFieldErrorBadge from './FvFieldErrorBadge.vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type ComponentPublicInstance } from 'vue'
import { useI18n } from 'vue-i18n'
// 动态核必须显式持组件对象传 :is——autoImport 只认模板字面标签，字符串形态空渲染（实坑留档 d64a42a）
import { VAutocomplete, VCombobox } from 'vuetify/components'

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
 * 底部 detail 行不展示 hint（tokens.css「字段错误徽标」段），hint 文案走 label 后问号图标
 * tooltip（showHint 开关控显隐）；required=true 时 label 前红星；校验错误由 detail 渲染、
 * 全局样式浮成控件右上角角标。
 *
 * 可输入化换核（2026-11-05 用户定稿，同日三批修订 blur 口径）：控件一律可键入——
 * allowCreate=false（默认）走 VAutocomplete 核，键入文本对下拉项逐步过滤（大小写不敏感
 * 子串匹配），blur 丢弃键入文本（过滤文本本就不是值）；allowCreate=true 走 VCombobox 核，
 * **单选键入文本实时即字段值、blur 保留**（三批实报修订：原「只认 Enter、blur 丢弃」方案
 * 实测体验差——键入未选值被回滚成旧值，用户报障后废弃），Enter/点击创建行的作用=把值
 * **固化进下拉第一行并选中**（多选加 chip 且第一行勾选；多选键入文本 blur 由核内原生提交
 * 成 chip，同为保留语义）；中文 IME 选词 Enter 不触发创建。接口加载两类时机：第一类=点
 * 下拉按钮（@open，现状不变）；第二类=输入值从空到有值（@searchStart，调用方无参全量
 * 拉取、本地过滤），两类可并存（调用方自行去重）。完全清空规则（全局）：键入文本为空且
 * 无任何选中值 → 组件关下拉、清 created 项并发 @searchClear（调用方借机清上次候选）；
 * 还有选中值（多选剩 chips）一律不动。
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
    /** 多选模式框内最多展示的真实 chip 数，其余并入「[+剩余数]」（用户定稿 2026-10-21）；
     *  缺省 1 维持历史观感，调用方可调（如策略特殊字符集合用 4） */
    maxVisibleChips?: number
    /** 手输创建（2026-11-05 定稿，同日三批修订）：true=VCombobox 核——单选键入文本实时
     *  即值、blur 保留；Enter/点创建行把值固化进下拉第一行并选中（多选 blur 原生提交成
     *  chip）；false（默认）=VAutocomplete 核——键入仅过滤、blur 丢弃过滤文本 */
    allowCreate?: boolean
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
    maxVisibleChips: 1,
    allowCreate: false,
  },
)

/** 是否接管 label 渲染（红星或问号任一需要即走自定义槽，否则保持 Vuetify 原生渲染） */
const customLabel = computed(() => props.required || (props.showHint && !!props.hint))

const { t } = useI18n()
/** 核组件实例引用（单选选中后 blur 内部 input 用） */
const coreEl = ref<ComponentPublicInstance | null>(null)

const model = defineModel<string | string[] | undefined>()
const emit = defineEmits<{
  /** 分页加载累计项（pageLoader 模式） */
  loaded: [accumulated: Option[]]
  /** 下拉被点开（第一类加载时机：调用方借机刷新选项数据，2026-10-20 加） */
  open: []
  /** 键入文本从空到有值/聚焦后首次键入（第二类加载时机，2026-11-05 定稿）：
   *  调用方借此无参全量拉候选、本地过滤；与 open 可并存，去重归调用方 */
  searchStart: [text: string]
  /** 完全清空（键入文本为空且无选中值）：组件已关下拉并清 created 项，调用方借此清上次候选 */
  searchClear: []
}>()

const isMulti = computed(() => props.mode === 'multiple')

/** 动态核（2026-11-05 换核）：allowCreate ? VCombobox（Enter 创建） : VAutocomplete（键入过滤） */
const core = computed(() => (props.allowCreate ? VCombobox : VAutocomplete))
/** 受控菜单开关：完全清空时程序化关下拉（select 家族 menu prop 双向可控） */
const menuOpen = ref(false)

const normItems = computed<Option[]>(() =>
  props.pageLoader
    ? loaded.value
    : props.items.map((it) => (typeof it === 'object' ? it : { title: String(it), value: String(it) })),
)
const multiCount = computed(() => (Array.isArray(model.value) ? model.value.length : 0))

/* ===== allowCreate 创建项：Enter 提交/编辑回显的值插入下拉第一行（2026-11-05 定稿） ===== */
const created = ref<Option[]>([])
/** created 优先占位第一行；候选（items/pageLoader）后到同值项去重——编辑回显先插 created、
 *  @open 再拉回同值候选时不得重复出现（2026-11-05 实测坑） */
const allItems = computed<Option[]>(() => {
  if (!created.value.length) return normItems.value
  const createdValues = new Set(created.value.map((i) => i.value))
  return [...created.value, ...normItems.value.filter((i) => !createdValues.has(i.value))]
})
function ensureCreated(text: string) {
  const v = text.trim()
  if (!v || allItems.value.some((i) => i.value === v)) return
  created.value = [{ title: v, value: v }, ...created.value]
}
// 编辑态回显：初始值不在候选中也上第一行（弹窗每次打开重新 mount，覆盖外部预填场景）
onMounted(() => {
  // combobox 单选挂载时核内 _search 以 model title 初始化但不发 update:search——手动对齐镜像，
  // 否则「已有值上直接键入」首键无法补发 searchStart（编辑态候选拉取会漏）
  if (props.allowCreate && !isMulti.value && typeof model.value === 'string' && model.value) {
    searchText.value =
      allItems.value.find((i) => i.value === model.value)?.title ?? (model.value as string)
  }
  if (!props.allowCreate) return
  const vals = Array.isArray(model.value) ? model.value : model.value ? [model.value] : []
  for (const v of vals) ensureCreated(v)
})

/* ===== 键入会话跟踪（2026-11-05 三批改口径：blur 保留键入文本） =====
   原「只认 Enter」（blur 还原快照）方案实报废弃：单选 combobox 键入本就实时同步 model，
   键入文本即字段值，blur 不丢弃；Enter/点创建行的作用=把值固化进下拉第一行并选中。
   多选键入文本由核内 blur 原生提交成 chip（同为保留语义）。此处仅保留 search 镜像
   （创建行/完全清空判定用）与 searchStart 触发跟踪。 */
/** 核内 search 文本镜像（update:search 由 watch(_search) 预刷新发出，晚于同步的 input 事件） */
const searchText = ref('')
/** 本次聚焦已键入过（searchStart 每焦点会话至多补发一次，覆盖「已有值上直接键入」） */
let typedSinceFocus = false

function onSearchUpdate(s: string | null | undefined) {
  const text = s ?? ''
  const prev = searchText.value
  searchText.value = text
  // 第二类加载时机：空→非空（程序化回填选中项 title 也是非空变更，但仅 ''→非空 才发）
  if (!prev && text) emit('searchStart', text)
}

function onUserInput() {
  if (!typedSinceFocus) {
    typedSinceFocus = true
    // 焦点前已有显示文本（单选编辑态）：首键时镜像尚未更新，用旧文本补发（无参拉取，文本仅参考）
    if (searchText.value) emit('searchStart', searchText.value)
  }
}

function onFieldFocus() {
  typedSinceFocus = false
  onActivate()
}

let unmounted = false
function onEnterKey(e: KeyboardEvent) {
  // 中文 IME 选词 Enter 放行（isComposing/keyCode 229 双保险，同 Vuetify isComposingIgnoreKey 口径）
  if (!props.allowCreate || e.isComposing || e.keyCode === 229) return
  const text = searchText.value.trim()
  if (!text) return // 无键入文本（纯方向键选行）→ 内部 selectHighlighted 自理
  void nextTick(() => {
    // 内部 Enter 处理已定局：model 恰为键入文本才算自由文本提交
    //（方向键高亮行 Enter=内部选中高亮项、model≠键入文本 → 不固化；
    //  键入恰为已有候选=内部即选中现有项 → ensureCreated 去重不重复插）
    const committed = isMulti.value
      ? Array.isArray(model.value) && model.value.includes(text)
      : model.value === text
    if (!committed) return
    ensureCreated(text)
    if (!isMulti.value) blurSingleInput() // Enter 创建核内不发 item:added（同值跳过）——选中即离焦在此补
  })
}

/* ===== 完全清空（2026-11-05 用户定稿）：键入文本空 且 无选中值 → 关下拉+清 created+发
   searchClear；还有选中值（多选剩 chips/单选有值）一律不动 ===== */
let wasFullyEmpty = true // 初始即空不触发（无「上一次」可清）
function checkFullyEmpty() {
  void nextTick(() => {
    const modelEmpty = isMulti.value
      ? !Array.isArray(model.value) || model.value.length === 0
      : model.value == null || model.value === ''
    if (!modelEmpty || searchText.value) {
      wasFullyEmpty = false
      return
    }
    if (wasFullyEmpty) return
    wasFullyEmpty = true
    menuOpen.value = false
    created.value = []
    emit('searchClear')
  })
}
// 程序化变更（点选/点 X/删 chip）也走完全清空判定
watch(
  model,
  () => {
    checkFullyEmpty()
  },
  { immediate: true },
)

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
  // 换核后菜单容器 class 随核而异（select/autocomplete/combobox 三家），一并纳入
  const el = [
    ...document.querySelectorAll<HTMLElement>(
      '.v-select__content, .v-autocomplete__content, .v-combobox__content',
    ),
  ].find((x) => x.getClientRects().length > 0)
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
  unmounted = true
  if (attachTimer) clearTimeout(attachTimer)
  detachScroll()
})

/** 值归一：VCombobox 核默认 returnObject:true——点选已有 {title,value} 候选会 emit 原对象
 *  （自由文本 Enter 却 emit 字符串，2026-11-05 实测坑）；模板已显式 :return-object="false"，
 *  这里再兜底把任何对象形态归一成 value 字符串，保证消费方 model 契约恒为 string/string[] */
function normValue(x: unknown): string {
  return typeof x === 'object' && x !== null ? String((x as { value?: unknown }).value ?? '') : String(x)
}

function onSelect(v: string | string[] | null | undefined) {
  if (isMulti.value) {
    model.value = Array.isArray(v) ? v.map(normValue) : []
    return
  }
  model.value = !v ? undefined : normValue(v)
}

/** 单选选中即离焦（2026-11-05 用户定稿）：多选保持焦点便于连续选，不 blur。
 *  触发点有二：① item:added——点选/方向键 Enter 选已有项时核内 select() 发出（两核皆有）；
 *  ② Enter 创建路径不发 item:added——combobox 单选键入实时同步 model，selectFreeText 时
 *  old===new 同值被核内跳过——在 onEnterKey 的提交判定通过后显式补 blur。
 *  注意：点选路径 VMenu 离场过渡结束会把焦点修回输入框（实测 ~120ms 后 BODY→INPUT），
 *  blur 后短时看守、回焦即再 blur（真实用户重新聚焦时看守窗口早已结束，不会误伤） */
function blurSingleInput() {
  void nextTick(() => {
    const el = (coreEl.value?.$el as HTMLElement | undefined)?.querySelector<HTMLInputElement>(
      'input:not([type="hidden"])',
    )
    if (!el) return
    el.blur()
    const until = Date.now() + 400
    const iv = setInterval(() => {
      if (Date.now() > until || unmounted) {
        clearInterval(iv)
        return
      }
      if (document.activeElement === el) el.blur()
    }, 50)
  })
}
function onItemAdded() {
  if (isMulti.value) return
  blurSingleInput()
}

/* ===== 创建行（2026-11-05 用户定稿二批）：键入值不在下拉列表中时，第一行直接显示键入内容
   （prepend-item 槽，灰底），点击=Enter 同效（创建+选中+单选离焦关菜单）；精确匹配（按 value
   全等，同 ensureCreated 去重口径）存在时不显示——Enter/点选走原生选中现有项 ===== */
const createRowText = computed(() => {
  if (!props.allowCreate) return ''
  const text = searchText.value.trim()
  if (!text) return ''
  return allItems.value.some((i) => i.value === text) ? '' : text
})

function commitCreateFromRow() {
  const text = createRowText.value
  if (!text) return
  if (isMulti.value) {
    const arr = Array.isArray(model.value) ? [...model.value] : []
    if (!arr.includes(text)) arr.push(text)
    model.value = arr
    ensureCreated(text)
    // 清键入文本对齐 Enter 提交后状态（多选 search 与 model 解耦，写核暴露的 search 计算属性）
    const core = coreEl.value as unknown as { search?: string } | null
    if (core) core.search = ''
    return
  }
  model.value = text
  ensureCreated(text)
  blurSingleInput()
  // 对齐 Enter 单选提交后 closeOnSelect 关菜单——宏任务压轴：核内 watch(_search) 会在
  // 「isFocused && 菜单关」时回填 title 重开菜单（blur 事件未达时必现），最后关一次稳赢
  setTimeout(() => {
    if (!unmounted && !isMulti.value) menuOpen.value = false
  }, 0)
}
</script>

<template>
  <component
    :is="core"
    ref="coreEl"
    v-model:menu="menuOpen"
    :model-value="model"
    :items="allItems"
    item-title="title"
    item-value="value"
    :multiple="isMulti"
    :chips="isMulti"
    :closable-chips="isMulti"
    :clearable="!isMulti"
    :loading="busy"
    :label="label"
    :prepend-inner-icon="props.prependIcon"
    :trim-values="props.allowCreate || undefined"
    :return-object="false"
    :hide-no-data="false"
    class="fv-text-select"
    v-bind="$attrs"
    @focus="onFieldFocus"
    @click="emit('open')"
    @update:model-value="onSelect"
    @update:search="onSearchUpdate"
    @item:added="onItemAdded"
    @input="onUserInput"
    @keydown.enter="onEnterKey"
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
    <!-- 校验错误：右上角图标徽标（同 FvTextInput 口径，样式在 tokens.css 字段错误徽标段） -->
    <template #message="{ message }">
      <FvFieldErrorBadge :message="message" />
    </template>
    <!-- 多选 chip 定制：首项显真实标签（关闭行为经 chip props 透传），第二位显 [+剩余数]，其余不渲染 -->
    <template v-if="isMulti" #chip="{ item, index, props: chipProps }">
      <!-- 前 maxVisibleChips 枚显真实 chip，恰在下一位显 [+剩余数]（默认 1+1 与历史一致） -->
      <v-chip v-if="index < props.maxVisibleChips" v-bind="chipProps" closable size="small" :text="item.title" />
      <span v-else-if="index === props.maxVisibleChips && multiCount > props.maxVisibleChips" class="fv-text-select__overflow">[+{{ multiCount - props.maxVisibleChips }}]</span>
    </template>
    <!-- 创建行（2026-11-05 用户定稿二批）：键入值不在列表时第一行灰底显示键入内容，
         点击与 Enter 同效（创建+选中+单选离焦关菜单）；prepend-item 恒居过滤结果之上 -->
    <template v-if="props.allowCreate" #prepend-item>
      <div v-if="createRowText" class="fv-text-select__create-row" @mousedown.prevent @click="commitCreateFromRow">
        <span class="fv-text-select__create-text">{{ createRowText }}</span>
        <span class="fv-text-select__create-suffix">{{ t('common.selectCreateSuffix') }}</span>
      </div>
    </template>
    <!-- 无数据兜底：无键入文本（候选未加载/为空）时显通用空提示；有键入文本由创建行承载、不重复提示 -->
    <template v-if="props.allowCreate" #no-data>
      <div v-if="!searchText.trim()" class="fv-text-select__create-hint">{{ t('common.empty') }}</div>
    </template>
  </component>
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

/* 无匹配创建提示行（2026-11-05 用户定稿）：灰底弱化文本，与列表项同左右内边距节奏 */
.fv-text-select__create-hint {
  padding: 8px 16px;
  font-size: 13px;
  line-height: 18px;
  color: var(--vui-text-secondary);
  background: var(--vui-fill-alter);
}

/* 创建行（同日二批定稿）：键入值不在列表时居第一行，灰底示意可点击创建；
   键入文本正文色（hover 转主色反馈），后缀操作提示弱化右对齐 */
.fv-text-select__create-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 7px 16px;
  font-size: 13px;
  line-height: 20px;
  cursor: pointer;
  background: var(--vui-fill-alter);
}
.fv-text-select__create-text {
  color: var(--vui-text);
}
.fv-text-select__create-row:hover .fv-text-select__create-text {
  color: var(--vui-primary);
}
.fv-text-select__create-suffix {
  margin-left: auto;
  font-size: 12px;
  color: var(--vui-text-secondary);
  white-space: nowrap;
}
</style>
