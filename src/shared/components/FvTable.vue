<script setup lang="ts" generic="Row">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, useSlots, watch, type VNode } from 'vue'
import { useI18n } from 'vue-i18n'

import FvTableHeader, { type FvTableMenuItem } from './FvTableHeader.vue'
import FvSwitch from './FvSwitch.vue'
import FvNewButton from './FvNewButton.vue'
import FvMultiValueCell from './FvMultiValueCell.vue'

/**
 * 全局表格（shared，2026-10-15 声明式版）：组件库表格 + 定制分页条。
 * - 列声明：默认插槽内放 FvTableHeader（text/switch/multiValue/custom/action 五型）
 *   · text = 文本（headerClass 调样式）/ switch = FvSwitch（headerClass 调样式）
 *   · multiValue = FvMultiValueCell（首值主题色标签 + [总数]，悬停多行全部值；用户定稿 2026-10-19）
 *   · custom = 客制化（FvTableHeader default 插槽填充单元格）
 *   · action = 固定最后一列的操作列；actions 设 edit/delete/view/more（图标：修改=主题色 pen、
 *     删除=危险红 trash、查看=信息蓝 eye、more=次要色 ellipsis 下拉菜单），各自经 @edit/@delete/@view 回调；
 *     more 点击菜单项经 @more-select 回流 { item, key }；不声明则无该列
 * - 数据：`data` = 当前页数据；`pageContent` = 服务端分页信息（不传则隐藏分页区）
 * - 新增：`insert` 传回调则表格右上角显示 FvNewButton；回调返回新行 → 回显到第一行
 *   并触发 @inserted（data 变更会重置本地回显）
 * - 空数据：仅显示表头（2026-10-16 改，原恒显 5 空白行；Vuetify no-data 行一并隐藏）
 * - 选择：`selectMode` = 'single'（点击行选中：整行淡主题色底 + 文字随明暗主题联动 +
 *   首格左侧 5px 主题色竖条，操作列底色不变；不显示复选框列）/ 'multiple'（第一列固定复选框）。
 *   选中结果经 v-model:selected 回流
 *   （single 为 Row | null，multiple 为 Row[]）
 * - 翻页/改每页大小经 v-model:page-index / v-model:page-size 回流，由调用方重新取数
 */
interface ColDef {
  title: string
  key: string
  headerType: 'text' | 'switch' | 'multiValue' | 'custom' | 'action'
  headerClass?: string
  align?: 'start' | 'center' | 'end'
  sortable?: boolean
  /** 列级/行级禁用（禁用态而非隐藏；switch 单元格禁用时不写回、不抛 switch-change） */
  headerDisabled?: boolean | ((row: unknown) => boolean)
  /** 操作列逐行禁用谓词 + 禁用态悬停提示 */
  actionDisabled?: (row: unknown, action: FvTableAction) => boolean
  actionDisabledHint?: string
  actions: FvTableAction[]
  /** more 动作的下拉菜单项（actions 含 more 时必填，守卫见 collectColumns） */
  moreMenu?: FvTableMenuItem[]
  customSlot?: (args: { item: unknown }) => VNode[]
}

const ACTION_META = {
  edit: { icon: 'fas fa-pen', color: 'primary', label: 'common.edit' },
  delete: { icon: 'fas fa-trash', color: 'error', label: 'common.delete' },
  view: { icon: 'fas fa-eye', color: 'info', label: 'common.view' },
  // more：「…」下拉菜单入口，无主题色——图标走全局同款次要图标色（.fv-table__more-icon，--vui-text-secondary）
  more: { icon: 'fas fa-ellipsis-h', label: 'common.more' },
} as const
type FvTableAction = keyof typeof ACTION_META

const props = withDefaults(
  defineProps<{
    data: Row[]
    loading?: boolean
    /** 服务端分页信息；不传 = 无分页（隐藏分页区） */
    pageContent?: { total: number; totalPage: number; pageIndex: number; pageSize: number } | null
    pageSizeOptions?: number[]
    /** 新增回调：返回新行则回显首行；提供即显示右上角 FvNewButton */
    insert?: () => Promise<Row | null | undefined> | Row | null | undefined
    /** 选择模式：single = 行选中高亮；multiple = 第一列复选框 */
    selectMode?: 'single' | 'multiple'
  }>(),
  {
    loading: false,
    pageContent: null,
    pageSizeOptions: () => [10, 20, 50, 100],
    insert: undefined,
    selectMode: 'single', // 默认单选（用户定稿 2026-10-15）
  },
)

