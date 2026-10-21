<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * 全局日期时间输入（shared，2026-10-18 v2 定稿）：全系统日期/时间选择统一入口。
 * - 单一输入框分段呈现：年/月/日 与 时/分/秒 各自独立可选段，键盘直接输入、满位自动跳格、
 *   左右方向键换段；日期段分隔符 dateSep（默认横线 '-'，用户定稿 2026-10-18），时间段以 ':'，日期与时间之间空格；
 * - 点尾部图标弹面板：日历选日期 + 时/分/秒滚轮选时间（按模式取舍）；
 *   滚轮为自绘虚拟循环滚动（23 之后续 00，双向无限；定稿 2026-10-19），且与日历面板同宽；
 *   点击可视范围内任意行，滚轮自动滚动吸附到该行（轻点判定见 onPointerUp）；
 *   面板选择只进草稿，点面板下方「确认」才回显到输入框（用户定稿 2026-10-18）；
 *   开面板时段缺失即以面板当前显示值起稿（日历=今天、滚轮居中=00），不作任何选择直接确认
 *   也整体回显（用户定稿 2026-10-19）；未确认直接关面板 → 草稿丢弃不回显；
 *   确认钮可经 confirmDisabled 在定义处禁用；
 *   日历面板定稿（用户 2026-10-18）：无 Select date/Enter date 标题行（hide-header）、
 *   星期简写随语言（weekday-format short：英文三字母 Mon~Sun / 中文 周一~周日，Vuetify locale 随 i18n）、
 *   周日起始；标题栏=双箭头翻年+单箭头翻月+某年某月文字，与日期间横线分割（tokens.css 全局规则）；
 *   选中日期主题色标记；邻月补白日期显示为浅灰字、点击不选日期而是跳到该月（用户定稿 2026-10-19）；
 * - mode：'date' | 'time' | 'datetime'；precision：'second'（默认，时分秒）| 'minute'（时分，
 *   秒的输入段/滚轮列/model 秒位自动整体隐藏，用户定稿 2026-10-19）；
 * - model 一律后端规范串（'YYYY-MM-DD' / 'HH:mm:ss' 或 'HH:mm' / 拼接同上），'' = 未填完整/非法；
 * - 分段未齐或日期不合法（如 2026-02-31）：不发 model、行内红提示；
 * - 两位段（月/日/时/分/秒）唯一解时自动补全两位并跳格（如分输 '6' → '06'）；
 *   年不补零，离开时不足 4 位或越界 → 自动修正为当年；
 * - 尾部图标统一 fas fa-clock，颜色随字段文本色（与 FvTextInput 字段图标一致）；
 * - errorMessages（外部跨字段校验，与内部红提示同走右上角错误气泡、红描边）/ hint+showHint
 *   （2026-10-20 与 FvTextInput 统一：提示词经 label 后问号图标 tooltip，底部消息行废止）/
 *   clearable+clear 事件（清空全部段并通知父级联动默认值）——供检索表单等场景替换自建时间控件（2026-10-19）。
 * 表格展示变体 FvTimerCell 待验收后派生。
 */
type TimerMode = 'date' | 'time' | 'datetime'
type SegKey = 'y' | 'mo' | 'd' | 'h' | 'mi' | 's'
interface SegDef {
  key: SegKey
  len: number
  min: number
  max: number
  prompt: string
}

const props = withDefaults(
  defineProps<{
    modelValue?: string
    mode?: TimerMode
    /** 时间精度（用户定稿 2026-10-19）：'second'=时分秒 / 'minute'=时分（秒的输入段、滚轮列、model 秒位全部隐藏） */
    precision?: 'second' | 'minute'
    label?: string
    disabled?: boolean
    /** 日期段分隔符（用户定稿 2026-10-18：横线） */
    dateSep?: string
    /** 面板确认钮禁用（定义处传入；确认前草稿不回显，禁用即锁死面板选择入口） */
    confirmDisabled?: boolean
    /** 外部校验消息（跨字段规则由父级算好传入，如 MES 检索"结束须晚于开始"；与内部红提示合并显示） */
    errorMessages?: string | string[]
    /** 提示词文案（2026-10-20 改：经 label 后问号图标 tooltip 展示，不再占底部行——同 FvTextInput 口径） */
    hint?: string
    /** 带提示词开关：true 且 hint 非空时 label 后显示问号图标，否则隐藏 */
    showHint?: boolean
    /** 日期段被清空时，焦点离开控件框 → 该段自动填当天值并提交（2026-10-21 用户定稿，
     *  新增用户激活日期专用；默认关闭不影响 MES 检索等既有用法） */
    fillOnEmptyBlur?: boolean
    /** 显示清除钮（有内容时）；点击清空全部段并触发 clear 事件供父级联动默认值 */
    clearable?: boolean
  }>(),
  {
    modelValue: '',
    mode: 'datetime',
    precision: 'second',
    label: '',
    disabled: false,
    dateSep: '-',
    confirmDisabled: false,
    errorMessages: undefined,
    hint: '',
    showHint: false,
    fillOnEmptyBlur: false,
    clearable: false,
  },
)

const emit = defineEmits<{ 'update:modelValue': [v: string]; clear: [] }>()

const { t, locale } = useI18n()

/** 日历标题栏某年某月文字（用户定稿 2026-10-18）：中文=年+月（2026年10月），英文=月+年（Oct 2026） */
function calYearMonthText(monthText: string, yearText: string): string {
  return locale.value === 'zh-CN' ? `${yearText}${monthText}` : `${monthText} ${yearText}`
}

const DATE_SEGS: SegDef[] = [
  { key: 'y', len: 4, min: 1970, max: 9999, prompt: 'YYYY' },
  { key: 'mo', len: 2, min: 1, max: 12, prompt: 'MM' },
  { key: 'd', len: 2, min: 1, max: 31, prompt: 'DD' },
]
const TIME_SEGS: SegDef[] = [
  { key: 'h', len: 2, min: 0, max: 23, prompt: 'HH' },
  { key: 'mi', len: 2, min: 0, max: 59, prompt: 'mm' },
  { key: 's', len: 2, min: 0, max: 59, prompt: 'ss' },
]

const segs = reactive<Record<SegKey, string>>({ y: '', mo: '', d: '', h: '', mi: '', s: '' })
const error = ref('')
const menu = ref(false)
const focused = ref(false)
const boxEl = ref<HTMLElement>()
const inputEls = reactive<Partial<Record<SegKey, HTMLInputElement | null>>>({})

const wantDate = computed(() => props.mode !== 'time')
const wantTime = computed(() => props.mode !== 'date')
/** 是否显示/参与秒（precision='minute' 时秒段、秒轮、model 秒位整体隐藏） */
const showSeconds = computed(() => wantTime.value && props.precision !== 'minute')
const timeSegs = computed<SegDef[]>(() => (showSeconds.value ? TIME_SEGS : TIME_SEGS.slice(0, 2)))
const activeSegs = computed<SegDef[]>(() =>
  props.mode === 'date'
    ? DATE_SEGS
    : props.mode === 'time'
      ? timeSegs.value
      : [...DATE_SEGS, ...timeSegs.value],
)

/* 渲染序列：段与分隔符交替——同侧相邻段按各自分隔符（日期 dateSep / 时间 ':'），跨日期时间边界用空格 */
const items = computed<Array<{ type: 'seg'; def: SegDef } | { type: 'sep'; text: string }>>(() => {
  const out: Array<{ type: 'seg'; def: SegDef } | { type: 'sep'; text: string }> = []
  const seq = activeSegs.value
  const DATE_KEYS: SegKey[] = ['y', 'mo', 'd']
  const TIME_KEYS: SegKey[] = ['h', 'mi', 's']
  seq.forEach((def, i) => {
    out.push({ type: 'seg', def })
    const next = seq[i + 1]
    if (!next) return
    const bothDate = DATE_KEYS.includes(def.key) && DATE_KEYS.includes(next.key)
    const bothTime = TIME_KEYS.includes(def.key) && TIME_KEYS.includes(next.key)
    out.push({ type: 'sep', text: bothDate ? props.dateSep : bothTime ? ':' : ' ' })
  })
  return out
})

const pad = (n: number, len = 2) => String(n).padStart(len, '0')

/* ===== model ⇄ 段 ===== */
watch(
  () => props.modelValue,
  (v) => {
    const built = buildValue()
    if (v === built) return // 自己发出去的不回灌（打断打字）
    fillSegs(v ?? '')
    error.value = ''
  },
  { immediate: true },
)

function fillSegs(v: string) {
  const s = v.trim()
  // 日期必选+时间可选（'YYYY-MM-DD' 单独也回显——mode=date 的外部初值口径，2026-10-19 修）
  const dm = s.match(/^(\d{4})[-/\\.](\d{2})[-/\\.](\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/)
  const tm = s.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/)
  segs.y = dm?.[1] ?? ''
  segs.mo = dm?.[2] ?? ''
  segs.d = dm?.[3] ?? ''
  segs.h = dm?.[4] ?? tm?.[1] ?? ''
  segs.mi = dm?.[5] ?? tm?.[2] ?? ''
  segs.s = dm?.[6] ?? tm?.[3] ?? ''
  if (!v) for (const k of Object.keys(segs) as SegKey[]) segs[k] = ''
}

/** 段齐且合法 → model 规范串；否则 '' */
function buildValue(): string {
  const full = (defs: SegDef[]) => defs.every((s) => (segs[s.key] ?? '').length === s.len)
  if (wantDate.value && !full(DATE_SEGS)) return ''
  if (wantTime.value && !full(timeSegs.value)) return ''
  const y = +segs.y
  const mo = +segs.mo
  const d = +segs.d
  if (wantDate.value) {
    const dt = new Date(y, mo - 1, d)
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return ''
  }
  const h = +segs.h
  const mi = +segs.mi
  const s = +segs.s
  if (wantTime.value && (h > 23 || mi > 59 || (showSeconds.value && s > 59))) return ''
  const dp = wantDate.value ? `${pad(y, 4)}-${pad(mo)}-${pad(d)}` : ''
  const tp = wantTime.value
    ? showSeconds.value
      ? `${pad(h)}:${pad(mi)}:${pad(s)}`
      : `${pad(h)}:${pad(mi)}`
    : ''
  return [dp, tp].filter(Boolean).join(' ')
}