const pageIndex = defineModel<number>('pageIndex', { default: 1 })
const pageSize = defineModel<number>('pageSize', { default: 10 })
/** 选中结果：single → Row | null；multiple → Row[] */
const selected = defineModel<Row | Row[] | null>('selected', { default: null })

const emit = defineEmits<{
  edit: [item: Row]
  delete: [item: Row]
  view: [item: Row]
  inserted: [item: Row]
  'switch-change': [payload: { item: Row; key: string; value: boolean }]
  /** more 下拉菜单项点击：key = FvTableHeader moreMenu 项的 key */
  'more-select': [payload: { item: Row; key: string }]
}>()

const { t } = useI18n()
const slots = useSlots()

/** 插槽 vnode 的 props 保留模板原名（kebab-case），组件挂载才会驼峰化——两种拼写都要读 */
function rawProp(p: Record<string, unknown>, camel: string): unknown {
  if (p[camel] !== undefined) return p[camel]
  const kebab = camel.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())
  return p[kebab]
}

/** 运行时守卫（同 openInteractiveDialog 口径）：含 more 的操作列必须设置下拉菜单，
    未配 moreMenu 报错并摘除 more 按钮（只报一次，防列重算刷屏） */
let moreGuardFired = false
function guardActions(actions: FvTableAction[], moreMenu: FvTableMenuItem[] | undefined): FvTableAction[] {
  if (!actions.includes('more') || moreMenu?.length) return actions
  if (!moreGuardFired) {
    moreGuardFired = true
    console.error('[FvTable] actions 含 "more" 的操作列必须配置 moreMenu 下拉菜单——more 按钮已摘除')
  }
  return actions.filter((a) => a !== 'more')
}

/** 收集 FvTableHeader 声明 → 列定义 */
const columns = computed<ColDef[]>(() => {
  const vnodes = slots.default?.() ?? []
  return vnodes
    .filter((v): v is VNode & { props: Record<string, unknown> } => v.type === FvTableHeader && !!v.props)
    .map((v) => {
      const p = v.props
      const headerType = (rawProp(p, 'headerType') as ColDef['headerType']) ?? 'text'
      const children = v.children as { default?: (args: { item: unknown }) => VNode[] } | undefined
      return {
        title: (rawProp(p, 'title') as string) ?? (headerType === 'action' ? t('common.operation') : ''),
        key: headerType === 'action' ? '__actions' : ((rawProp(p, 'dataKey') as string) ?? ''),
        headerType,
        headerClass: rawProp(p, 'headerClass') as string | undefined,
        align: (rawProp(p, 'align') as ColDef['align']) ?? (headerType === 'action' ? 'end' : undefined),
        // sort 参数（仅 text 列）：点击表头 正序 → 倒序 → 恢复原始顺序（v-data-table 原生三态，箭头自带）。
        // 模板无值属性（<FvTableHeader sort />）在 vnode props 里是空字符串，需归一为 boolean
        sortable:
          headerType === 'text'
            ? ['', true].includes(rawProp(p, 'sort') as string | boolean)
            : false,
        headerDisabled: rawProp(p, 'headerDisabled') as ColDef['headerDisabled'],
        actionDisabled: rawProp(p, 'actionDisabled') as ColDef['actionDisabled'],
        actionDisabledHint: rawProp(p, 'actionDisabledHint') as string | undefined,
        actions: guardActions(
          (rawProp(p, 'actions') as FvTableAction[] ?? []).filter((a) => a in ACTION_META),
          rawProp(p, 'moreMenu') as FvTableMenuItem[] | undefined,
        ),
        moreMenu: rawProp(p, 'moreMenu') as FvTableMenuItem[] | undefined,
        customSlot: typeof children?.default === 'function' ? children.default : undefined,
      }
    })
    .filter((c) => c.headerType === 'action' || c.key)
})

/** 是否存在操作列（操作列固定与自绘横轨让位的判定源） */
const hasActionsColumn = computed(() => columns.value.some((c) => c.headerType === 'action'))

const tableHeaders = computed(() =>
  columns.value.map((c) => ({
    title: c.title,
    key: c.key,
    align: c.align,
    sortable: c.sortable,
    // v4 原生列固定：fixed 布尔=true→'start'（贴左！），字符串 'end' 才打 .v-data-table-column--fixed-end
    // 贴右缘（2026-10-18 实测 VDataTableColumn.js 修正）；操作列样式一律瞄准原生 fixed 类（headers[].class 不透传）
    fixed: c.headerType === 'action' ? ('end' as const) : undefined,
  })),
)