/** 日历假日期判定（段已填齐时）：2026-02-31 这类回绕视为非法 */
function dateInvalid(): boolean {
  if (segs.y.length !== 4 || segs.mo.length !== 2 || segs.d.length !== 2) return false
  const y = +segs.y
  const mo = +segs.mo
  const d = +segs.d
  const dt = new Date(y, mo - 1, d)
  return dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d
}

/** 输入/选择后统一提交口：齐且合法 → 清错 emit 规范串；未齐 → 无错静默发 ''；齐而非法 → 对应红提示 */
function commit() {
  const v = buildValue()
  if (v) error.value = ''
  else {
    const complete = activeSegs.value.every((s) => (segs[s.key] ?? '').length === s.len)
    if (!complete) error.value = ''
    else
      error.value =
        wantDate.value && dateInvalid()
          ? t('timer.invalidDate')
          : showSeconds.value
            ? t('timer.invalidTime')
            : t('timer.invalidTimeMin')
  }
  emit('update:modelValue', v)
}

/* ===== 键盘分段（两位段智能补全；年不补零、离开时兜正为当年） ===== */
/** 首位数字是否还可能扩成合法两位值（分 '5' 可为 50~59 等第二；'6' 不可能 → 立刻补 '06' 跳格） */
function canExtend(prefix: string, max: number): boolean {
  return Number(prefix) * 10 <= max
}

function onSegInput(def: SegDef, ev: Event) {
  const el = ev.target as HTMLInputElement
  let v = el.value.replace(/\D/g, '').slice(0, def.len)
  if (def.len === 2 && v.length === 1 && !canExtend(v, def.max)) v = pad(Number(v)) // 唯一解 → 自动补全两位
  segs[def.key] = v
  el.value = v
  error.value = ''
  if (v.length === def.len) focusSeg(def.key, 1) // 满位跳下一段（年满 4 位也跳）
  commit()
}

/** 段离开（blur / 面板关闭）：两位段已输未齐 → 自动补零；年不足 4 位或越界/非法 → 修正为当年 */
function leaveSeg(k: SegKey) {
  const def = [...DATE_SEGS, ...TIME_SEGS].find((s) => s.key === k)
  const v = def ? segs[k] : ''
  if (!def || !v) return
  const n = Number(v)
  if (k === 'y') {
    if (v.length !== 4 || Number.isNaN(n) || n < def.min || n > def.max)
      segs.y = String(new Date().getFullYear())
  } else if (v.length < def.len && !Number.isNaN(n)) {
    segs[k] = pad(n)
  }
  commit()
}

function fixAllSegments() {
  for (const def of activeSegs.value) leaveSeg(def.key)
}

/** 框级失焦：focused 复位；fillOnEmptyBlur 开启时，日期段为空的自动填当天（用户定稿 2026-10-21）。
 *  焦点仍在框内段间移动不触发（relatedTarget ∈ box）；有值段不动、不清零。 */
function onBoxFocusOut(e: FocusEvent) {
  focused.value = false
  if (!props.fillOnEmptyBlur || !wantDate.value) return
  const next = e.relatedTarget as HTMLElement | null
  if (next && boxEl.value?.contains(next)) return
  const now = new Date()
  let filled = false
  if ((segs.y ?? '') === '') {
    segs.y = String(now.getFullYear())
    filled = true
  }
  if ((segs.mo ?? '') === '') {
    segs.mo = pad(now.getMonth() + 1)
    filled = true
  }
  if ((segs.d ?? '') === '') {
    segs.d = pad(now.getDate())
    filled = true
  }
  if (filled) commit()
}

function onSegFocus(k: SegKey) {
  inputEls[k]?.select()
}

function onSegKeydown(k: SegKey, ev: KeyboardEvent) {
  if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
    ev.preventDefault()
    focusSeg(k, ev.key === 'ArrowRight' ? 1 : -1)
  } else if (ev.key === 'Backspace' && (segs[k] ?? '') === '') {
    focusSeg(k, -1) // 空段退格回到上一段再删
  } else if (ev.key === ' ') {
    ev.preventDefault()
  }
}

function focusSeg(k: SegKey, dir: 1 | -1) {
  const order = activeSegs.value.map((s) => s.key)
  const idx = order.indexOf(k) + dir
  const target = order[idx]
  if (target) {
    inputEls[target]?.focus()
    inputEls[target]?.select()
  }
}

/* ===== 外部校验消息 / 清除（支撑 MES 检索表单替换，2026-10-19） ===== */
const extErr = computed(() =>
  [props.errorMessages]
    .flat()
    .filter((x): x is string => !!x)
    .join(' · '),
)
/** 错误气泡与红描边统一取「内部错误优先，其次外部消息」（2026-10-20：底部消息行废止改气泡，hint 改问号 tooltip） */
const shownError = computed(() => error.value || extErr.value)
const hasContent = computed(() => activeSegs.value.some((s) => (segs[s.key] ?? '') !== ''))
function onClear() {
  for (const k of Object.keys(segs) as SegKey[]) segs[k] = ''
  error.value = ''
  emit('update:modelValue', '')
  emit('clear')
}