/** custom 列渲染桥：把 FvTableHeader 的 default 插槽内容画进单元格 */
const CustomCell = (p: { renderer: (args: { item: unknown }) => VNode[]; item: unknown }) =>
  p.renderer({ item: p.item })

/* ===== 选择 ===== */
const selectedRow = computed<Row | null>(() =>
  props.selectMode === 'single' && selected.value && !Array.isArray(selected.value) ? selected.value : null,
)

const multiSelected = computed<Row[]>({
  get: () => (props.selectMode === 'multiple' && Array.isArray(selected.value) ? selected.value : []),
  set: (v) => {
    selected.value = [...v] as Row[]
  },
})

/** single：点击行选中/再点取消 */
function onRowClick(_event: unknown, row: { item: Row }) {
  if (props.selectMode !== 'single') return
  selected.value = selectedRow.value === row.item ? null : row.item
}

const rowProps = (data: { item: Row }) => ({
  class: { 'fv-row--selected': selectedRow.value === data.item },
})

/** 单元格禁用解析：headerDisabled 传布尔=整列、传谓词=逐行 */
function cellDisabled(col: ColDef, item: unknown): boolean {
  return typeof col.headerDisabled === 'function' ? col.headerDisabled(item) : !!col.headerDisabled
}

/** 操作列逐行禁用 */
function isActionDisabled(col: ColDef, item: unknown, a: FvTableAction): boolean {
  return !!col.actionDisabled?.(item, a)
}

/** more 菜单项禁用解析：布尔=整列禁、谓词=逐行禁（同 headerDisabled 口径） */
function isMenuItemDisabled(mi: FvTableMenuItem, item: unknown): boolean {
  return typeof mi.disabled === 'function' ? mi.disabled(item) : !!mi.disabled
}

/* ===== 数据展示（insert 回显：本地副本，data 变更即重置） ===== */
const display = ref<Row[]>([...props.data])
watch(
  () => props.data,
  (d) => {
    display.value = [...d]
    // 单选模式：数据不论因何刷新（分页/再查询/落库重拉……）都清除选中（用户定稿 2026-10-16）；
    // 多选模式保留勾选（跨页批量操作语义）
    if (props.selectMode === 'single' && selected.value !== null) selected.value = null
  },
  { immediate: true },
)


async function onInsert() {
  const row = await props.insert?.()
  if (row) {
    display.value = [row as Row, ...(display.value as Row[])]
    emit('inserted', row as Row)
  }
}

/* ===== 分页 ===== */
const paged = computed(() => !!props.pageContent)
const totalCount = computed(() => props.pageContent?.total ?? 0)
const totalPage = computed(() => props.pageContent?.totalPage ?? 1)

/** 页码窗口：最多 10 个，居中滑动并夹在 [1, totalPage] */
const pages = computed(() => {
  const size = Math.min(10, totalPage.value)
  const start = Math.min(Math.max(1, pageIndex.value - Math.floor(size / 2)), totalPage.value - size + 1)
  return Array.from({ length: size }, (_, i) => start + i)
})

function go(page: number) {
  pageIndex.value = Math.min(Math.max(1, page), totalPage.value)
}

function onPageSize(size: number) {
  pageSize.value = size
  pageIndex.value = 1
}

const sizeOptions = computed(() =>
  props.pageSizeOptions.map((n) => ({ value: n, title: t('common.perPage', { n }) })),
)

/* ===== 表格区滚动监听：末行贴底判定 + 滚动条 5s 自动隐藏（用户定稿 2026-10-16） ===== */
const rootRef = ref<HTMLElement>()
let wrapperEl: HTMLElement | null = null
let scrollHideTimer: number | undefined

/** 滚动中及停滚 5s 内挂 fv-table--scroll-active（滚动条可见），超时摘除（隐藏但保留 gutter） */
function onWrapperScroll() {
  syncAtBottom()
  syncXBar()
  const root = rootRef.value
  if (!root) return
  root.classList.add('fv-table--scroll-active')
  window.clearTimeout(scrollHideTimer)
  scrollHideTimer = window.setTimeout(() => root.classList.remove('fv-table--scroll-active'), 5000)
}

/* ===== 自绘横向滚动条（2026-10-18 定稿）：原生横轨画在滚动容器边缘，横向滚动时从 sticky 右缘
   操作列下方穿过、观感"切进"操作列；改为自绘一条：溢出时常驻，**右端按操作列宽度让位**
   （滚动条永不出现在操作列下），拇指拖拽与 wrapper.scrollLeft 双向同步，轨点击跳位。
   原生横轨收槽（::-webkit-scrollbar height:0），竖轨 5s 闲置机制不变 */
const xBar = reactive({ visible: false, inset: 0, thumbW: 0, left: 0 })
const xbarTrack = ref<HTMLElement>()
let xResizeObs: ResizeObserver | undefined

function syncXBar() {
  const w = wrapperEl ?? (rootRef.value?.querySelector('.v-table__wrapper') as HTMLElement | null)
  if (!w) return
  const max = w.scrollWidth - w.clientWidth
  xBar.visible = max > 1
  if (!xBar.visible) return
  // 固定列实测宽：优先 Vuetify fixed-end 类；类未生效时按"有操作列则末列即固定列"兜底
  const sticky = (w.querySelector('th.v-data-table-column--fixed-end') ??
    (hasActionsColumn.value ? w.querySelector('thead > tr > th:last-child') : null)) as HTMLElement | null
  xBar.inset = sticky?.offsetWidth ?? 0
  // v-show 首帧轨未展开（clientWidth=0）→ 用 wrapper 可用宽兜底
  const trackW = xbarTrack.value?.clientWidth || Math.max(w.clientWidth - xBar.inset, 24)
  xBar.thumbW = Math.max(28, Math.round(trackW * Math.min(1, w.clientWidth / w.scrollWidth)))
  xBar.left = Math.round((w.scrollLeft / max) * Math.max(trackW - xBar.thumbW, 0))
}

/** 拇指左缘 → scrollLeft（含夹取） */
function scrollByThumbLeft(left: number) {
  const w = wrapperEl
  const trackW = xbarTrack.value?.clientWidth ?? 0
  if (!w || trackW <= 0) return
  const range = Math.max(trackW - xBar.thumbW, 1)
  w.scrollLeft = (Math.min(Math.max(left, 0), range) / range) * (w.scrollWidth - w.clientWidth)
}

function onXTrackDown(e: PointerEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  scrollByThumbLeft(e.clientX - rect.left - xBar.thumbW / 2)
}