/** 点空白处：聚焦第一个未填段；点在段输入本身上则交给原生聚焦、不抢
    （用户报"选中年后再点月/日，焦点跳回年"根因＝此处无条件跳首未填段，2026-10-19 修复） */
function onBoxClick(ev: MouseEvent) {
  if ((ev.target as HTMLElement).closest('.fv-timer__seg')) return
  const first = activeSegs.value.find((s) => !(segs[s.key] ?? '')) ?? activeSegs.value[0]
  if (first) inputEls[first.key]?.focus()
}

/* ===== 面板草稿态（用户定稿 2026-10-18）=====
   面板内日历/滚轮的选择一律只写 draft；点「确认」才把 draft 落到分段并回显输入框；
   未确认直接关面板 → draft 丢弃，分段维持原值。键盘直接编辑分段仍即时生效（不经草稿）。 */
const draft = reactive<Record<SegKey, string>>({ y: '', mo: '', d: '', h: '', mi: '', s: '' })
function seedDraft() {
  for (const k of Object.keys(draft) as SegKey[]) draft[k] = segs[k] ?? ''
}
function confirmPanel() {
  if (props.confirmDisabled) return
  for (const k of Object.keys(draft) as SegKey[]) segs[k] = draft[k]
  error.value = ''
  fixAllSegments() // 两位补零 / 年兜正（同面板关闭口径）
  commit()
  menu.value = false
}

/* 邻月日期（上月末/下月初"补白"日）：显示且浅灰；点击不选日期、而是跳到该月（用户定稿 2026-10-19）。
   show-adjacent-months 让邻月格渲染出按钮；捕获层 click 拦截（stopPropagation 使 VBtn 自带选择
   逻辑不触发），从格子 data-v-date 读年月写入 dispMonth/dispYear——v-model:month/year 受控显示月 */
const dispMonth = ref(new Date().getMonth())
const dispYear = ref(new Date().getFullYear())
function onCalCapture(ev: MouseEvent) {
  const cell = (ev.target as HTMLElement | null)?.closest?.('.v-date-picker-month__day--adjacent')
  if (!cell) return
  ev.stopPropagation()
  ev.preventDefault()
  const iso = cell.querySelector('button')?.getAttribute('data-v-date')
  const m = iso?.match(/^(\d{4})-(\d{2})/)
  if (!m) return
  dispYear.value = Number(m[1])
  dispMonth.value = Number(m[2]) - 1
}

/* 日历面板：入 ISO 串即可（Vuetify 4 内置 adapter date() 自行解析）；
   出：v4.2.5 VDatePicker emit 的是 Date 对象（非 ISO 串）——一律归一为 YYYY-MM-DD。
   dateModel 取草稿日期段（不能用 buildValue()：datetime 模式时间未填时返回 ''，
   会让刚点选的日期在面板上无高亮——用户报"没法选择日期"根因，2026-10-18 修复） */
const dateModel = computed<string | null>(() => {
  if (!(draft.y && draft.mo && draft.d)) return null
  return `${pad(Number(draft.y), 4)}-${pad(Number(draft.mo))}-${pad(Number(draft.d))}`
})
function onPickDate(v: Date | string | null) {
  if (!v) return
  const iso =
    v instanceof Date
      ? `${pad(v.getFullYear(), 4)}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`
      : v.slice(0, 10)
  const [y, mo, d] = iso.split('-')
  if (!y || !mo || !d) return
  draft.y = y
  draft.mo = mo
  draft.d = d
}

/* ===== 时/分/秒 虚拟滚轮（无限循环连续滚动，滚动即选入草稿，确认才回显） =====
   弃用原生 scrollTop + 复制份回收方案（快速甩动越过回收区会露出列表边界断档，setTimeout 守卫
   与 scroll 事件竞争还会丢选中——用户报告 2026-10-19）。改为自绘：每轮维护连续浮点位置 pos
   （单位=行），只渲染中心 ±3 行、显示值取 idx mod n → 天然双向无限循环、无边界无竞态；
   滚轮/拖拽推进 target，rAF 缓动自动吸附整行，中心行值实时写入草稿。 */
const ITEM_H = 32
const WHEEL_N = [24, 60, 60] as const
const WHEEL_KEYS: SegKey[] = ['h', 'mi', 's']
const ROW_OFFS = [-3, -2, -1, 0, 1, 2, 3]
const wheels = reactive(WHEEL_N.map(() => ({ pos: 0, target: 0 })))
let wheelRaf = 0
let wheelSettle: ReturnType<typeof setTimeout> | undefined
/* 拖拽状态：moved 区分拖动/轻点；tapK=按下行相对中心的偏移——行上的 click 不会触发
   （setPointerCapture 把 click 重定向到捕获元素），点选在 pointerup 内按 !moved 判定 */
let wheelDrag: {
  wi: number
  startY: number
  startPos: number
  lastY: number
  lastT: number
  v: number
  moved: boolean
  tapK: number | null
} | null = null

const mod = (v: number, m: number) => ((v % m) + m) % m
/** 滚轮列索引（precision='minute' 时秒轮整体不渲染） */
const wheelIdx = computed(() => (showSeconds.value ? [0, 1, 2] : [0, 1]))