function onXThumbDown(e: PointerEvent) {
  e.stopPropagation()
  const startX = e.clientX
  const startLeft = xBar.left
  const move = (ev: PointerEvent) => scrollByThumbLeft(startLeft + ev.clientX - startX)
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

function syncAtBottom() {
  const root = rootRef.value
  if (!root) return
  const w = root.querySelector('.v-table__wrapper') as HTMLElement | null
  if (w !== wrapperEl) {
    wrapperEl?.removeEventListener('scroll', onWrapperScroll)
    wrapperEl = w
    w?.addEventListener('scroll', onWrapperScroll, { passive: true })
  }
  if (!w) return
  const overflow = w.scrollHeight > w.clientHeight + 1
  root.classList.toggle('fv-table--at-bottom', overflow && w.scrollHeight - w.clientHeight - w.scrollTop < 2)
}

onMounted(() => {
  syncAtBottom()
  syncXBar()
  if (wrapperEl) {
    // 容器宽度变化（窗口缩放等）→ 重算横轨几何
    xResizeObs = new ResizeObserver(() => syncXBar())
    xResizeObs.observe(wrapperEl)
  }
})
watch([() => props.data, pageIndex, pageSize], () =>
  void nextTick(() => {
    syncAtBottom()
    syncXBar()
  }),
)
// actions 增减会改变固定列宽 → 让位宽度重算
watch(columns, () => void nextTick(syncXBar))
onBeforeUnmount(() => {
  wrapperEl?.removeEventListener('scroll', onWrapperScroll)
  xResizeObs?.disconnect()
  window.clearTimeout(scrollHideTimer)
})
</script>

<template>
  <div ref="rootRef" class="fv-table" :class="{ 'fv-table--has-actions': hasActionsColumn }">
    <!-- insert 回调存在 → 右上角 FvNewButton -->
    <div v-if="insert" class="fv-table__toolbar">
      <FvNewButton :label="t('common.add')" @click="onInsert" />
    </div>

    <v-data-table
      :headers="tableHeaders"
      :items="display"
      :loading="loading"
      :items-per-page="-1"
      hide-default-footer
      density="comfortable"
      class="vui-table--comfortable"
      no-data-text=""
      :show-select="selectMode === 'multiple'"
      sort-asc-icon="fas fa-chevron-up"
      sort-desc-icon="fas fa-chevron-down"
      :return-object="true"
      :row-props="rowProps"
      @click:row="onRowClick"
      v-model:selected="multiSelected"
    >
      <template v-for="col in columns" :key="col.key" #[`item.${col.key}`]="{ item }">
        <span v-if="col.headerType === 'text'" :class="col.headerClass">{{ (item as Record<string, unknown>)[col.key] }}</span>

        <FvSwitch
          v-else-if="col.headerType === 'switch'"
          :model-value="!!(item as Record<string, unknown>)[col.key]"
          :class="col.headerClass"
          :disabled="cellDisabled(col, item)"
          @update:model-value="(v: boolean) => {
            // 列级/行级禁用：不写回、不抛事件（禁用态而非隐藏，用户定稿 2026-10-16）
            if (cellDisabled(col, item)) return
            // 立即写回行数据（视觉即时更新），再交调用方落库；落库失败由调用方重拉覆盖
            ;(item as Record<string, unknown>)[col.key] = v
            emit('switch-change', { item: item as Row, key: col.key, value: v })
          }"
        />

        <FvMultiValueCell
          v-else-if="col.headerType === 'multiValue'"
          :values="(item as Record<string, unknown>)[col.key] as (string[] | string | undefined)"
          :class="col.headerClass"
        />

        <component
          :is="CustomCell"
          v-else-if="col.headerType === 'custom' && col.customSlot"
          :renderer="col.customSlot"
          :item="item"
        />

        <template v-else-if="col.headerType === 'action'">
          <template v-for="a in col.actions" :key="a">
            <!-- more：「…」下拉菜单入口（FvShell 顶栏同款 v-menu+v-tooltip 合并 activator 模式）；
                 @click.stop 挂 span 而非钮：menu 激活 prop 在 span 上，钮上 stop 会掐断冒泡致菜单不开 -->
            <v-menu v-if="a === 'more'" location="bottom end">
              <template #activator="{ props: menuProps }">
                <v-tooltip
                  :text="col.actionDisabledHint ?? ''"
                  :disabled="!isActionDisabled(col, item, a) || !col.actionDisabledHint"
                  location="top"
                  content-class="vui-table-tip"
                >
                  <template #activator="{ props: tipProps }">
                    <span v-bind="{ ...menuProps, ...tipProps }" class="fv-table__action-wrap" @click.stop>
                      <v-btn
                        icon
                        variant="text"
                        size="x-small"
                        :disabled="isActionDisabled(col, item, a)"
                        :aria-label="t(ACTION_META.more.label)"
                      >
                        <v-icon :icon="ACTION_META.more.icon" size="14" class="fv-table__more-icon" />
                      </v-btn>
                    </span>
                  </template>
                </v-tooltip>
              </template>
              <v-list density="compact" class="py-1" min-width="140">
                <v-list-item
                  v-for="mi in col.moreMenu"
                  :key="mi.key"
                  :title="mi.label"
                  :prepend-icon="mi.icon"
                  :color="mi.color"
                  :disabled="isMenuItemDisabled(mi, item)"
                  @click="emit('more-select', { item: item as Row, key: mi.key })"
                />
              </v-list>
            </v-menu>

            <!-- edit/delete/view：逐行禁用（内置行保护等）按钮置灰；禁用钮不抛鼠标事件，tooltip 挂外层 span -->
            <v-tooltip
              v-else
              :text="col.actionDisabledHint ?? ''"
              :disabled="!isActionDisabled(col, item, a) || !col.actionDisabledHint"
              location="top"
              content-class="vui-table-tip"
            >
              <template #activator="{ props: tipProps }">
                <span v-bind="tipProps" class="fv-table__action-wrap">
                  <v-btn
                    icon
                    variant="text"
                    size="x-small"
                    :color="ACTION_META[a].color"
                    :disabled="isActionDisabled(col, item, a)"
                    :aria-label="t(ACTION_META[a].label)"
                    @click.stop="(emit as (e: FvTableAction, item: Row) => void)(a, item as Row)"
                  >
                    <v-icon :icon="ACTION_META[a].icon" size="14" />
                  </v-btn>
                </span>
              </template>
            </v-tooltip>
          </template>
        </template>
      </template>
    </v-data-table>

    <!-- 自绘横向滚动条：溢出常驻，右端按固定操作列宽让位（永不穿过操作列下方） -->
    <div
      v-show="xBar.visible"
      ref="xbarTrack"
      class="fv-table__xbar"
      :style="{ marginRight: 8 + xBar.inset + 'px' }"
      @pointerdown="onXTrackDown"
    >
      <div
        class="fv-table__xbar-thumb"
        :style="{ width: xBar.thumbW + 'px', transform: `translateX(${xBar.left}px)` }"
        @pointerdown="onXThumbDown"
      />
    </div>

    <!-- 分页条：左=总数，右=大小选项 + 首页/上一页/页码/下一页/末页（紧凑单行） -->
    <template v-if="paged">
      <v-divider />
      <div class="fv-table__footer">
        <v-spacer />
        <span class="text-body-2 text-medium-emphasis fv-table__total">{{ t('common.total', { n: totalCount }) }}</span>
        <v-select
          :model-value="pageSize"
          :items="sizeOptions"
          density="compact"
          hide-details
          class="fv-table__size"
          @update:model-value="(v: number) => onPageSize(v)"
        />
        <v-btn
          icon
          variant="text"
          size="x-small"
          :disabled="pageIndex <= 1"
          :aria-label="t('common.firstPage')"
          @click="go(1)"
        >
          <v-icon icon="fas fa-angles-left" size="14" />
        </v-btn>
        <v-btn
          icon
          variant="text"
          size="x-small"
          :disabled="pageIndex <= 1"
          :aria-label="t('common.prevPage')"
          @click="go(pageIndex - 1)"
        >
          <v-icon icon="fas fa-chevron-left" size="14" />
        </v-btn>
        <div class="fv-table__pages">
          <v-btn
            v-for="p in pages"
            :key="p"
            :variant="p === pageIndex ? 'flat' : 'text'"
            :color="p === pageIndex ? 'primary' : undefined"
            size="x-small"
            class="fv-table__page"
            @click="go(p)"
          >
            {{ p }}
          </v-btn>
        </div>
        <v-btn
          icon
          variant="text"
          size="x-small"
          :disabled="pageIndex >= totalPage"
          :aria-label="t('common.nextPage')"
          @click="go(pageIndex + 1)"
        >
          <v-icon icon="fas fa-chevron-right" size="14" />
        </v-btn>
        <v-btn
          icon
          variant="text"
          size="x-small"
          :disabled="pageIndex >= totalPage"
          :aria-label="t('common.lastPage')"
          @click="go(totalPage)"
        >
          <v-icon icon="fas fa-angles-right" size="14" />
        </v-btn>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* 容器样式（2026-10-16 调优：内边距 0 + 四周边框）：圆角用标准输入框档（--vui-radius-s = 6px），
   边框同输入控件档令牌 --vui-border。overflow: clip 只做圆角裁剪、不产生滚动容器；
   内层 v-table 圆角同心收敛为 6 − 1 边框 = 5px */
.fv-table {
  padding: 0;
  border: 1px solid var(--vui-border);
  border-radius: var(--vui-radius-s);
  background: var(--vui-bg-container);
  overflow: clip;
  /* 滚动内收（用户定稿 2026-10-16）：本体为 flex 列，表格区独占滚动，工具行/分页条固定 */
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}

.fv-table__toolbar {
  flex: 0 0 auto;
}

.fv-table__footer {
  flex: 0 0 auto;
}

/* 滚动链：v-data-table → v-table → wrapper 逐层 flex 收高，wrapper 成为唯一滚动容器 */
.fv-table :deep(.v-data-table) {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.fv-table :deep(.v-data-table .v-table) {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.fv-table :deep(.v-table) {
  border-radius: calc(var(--vui-radius-s) - 1px) !important; /* 同心圆角（6 − 1 边框）；压过 tokens.css .v-table 的 !important */
}

/* 空数据仅显表头：隐藏 Vuetify 的 no-data 占位行 */
.fv-table :deep(.v-data-table-rows-no-data) {
  display: none;
}

/* 加载态只留表头进度条：隐藏 Vuetify 的 "Loading items" 占位行（用户定稿 2026-10-16） */
.fv-table :deep(.v-data-table-rows-loading) {
  display: none;
}

/* 行下边框（用户定稿 2026-10-16）：与外框同令牌。
   末行边框仅在「表格区可滚动且已滚到底」时去除（此时末行与分页条分割线相邻，防叠双线）；
   末页行不满等不贴底场景保留末行边框（at-bottom 类由滚动监听维护） */
.fv-table :deep(tbody tr td) {
  border-bottom: 1px solid var(--vui-border);
}

.fv-table--at-bottom :deep(tbody tr:last-child td) {
  border-bottom: 0;
}

/* 排序箭头：chevron 上/下，12px 小图标（用户调优 2026-10-15）；
   布局改为 文字左侧 · 箭头吸附单元格右侧（覆盖 Vuetify 图标紧贴文字的默认） */
.fv-table :deep(thead .v-data-table__th__sort-icon .v-icon),
.fv-table :deep(thead th .v-icon) {
  font-size: 12px !important;
  width: 12px;
  height: 12px;
}

/* 操作列（固定末列，2026-10-16 重做）：
   - 突出：左侧阴影分界（1px 分隔线 + 8px 柔和外投影，--vui-text 投射双主题自适应）+ 微异底色
   - 固定：sticky 贴右缘（表头交叉时 z-index 压层）
   - 列宽随 action 数量自适应：width:1% + nowrap 触发 table-layout:auto 的 shrink-to-fit——
     按钮不压缩、不多留白，增减 actions 列宽自动跟变（此前固定 padding 下 2 钮会被挤压变形）
   - 选择器用 v4 fixed-end 原生类（headers[].class 不透传；2026-10-18 修正：布尔 fixed 落 start=贴左，
     贴右必须 fixed:'end' → --fixed-end 类）；right:0 由 Vuetify 该类自带，不自写 */
/* 操作列固定（2026-10-18 定稿）：横滚时操作列恒钉表格右缘、内容从其下方滚过。
   不依赖 Vuetify headers[].fixed 是否把 --fixed-end 类打上（角色页实测未生效）——
   声明了操作列（fv-table--has-actions）即由本组件自钉最后一列；
   --fixed-end 类命中时同规则幂等叠加。空态/加载态整行（colspan）排除，避免贴右。 */
.fv-table :deep(.v-data-table-column--fixed-end),
.fv-table--has-actions :deep(.v-table__wrapper > table > thead > tr > th:last-child),
.fv-table--has-actions :deep(.v-table__wrapper > table > tbody > tr:not(.v-data-table-rows-no-data):not(.v-data-table-rows-loading):not(.v-data-table__tr--mobile) > td:last-child) {
  position: sticky;
  right: 0;
  z-index: 1;
  width: 1%;
  white-space: nowrap;
  padding-inline: 8px; /* 图标钮列收紧（默认 16px 两侧留白过宽） */
  background: color-mix(in srgb, var(--vui-text) 3%, var(--vui-bg-container));
  border-left: 0; /* 分隔线并入阴影层 */
  box-shadow:
    -1px 0 0 0 color-mix(in srgb, var(--vui-text) 14%, transparent),
    -8px 0 10px -6px color-mix(in srgb, var(--vui-text) 20%, transparent);
}

/* 右上角交叉单元（表头吸顶 × 操作列贴右）：压过表头(2)与普通固定列(1) */
.fv-table :deep(th.v-data-table-column--fixed-end),
.fv-table--has-actions :deep(.v-table__wrapper > table > thead > tr > th:last-child) {
  z-index: 3;
}

/* 操作钮间距 4px（tooltip 包裹 span 后以 span 为间隔单位） */
.fv-table :deep(td.v-data-table-column--fixed-end .fv-table__action-wrap + .fv-table__action-wrap),
.fv-table--has-actions :deep(.v-table__wrapper > table > tbody > tr > td:last-child .fv-table__action-wrap + .fv-table__action-wrap) {
  margin-left: 4px;
}

.fv-table__action-wrap {
  display: inline-flex;
}

/* more「…」入口：全局同款次要图标色（与 FvTimer/FvMultiValueCell 等一致，双主题自适应） */
.fv-table__more-icon {
  color: var(--vui-text-secondary);
}

/* v4 表头结构：th > .v-data-table-header__content > (文字 + 图标)——
   内容盒 flex + 图标 margin-left:auto，实现 文字左 · 箭头贴右（用户调优 2026-10-15） */
.fv-table :deep(thead th .v-data-table-header__content) {
  display: flex;
  align-items: center;
  width: 100%;
}

.fv-table :deep(thead th .v-data-table-header__content .v-icon) {
  margin-left: auto;
}

.fv-table__toolbar {
  display: flex;
  justify-content: flex-end;
  padding: 8px 12px 8px; /* 与表头保持 8px 间距（用户调优 2026-10-15） */
}

/* 表格区内部滚动（2026-10-16 内收定稿）：wrapper 为唯一滚动容器，
   thead 的 sticky 绑定它（表头仍恒显示）；新增钮/分页条在 wrapper 之外故固定不动。
   2026-10-18 定稿：宽表横向内滚（overflow 双向）；表头与单元格文字一律不换行——
   列随内容撑开、超出交给横向滚动（th 的 sticky 纵向不受影响，横向随内容整体移动） */
.fv-table :deep(.v-table__wrapper) {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}

.fv-table :deep(th),
.fv-table :deep(td) {
  white-space: nowrap;
}

/* 滚动条策略（2026-10-18 再修订）：
   横向 = 原生横轨整体收槽（height 0），改由 .fv-table__xbar 自绘——拇指常驻、
   右端按固定操作列宽让位，滚动条不再从操作列下方穿过（用户定稿）；
   竖轨维持 2026-10-16 口径：闲置收槽（width 0），滚动中及停滚 5s 内开 8px。
   只用 ::-webkit-scrollbar（Chrome/Edge）：**不得设 scrollbar-width/color 标准属性**
   （新版 Chromium 设置标准属性会整体无视 webkit 伪元素）。Firefox 走原生，降级可接受。 */
.fv-table :deep(.v-table__wrapper)::-webkit-scrollbar {
  width: 0; /* 竖轨：闲置收槽 */
  height: 0; /* 横轨：收槽（自绘条接管） */
}

.fv-table :deep(.v-table__wrapper)::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--vui-text) 30%, transparent);
  border-radius: 4px;
}