/** 行相对中心的位移（px）：绝对行号 = round(pos)+k，位置 = (绝对行号 - pos) × 行高 */
function wheelTopPx(i: number, k: number): number {
  const w = wheels[i]!
  return (Math.round(w.pos) + k - w.pos) * ITEM_H
}
function wheelVal(i: number, k: number): string {
  return pad(mod(Math.round(wheels[i]!.pos) + k, WHEEL_N[i]!))
}

function ensureWheelLoop() {
  if (!wheelRaf) wheelRaf = requestAnimationFrame(wheelTick)
}
function stopWheelLoop() {
  if (wheelRaf) cancelAnimationFrame(wheelRaf)
  wheelRaf = 0
  clearTimeout(wheelSettle)
  wheelDrag = null
}

function wheelTick() {
  wheelRaf = 0
  let active = false
  WHEEL_N.forEach((n, i) => {
    const w = wheels[i]!
    if (w.pos !== w.target) {
      const d = w.target - w.pos
      if (Math.abs(d) < 0.002) {
        const base = mod(Math.round(w.target), n) // 落定后归回 [0,n)，防浮点无限漂移
        w.pos = base
        w.target = base
      } else {
        w.pos += d * 0.22
        active = true
      }
    }
    const key = WHEEL_KEYS[i]
    const sel = pad(mod(Math.round(w.pos), n)) // 中心行即选中值
    if (key && draft[key] !== sel) draft[key] = sel
  })
  if (active || wheelDrag) wheelRaf = requestAnimationFrame(wheelTick)
}

function onWheelEvt(i: number, ev: WheelEvent) {
  const w = wheels[i]!
  const dypx =
    ev.deltaMode === 1 ? ev.deltaY * 16 : ev.deltaMode === 2 ? ev.deltaY * ITEM_H * 5 : ev.deltaY
  // 鼠标滚轮整格（|Δ|≥50px）吸附一行；触控板小增量按像素连续推进
  const rows = ev.deltaMode === 0 && Math.abs(dypx) >= 50 ? Math.sign(dypx) : dypx / ITEM_H
  w.target += rows
  clearTimeout(wheelSettle)
  wheelSettle = setTimeout(() => {
    w.target = Math.round(w.target) // 停止滚动 → 吸附整行
    ensureWheelLoop()
  }, 140)
  ensureWheelLoop()
}

function onPointerDown(i: number, ev: PointerEvent) {
  if (ev.button !== 0) return
  ;(ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId)
  clearTimeout(wheelSettle)
  const cell = (ev.target as HTMLElement | null)?.closest?.('[data-k]')
  const k = cell ? Number(cell.getAttribute('data-k')) : NaN
  wheelDrag = {
    wi: i,
    startY: ev.clientY,
    startPos: wheels[i]!.pos,
    lastY: ev.clientY,
    lastT: performance.now(),
    v: 0,
    moved: false,
    tapK: Number.isNaN(k) ? null : k,
  }
  ensureWheelLoop()
}

function onPointerMove(i: number, ev: PointerEvent) {
  const dg = wheelDrag
  if (!dg || dg.wi !== i) return
  const now = performance.now()
  const dt = Math.max(1, now - dg.lastT)
  dg.v = dg.v * 0.6 + ((ev.clientY - dg.lastY) / dt) * 0.4
  dg.lastY = ev.clientY
  dg.lastT = now
  const dy = ev.clientY - dg.startY
  if (Math.abs(dy) > 3) dg.moved = true
  const p = dg.startPos - dy / ITEM_H // 手指下移 → 内容下移值减小（同原生滚动方向）
  wheels[i]!.pos = p
  wheels[i]!.target = p
}

function onPointerUp(i: number) {
  const dg = wheelDrag
  if (!dg || dg.wi !== i) return
  wheelDrag = null
  const w = wheels[i]!
  if (!dg.moved && dg.tapK !== null) {
    w.target = Math.round(w.pos) + dg.tapK // 轻点某行 → 滚动吸附到该行
  } else {
    w.target = Math.round(w.pos - (dg.v * 140) / ITEM_H) // 拖动松手：惯性投射后吸附
  }
  ensureWheelLoop()
}

watch(menu, (open) => {
  if (!open) {
    stopWheelLoop()
    fixAllSegments() // 面板关闭兜正所有段（两位补零 / 年不足 4 位或非法 → 当年）
    return
  }
  seedDraft() // 每次开面板从分段现值起稿；未确认关闭 → 草稿自然丢弃
  if (wantDate.value) {
    // 日期段缺失以今天起稿：开面板不作任何选择、直接确认也要回显当前日期（用户定稿 2026-10-19）
    const now = new Date()
    if (draft.y.length !== 4) draft.y = pad(now.getFullYear(), 4)
    if (draft.mo.length !== 2) draft.mo = pad(now.getMonth() + 1)
    if (draft.d.length !== 2) draft.d = pad(now.getDate())
    // 显示月对准草稿日期（邻月跳月受控状态的初始值）
    const y = Number(draft.y)
    const mo = Number(draft.mo)
    if (y >= 1970 && y <= 9999 && mo >= 1 && mo <= 12) {
      dispYear.value = y
      dispMonth.value = mo - 1
    }
  }
  if (wantTime.value) {
    // 滚轮居中即选中：空段以 00 起稿，确认时居中值（日历=今天 / 时分秒=居中行）整体回显
    for (const key of WHEEL_KEYS) if (draft[key].length !== 2) draft[key] = '00'
    WHEEL_N.forEach((n, i) => {
      const key = WHEEL_KEYS[i]
      if (!key) return
      const p = mod(Number(draft[key]), n)
      wheels[i]!.pos = p
      wheels[i]!.target = p
    })
  }
})
</script>

<template>
  <div class="fv-timer" :class="{ 'fv-timer--disabled': props.disabled }">
    <div v-if="props.label" class="fv-timer__label">
      {{ props.label }}
      <v-tooltip v-if="props.showHint && props.hint" :text="props.hint" content-class="vui-table-tip">
        <template #activator="{ props: tipProps }">
          <span v-bind="tipProps" class="fv-field__hint-icon"><v-icon size="13">fas fa-circle-question</v-icon></span>
        </template>
      </v-tooltip>
    </div>
    <div class="fv-timer__line">
      <!-- 校验错误徽标（内部错误优先、其次外部消息合并一枚）：右下角贴盒右上角，
           悬停出红字 tooltip；徽标/tooltip 样式在 tokens.css 字段气泡段 -->
      <div v-if="shownError" class="fv-timer__bubble">
        <v-tooltip :text="shownError" content-class="vui-table-tip vui-field-err-tip">
          <template #activator="{ props: tipProps }">
            <span v-bind="tipProps" class="fv-field__err-badge"><v-icon size="12">fas fa-comment-dots</v-icon></span>
          </template>
        </v-tooltip>
      </div>
      <!-- 分段输入框（点击聚焦首个未填段；键盘逐段编辑；尾部图标开面板，规格同 FvTextInput 字段图标 15px） -->
      <div
        ref="boxEl"
        class="fv-timer__box"
        :class="{ 'fv-timer__box--focus': focused, 'fv-timer__box--error': !!shownError }"
        @click="onBoxClick"
        @focusin="focused = true"
        @focusout="onBoxFocusOut"
      >
        <template v-for="(it, i) in items" :key="i">
          <span v-if="it.type === 'sep'" class="fv-timer__sep">{{ it.text }}</span>
          <input
            v-else
            :ref="(el) => (inputEls[it.def.key] = el as HTMLInputElement | null)"
            class="fv-timer__seg"
            :value="segs[it.def.key]"
            :style="{ width: it.def.len === 4 ? '42px' : '24px' }"
            :maxlength="it.def.len"
            inputmode="numeric"
            autocomplete="off"
            :placeholder="it.def.prompt"
            :disabled="props.disabled"
            :aria-label="it.def.prompt"
            @input="onSegInput(it.def, $event)"
            @keydown="onSegKeydown(it.def.key, $event)"
            @focus="onSegFocus(it.def.key)"
            @blur="leaveSeg(it.def.key)"
          />
        </template>
        <!-- 清除钮（clearable 且有内容时）：清空全部段并通知父级联动默认值 -->
        <span
          v-if="props.clearable && hasContent"
          class="fv-timer__clear"
          role="button"
          tabindex="0"
          :aria-label="t('timer.clear')"
          @click.stop="onClear"
          @keydown.enter.prevent="onClear"
        >
          <v-icon icon="fas fa-circle-xmark" />
        </span>
        <!-- 面板弹层：日历（含日期模式） + 滚轮（含时间模式）；纯日期隐藏滚轮、纯时间隐藏日历 -->
        <v-menu
          v-model="menu"
          :close-on-content-click="false"
          :disabled="props.disabled"
          location="bottom end"
          offset="8"
          min-width="auto"
        >
          <template #activator="{ props: btn }">
            <span
              v-bind="btn"
              class="fv-timer__btn"
              role="button"
              tabindex="0"
              :aria-label="
                mode === 'date'
                  ? t('timer.pickDate')
                  : mode === 'time'
                    ? t('timer.pickTime')
                    : t('timer.pick')
              "
              @click.stop
              @keydown.enter.prevent="menu = !menu"
            >
              <v-icon icon="fas fa-clock" />
            </span>
          </template>
          <div class="fv-timer__panel">
            <v-date-picker
              v-if="wantDate"
              v-model:month="dispMonth"
              v-model:year="dispYear"
              :model-value="dateModel"
              show-adjacent-months
              hide-header
              weekday-format="short"
              first-day-of-week="0"
              color="primary"
              class="fv-timer__picker"
              @click.capture="onCalCapture"
              @update:model-value="onPickDate"
            >
              <!-- 标题栏（用户定稿 2026-10-18）：双箭头翻年（不动月份）/ 单箭头翻月（跨年自然衔接），
                 中间统一某年某月文字；月/年单独选择视图不再入口 -->
              <template
                #controls="{ monthText, yearText, prevMonth, nextMonth, prevYear, nextYear }"
              >
                <div class="vui-cal-ctrl">
                  <div class="vui-cal-ctrl__group">
                    <v-btn
                      icon
                      variant="text"
                      size="x-small"
                      density="default"
                      :aria-label="t('timer.prevYear')"
                      @click="prevYear()"
                    >
                      <v-icon icon="fas fa-angles-left" size="14" />
                    </v-btn>
                    <v-btn
                      icon
                      variant="text"
                      size="x-small"
                      density="default"
                      :aria-label="t('timer.prevMonth')"
                      @click="prevMonth()"
                    >
                      <v-icon icon="fas fa-chevron-left" size="14" />
                    </v-btn>
                  </div>
                  <span class="vui-cal-ctrl__text">{{
                    calYearMonthText(monthText, yearText)
                  }}</span>
                  <div class="vui-cal-ctrl__group">
                    <v-btn
                      icon
                      variant="text"
                      size="x-small"
                      density="default"
                      :aria-label="t('timer.nextMonth')"
                      @click="nextMonth()"
                    >
                      <v-icon icon="fas fa-chevron-right" size="14" />
                    </v-btn>
                    <v-btn
                      icon
                      variant="text"
                      size="x-small"
                      density="default"
                      :aria-label="t('timer.nextYear')"
                      @click="nextYear()"
                    >
                      <v-icon icon="fas fa-angles-right" size="14" />
                    </v-btn>
                  </div>
                </div>
              </template>
            </v-date-picker>
            <template v-if="wantTime">
              <v-divider v-if="wantDate" />
              <div class="fv-timer__wheels">
                <div class="fv-timer__wheel-heads">
                  <span>{{ t('timer.hour') }}</span
                  ><span>{{ t('timer.minute') }}</span
                  ><span v-if="showSeconds">{{ t('timer.second') }}</span>
                </div>
                <div class="fv-timer__wheels-body">
                  <div
                    v-for="wi in wheelIdx"
                    :key="wi"
                    class="fv-timer__wheel"
                    @wheel.prevent="onWheelEvt(wi, $event)"
                    @pointerdown="onPointerDown(wi, $event)"
                    @pointermove="onPointerMove(wi, $event)"
                    @pointerup="onPointerUp(wi)"
                    @pointercancel="onPointerUp(wi)"
                  >
                    <div
                      v-for="k in ROW_OFFS"
                      :key="k"
                      class="fv-timer__wheel-item"
                      :class="{ 'fv-timer__wheel-item--on': k === 0 }"
                      :style="{ transform: `translateY(${wheelTopPx(wi, k)}px)` }"
                      :data-k="k"
                    >
                      {{ wheelVal(wi, k) }}
                    </div>
                  </div>
                </div>
              </div>
            </template>
            <!-- 面板下方确认钮（用户定稿 2026-10-18）：确认前日历/滚轮选择只进草稿不回显；confirmDisabled 可在定义处禁用 -->
            <div class="fv-timer__foot">
              <v-btn
                variant="text"
                size="small"
                :disabled="props.confirmDisabled || props.disabled"
                @click="confirmPanel"
              >
                {{ t('timer.confirm') }}
              </v-btn>
            </div>
          </div>
        </v-menu>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 字段视觉对齐全局规范：36px 高、6px 圆角、聚焦主题色描边；label 上方 13px 弱化 */