.fv-table--scroll-active :deep(.v-table__wrapper)::-webkit-scrollbar {
  width: 8px; /* 竖轨：滚动中开启 */
  height: 0;
}

/* 自绘横向滚动条：轨=可拖/可点区（右缘 marginRight 让出操作列宽，横轨永不穿到操作列下方）；
   光标一律默认箭头（用户定稿 2026-10-18：不改为手势），拖拽功能靠 pointer 事件而非 cursor 提示 */
.fv-table__xbar {
  position: relative;
  flex: 0 0 auto;
  height: 10px;
  margin: 2px 8px 6px;
}

.fv-table__xbar-thumb {
  position: absolute;
  top: 1px;
  left: 0;
  height: 8px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--vui-text) 30%, transparent);
}

.fv-table__xbar-thumb:hover {
  background: color-mix(in srgb, var(--vui-text) 45%, transparent);
}

.fv-table :deep(thead th) {
  position: sticky;
  top: 0;
  z-index: 1;
  /* 吸顶底色与表头深灰一致（防行内容透出） */
  background: color-mix(in srgb, var(--vui-text) 14%, var(--vui-bg-container));
}

/* 单选选中行（2026-10-20 改版，同日与侧栏菜单统一）：整行淡主题色底——与菜单选中同配方
   primary 10% 透明叠于容器底（明暗双主题自适应）；文字回归常规主题令牌色（随深浅联动，
   不再强制主题绿）；首格保留 5px 主题色竖条；悬停不变底色（见 main.css 全局段）；
   操作列=sticky 末列，自带不透明微异底色，天然不随行底色染色（用户定稿：action 列底色不变） */
.fv-table :deep(tr.fv-row--selected) {
  background: color-mix(in srgb, var(--vui-primary) 10%, transparent);
}

.fv-table :deep(tr.fv-row--selected td:first-child) {
  box-shadow: inset 5px 0 0 var(--vui-primary);
}

/* 分页条：紧凑单行（高度 ~40px） */
.fv-table__footer {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
}

.fv-table__total {
  margin-right: 8px;
  white-space: nowrap;
}

.fv-table__size {
  flex: 0 0 auto;
  width: 120px;
  margin-right: 8px;
  /* 分页条 select 无 label：清零 tokens.css 为「Label 在上」预留的 24px 顶部内边距，
     否则可见字段盒被压到根盒底部，整行视觉低半格（2026-10-15 修复水平中线不对齐） */
  padding-top: 0;
}

.fv-table__pages {
  display: flex;
  gap: 2px;
}

.fv-table__page {
  min-width: 28px;
  padding: 0 4px;
  font-variant-numeric: tabular-nums;
}
</style>