.fv-timer {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.fv-timer__label {
  font-size: 13px;
  line-height: 18px;
  color: var(--vui-text-secondary);
  margin-bottom: 3px;
}

.fv-timer__line {
  display: flex;
  align-items: center;
  gap: 4px;
  position: relative; /* 错误气泡定位锚 */
}

/* 错误徽标锚点（本体视觉=fv-field__err-badge 全局类）：右下角=盒右上角（2026-10-20 由文字气泡改版） */
.fv-timer__bubble {
  position: absolute;
  top: 0;
  right: 0;
  transform: translate(0, -100%);
  z-index: 6;
}

.fv-timer__box {
  display: flex;
  align-items: center;
  box-sizing: border-box; /* 项目无全局 border-box：36px 必须含 1px 上下边框（对齐字段实测高 36） */
  height: 36px;
  padding: 0; /* 内边距归零；间距改根组件外边距 10px/3px（tokens.css 字段间距规格，2026-10-20 三调） */
  /* 字段描边真值（实测 .v-field__outline__start：--vui-text 87% × 元素透明度 38% ≈ 33%） */
  border: 1px solid color-mix(in srgb, var(--vui-text) 33%, transparent);
  border-radius: 6px;
  background: transparent;
  cursor: text;
  color: var(--vui-text);
  transition: border-color 0.15s ease;
}

/* 聚焦：主题色描边（1px 边 + 1px 内投影凑 2px，同 FvTextInput 字段聚焦口径） */
.fv-timer__box--focus {
  border-color: var(--vui-primary);
  box-shadow: inset 0 0 0 1px var(--vui-primary);
}

.fv-timer__box--error {
  border-color: var(--vui-error);
}

.fv-timer__seg {
  border: none;
  outline: none;
  background: transparent;
  text-align: center;
  font-size: 14px; /* 字段文字统一标准字号 14px（同 tokens.css .v-field__input 定稿） */
  font-variant-numeric: tabular-nums;
  color: inherit;
  padding: 0;
  caret-color: var(--vui-primary);
}

.fv-timer__seg::placeholder {
  opacity: 0.6;
}

.fv-timer__seg:disabled {
  opacity: 0.5;
}

.fv-timer__sep {
  color: var(--vui-text);
  font-size: 14px;
  user-select: none;
}


/* 清除钮：紧随段后、开面板时钟钮之前，弱化色 hover 提亮 */
.fv-timer__clear {
  display: inline-flex;
  align-items: center;
  margin-left: 4px;
  cursor: pointer;
}

.fv-timer__clear :deep(.v-icon) {
  font-size: 13px;
  width: 13px;
  height: 13px;
  color: color-mix(in srgb, var(--vui-text) 42%, transparent);
}

.fv-timer__clear:hover :deep(.v-icon) {
  color: color-mix(in srgb, var(--vui-text) 75%, transparent);
}

.fv-timer--disabled {
  opacity: 0.6;
  pointer-events: none;
}

/* 尾部面板图标：与 FvTextInput 字段内图标同规（tokens.css 15×15、色随字段文本），非按钮外观 */
.fv-timer__btn {
  display: inline-flex;
  align-items: center;
  margin-left: 6px;
  /* 末尾图标右距对齐 FvTextInput 右侧图标：字段 .v-field 自带 padding-inline 12px（图标距右框 12），
     本盒为 1px 真实边框 → 留 11px（11+1=12，外缘测量一致，2026-10-20 实测校准） */
  margin-right: 11px;
  color: inherit;
  cursor: pointer;
}

.fv-timer__btn :deep(.v-icon) {
  font-size: 15px;
  width: 15px;
  height: 15px;
  /* 字段图标真值：on-surface 87% × 图标元素 opacity 0.6 ≈ 52%（实测 .v-field .v-icon） */
  color: color-mix(in srgb, var(--vui-text) 52%, transparent);
}

/* ===== 弹层面板：日历 + 滚轮 ===== */
.fv-timer__panel {
  background: var(--vui-bg-container);
  border-radius: var(--vui-radius-m, 10px);
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.18);
  overflow: hidden;
}

.fv-timer__picker {
  display: block;
}

/* 邻月"补白"日期：浅灰字（覆盖 Vuetify 整格半透明口径，只弱化文字）；点击跳月不选日（见 onCalCapture） */
.fv-timer__picker :deep(.v-date-picker-month__day--adjacent) {
  opacity: 1;
}
.fv-timer__picker :deep(.v-date-picker-month__day--adjacent .v-btn) {
  color: color-mix(in srgb, var(--vui-text) 28%, transparent);
}

/* 整行都是邻月补白的行直接隐藏（网格凑行产物，用户定稿 2026-10-19：去掉日历与确认钮之间的多余行） */
.fv-timer__picker
  :deep(
    .v-date-picker-month__days-row:not(
      :has(.v-date-picker-month__day:not(.v-date-picker-month__day--adjacent))
    )
  ) {
  display: none;
}

/* 确认钮行：面板内容下方右对齐（用户定稿 2026-10-18） */
.fv-timer__foot {
  display: flex;
  justify-content: flex-end;
  padding: 2px 8px 8px;
}

/* 滚轮区与日历面板同宽（v-date-picker 定宽 328px，用户定稿 2026-10-19：时分秒框与日期框宽度一致） */
.fv-timer__wheels {
  box-sizing: border-box;
  width: 328px;
  padding: 4px 6px 6px;
}

/* 列头与日历星期行同规格（用户定稿 2026-10-19）：VDatePickerMonth 星期 = .875rem/14px、继承日历正文色 */
.fv-timer__wheel-heads {
  display: flex;
  gap: 4px;
  padding: 4px 6px;
  font-size: 14px;
  color: var(--vui-text);
  text-align: center;
}

.fv-timer__wheel-heads span {
  flex: 1;
  min-width: 0;
}

.fv-timer__wheels-body {
  display: flex;
  gap: 4px;
}

/* 虚拟滚轮视口：不用原生滚动条，行绝对定位 + translateY 由 rAF 驱动（见 script 滚轮段） */
.fv-timer__wheel {
  position: relative;
  overflow: hidden;
  flex: 1;
  min-width: 0;
  height: 160px;
  cursor: grab;
  touch-action: none;
  user-select: none;
  /* 上下缘渐隐：滚动中出现的半行柔化收边，强化"轮"的观感 */
  -webkit-mask-image: linear-gradient(180deg, transparent, #000 20%, #000 80%, transparent);
  mask-image: linear-gradient(180deg, transparent, #000 20%, #000 80%, transparent);
}

.fv-timer__wheel-item {
  position: absolute;
  left: 0;
  right: 0;
  top: 64px; /* 中心行基准位（(160-32)/2），行位=本值+translateY */
  height: 32px;
  line-height: 32px;
  text-align: center;
  font-size: 14px; /* 与日历日期格/星期行一致（.875rem） */
  font-variant-numeric: tabular-nums;
  color: var(--vui-text);
  border-radius: 6px;
  cursor: pointer;
  user-select: none;
}

.fv-timer__wheel-item--on {
  background: color-mix(in srgb, var(--vui-primary) 12%, transparent);
  color: var(--vui-primary);
  font-weight: 600;
}
</style>
