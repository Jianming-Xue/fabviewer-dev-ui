<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ComponentPublicInstance } from 'vue'

import FvIconButton from './FvIconButton.vue'

/**
 * 行式字符串列表编辑器（Fv 族，2026-11-09 System Misc 首抽；**2026-11-10 按用户原定设计重写**）：
 * **固定高度无表头列表**（类表格：边框圆角容器 + 行间发丝线 + 内部滚动，`height` 收口）；
 * 行态二态机——**固化行**（只读文本单行省略）与**编辑行**（**行内裸 input**，非 FvTextInput/v-text-field，
 * 2026-11-10 用户定稿）：
 * - 固化行行尾两图标：**编辑**（fa-pen 信息蓝）回编辑态（草稿=原文、**焦点自动落入行内输入框**免二次点击，
 *   2026-11-10 用户定稿）、**删除**（fa-trash 灰、无确认）即删即同步；
 * - 编辑行行尾**提交**（fa-check 主题绿**描粗一档** text-stroke、Enter 同效）把键入文字固化、行转只读；
 *   空文本提交 no-op；**焦点离开自动取消编辑**回只读显示（blur 即弃草稿；新增空白行 blur 整行回收）——
 *   操作图标钮 `@mousedown.prevent` 防点钮先触发 blur 把编辑态撤掉（提交/删除钮点不到的经典坑）；
 * - **末行常驻添加行**（占满全宽、加号图标**居中**普通深灰、**浅灰底**与内容行区分，2026-11-10 用户定稿）：
 *   点击在**最下面**新增一个编辑态空白行并滚到底+自动聚焦；
 * - 行间发丝线**每行都有下边框、末行无条件保留**（2026-11-10 用户两度报缺，含查看态无添加行场景）；
 * - 三钮各自 prop 门控：`addable` / `editable` / `deletable`；**既无编辑又无删除时整个操作列隐藏**
 *   （行文本吃满全宽）；`disabled` = 只读态（三钮全隐、操作列隐藏、添加行隐藏）；
 * - **单选（2026-11-10 新增）**：`selectable` 门控——开启后固化行整行可点选/再点取消（FvTable single 同口径），
 *   选中态 `v-model:selected`（string|null，按值匹配、外部重播种不丢）+ **`select` 自定义选中事件**
 *   （载荷=选中值、取消=null，调用方自行挂钩）；选中行底色走 **FvTable 单选同款**（主色 10% 叠容器底 +
 *   左缘 3px 主色竖条 inset 阴影不位移）；编辑行不参与点选（输入/操作优先），操作列点击不冒泡触发选；
 * - **自定义事件四件套**（2026-11-10 用户定稿）：`select`（选中/反选 null）+ `add`（新增行提交固化）+
 *   `edit`（固化行改后重提交）+ `remove`（固化行删除；空白编辑行回收/取消不抛）——均在出参同步**之后**抛，
 *   调用方事件回调里读 v-model 即最新态；
 * - v-model string[] = **固化行**集合（编辑行草稿不入出参），提交/删除时同步；`maxRows` 到顶隐藏添加行；
 * - **外部变更自动重播种**：v-model 被外部改写成与「最近一次本组件出参」不同的内容时固化行重建
 *   （快照对比防自激回环；在编草稿丢弃属预期）——跨页签/跨 Map key 复用实例不串染（2026-11-09 实测坑）。
 * 消费点：System Misc 编辑弹窗 Json List 页签、模块件 SystemMiscJsonMapEditor（modules/config/components/）右列值区。
 */
const props = withDefaults(
  defineProps<{
    disabled?: boolean
    /** 添加钮门控（末行添加行显隐） */
    addable?: boolean
    /** 编辑钮门控 */
    editable?: boolean
    /** 删除钮门控 */
    deletable?: boolean
    /** 行内输入字符上限 */
    maxlength?: number
    /** 行数上限（含编辑行）；到顶隐藏添加行 */
    maxRows?: number
    /** 列表固定高度（CSS 长度；类表格容器内部滚动） */
    height?: string
    /** 单选门控：开启后固化行整行点选/再点取消，选中态经 v-model:selected + select 事件外抛 */
    selectable?: boolean
    /** 字段标题（列表盒之上，13px 次要色，FvTextInput label 同档；空=不渲染标题行） */
    label?: string
    /** 提示词文案（经问号图标 tooltip 展示，口径同 FvTextInput hint） */
    hint?: string
    /** 带提示词开关：true 且 hint 非空时 label 后显示问号图标 */
    showHint?: boolean
  }>(),
  {
    disabled: false,
    addable: true,
    editable: true,
    deletable: true,
    maxlength: undefined,
    maxRows: undefined,
    height: '240px',
    selectable: false,
    label: undefined,
    hint: undefined,
    showHint: false,
  },
)

const model = defineModel<string[]>({ required: true })
/** 单选选中值（按值匹配；未绑 v-model:selected 时组件内自持） */
const selected = defineModel<string | null>('selected', { default: null })
/** 自定义事件四件套（2026-11-10 用户定稿）：select 选中/反选（null）；add/edit/remove 均在**出参同步之后**
 *  抛（调用方在事件里读 v-model 已是最新态）——SystemMiscJsonMapEditor 靠这组事件驱动 Map 增删改 */
const emit = defineEmits<{
  select: [value: string | null]
  /** 新增行提交固化（原空白行落名） */
  add: [value: string]
  /** 固化行改后重新提交固化 */
  edit: [value: string]
  /** 固化行删除（空白编辑行回收/取消不抛——那两路本就不在出参里） */
  remove: [value: string]
}>()
const { t } = useI18n()

let seed = 0
interface Row {
  id: number
  /** 固化文本（编辑行期间保持提交前原值，提交时由 draft 覆盖） */
  text: string
  editing: boolean
  /** 编辑态键入草稿 */
  draft: string
}
const rows = ref<Row[]>(model.value.map((text) => ({ id: seed++, text, editing: false, draft: '' })))

const bodyEl = ref<HTMLElement | null>(null)

/** 操作列显隐：既无编辑又无删除（或只读）= 整列隐藏（用户定稿） */
const showOps = computed(() => !props.disabled && (props.editable || props.deletable))
/** 末行添加行：addable 门控 + 只读隐 + maxRows 到顶隐 */
const showAdd = computed(
  () => !props.disabled && props.addable && (props.maxRows === undefined || rows.value.length < props.maxRows),
)

/** 出参同步：只含固化行。lastEmitted 快照供外部改写判别（watch 到同快照 = 自己的 emit 回流，跳过重播种） */
let lastEmitted = JSON.stringify(model.value)
function sync() {
  const next = rows.value.filter((r) => !r.editing).map((r) => r.text)
  lastEmitted = JSON.stringify(next)
  model.value = next
}

/** 外部改写（切页签/切选中 key/重置草稿）→ 固化行重播种 */
watch(model, (v) => {
  const snap = JSON.stringify(v)
  if (snap === lastEmitted) return
  lastEmitted = snap
  rows.value = v.map((text) => ({ id: seed++, text, editing: false, draft: '' }))
})

/** 行内 input 元素登记（ref 回调）：供编辑/添加后自动聚焦（2026-11-10 用户定稿：点编辑钮
 *  焦点直接落在输入框，免二次点击） */
const inputEls = new Map<number, HTMLInputElement>()
function setInputRef(id: number) {
  return (el: Element | ComponentPublicInstance | null) => {
    if (el instanceof HTMLInputElement) inputEls.set(id, el)
    else inputEls.delete(id)
  }
}

/** 添加：最下面新增编辑态空白行 + 滚到底 + 自动聚焦（末行添加行永远可见，滚动仅为输入行让位） */
async function add() {
  const row: Row = { id: seed++, text: '', editing: true, draft: '' }
  rows.value.push(row)
  await nextTick()
  if (bodyEl.value) bodyEl.value.scrollTop = bodyEl.value.scrollHeight
  inputEls.get(row.id)?.focus()
}

/** 提交固化：空文本 no-op（行留编辑态）；非空则覆盖 text 转只读、同步出参，
 *  并按「原空白行=新增 / 原固化行=修改」抛对应自定义事件 */
function submit(row: Row) {
  if (row.draft === '') return
  const isNew = row.text === ''
  row.text = row.draft
  row.editing = false
  sync()
  if (isNew) emit('add', row.text)
  else emit('edit', row.text)
}

/** blur 自动取消编辑（用户定稿 2026-11-10）：弃草稿回只读显示；新增空白行（固化文本恒空——
 *  空提交 no-op 保证）整行回收。操作钮 mousedown.prevent 保证点钮不先触发本取消 */
function cancelEdit(row: Row) {
  if (!row.editing) return
  if (row.text === '') {
    rows.value = rows.value.filter((r) => r.id !== row.id)
    return
  }
  row.editing = false
}

/** 编辑：行回编辑态，草稿=固化原文，焦点自动落入行内输入框（2026-11-10 用户定稿） */
async function edit(row: Row) {
  row.editing = true
  row.draft = row.text
  await nextTick()
  inputEls.get(row.id)?.focus()
}

function remove(row: Row) {
  const committed = row.text !== '' // 空白编辑行本就不在出参里，删除不抛事件
  rows.value = rows.value.filter((r) => r.id !== row.id)
  sync()
  if (committed) emit('remove', row.text)
}

/** 单选点选（selectable 门控）：再点同行取消（FvTable single 同口径）；编辑行不参与（输入/操作优先），
 *  操作列（编辑/删除/提交钮）点击不冒泡触发选 */
function onRowClick(row: Row, e: MouseEvent) {
  if (!props.selectable || row.editing) return
  if ((e.target as HTMLElement).closest('.fv-str-list__ops')) return
  const next = selected.value === row.text ? null : row.text
  selected.value = next
  emit('select', next)
}
</script>

<template>
  <div class="fv-str-list-wrap">
    <!-- 字段标题行（2026-11-11 补：告警/监控配置多列表字段需标识）：label + 问号 hint tooltip，
         口径同 FvTextInput（13px 次要色 / vui-field-hint-tip） -->
    <div v-if="label || (showHint && hint)" class="fv-str-list__head">
      <span v-if="label" class="fv-str-list__label">{{ label }}</span>
      <v-tooltip v-if="showHint && hint" :text="hint" content-class="vui-table-tip vui-field-hint-tip">
        <template #activator="{ props: tipProps }">
          <v-icon v-bind="tipProps" icon="fas fa-circle-question" size="13" class="fv-str-list__hint-icon" />
        </template>
      </v-tooltip>
    </div>
    <div
      class="fv-str-list"
      :class="{ 'fv-str-list--selectable': selectable }"
      :style="{ height }"
    >
    <!-- 行区（内部滚动；空态占位一行） -->
    <div ref="bodyEl" class="fv-str-list__body">
      <div v-if="!rows.length" class="fv-str-list__empty">{{ t('common.empty') }}</div>
      <div
        v-for="row in rows"
        :key="row.id"
        class="fv-str-list__row"
        :class="{ 'fv-str-list__row--selected': selectable && !row.editing && row.text === selected }"
        @click="onRowClick(row, $event)"
      >
        <!-- 编辑行：行内裸 input（用户定稿不用 FvTextInput）+ 提交（Enter 同效）；blur 自动取消编辑 -->
        <input
          v-if="row.editing"
          :ref="setInputRef(row.id)"
          v-model="row.draft"
          class="fv-str-list__input"
          type="text"
          :maxlength="maxlength"
          @keydown.enter.prevent="submit(row)"
          @blur="cancelEdit(row)"
        />
        <!-- 固化行：只读文本单行省略（title 悬停读全文） -->
        <span v-else class="fv-str-list__text" :title="row.text">{{ row.text }}</span>
        <!-- 操作列：编辑行=提交(+删除)、固化行=编辑(+删除)；整列显隐见 showOps。
             mousedown.prevent：防点钮先触发 input blur 把编辑态撤掉 -->
        <span v-if="showOps" class="fv-str-list__ops">
          <FvIconButton
            v-if="row.editing"
            size="24"
            class="fv-str-list__submit"
            :label="t('common.confirm')"
            @mousedown.prevent
            @click="submit(row)"
          >
            <!-- 勾形加粗（2026-11-10 用户定稿「线条加粗点看着明显」）：FA 字形经 text-stroke 描粗 -->
            <v-icon icon="fas fa-check" size="14" class="fv-str-list__check" />
          </FvIconButton>
          <FvIconButton
            v-else-if="editable && !disabled"
            icon="fas fa-pen"
            :icon-size="12"
            size="24"
            class="fv-str-list__edit"
            :label="t('common.edit')"
            @click="edit(row)"
          />
          <FvIconButton
            v-if="deletable && !disabled"
            icon="fas fa-trash"
            :icon-size="12"
            size="24"
            class="fv-str-list__remove"
            :label="t('common.delete')"
            @mousedown.prevent
            @click="remove(row)"
          />
        </span>
      </div>
    </div>
    <!-- 末行添加行：占满全宽、加号居中（用户定稿） -->
    <button v-if="showAdd" type="button" class="fv-str-list__add" :aria-label="t('common.add')" @click="add">
      <v-icon icon="fas fa-plus" size="14" />
    </button>
    </div>
  </div>
</template>

<style scoped>
/* 字段标题行（2026-11-11）：label 风格与 FvTextInput label 同档（13px/次要色） */
.fv-str-list__head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 4px 3px;
}

.fv-str-list__label {
  font-size: 13px;
  line-height: 18px;
  color: var(--vui-text-secondary);
}

.fv-str-list__hint-icon {
  color: var(--vui-text-placeholder);
  cursor: help;
}

/* 类表格容器：固定高度 + 边框圆角 + 内部滚动（无表头） */
.fv-str-list {
  display: flex;
  flex-direction: column;
  min-width: 0;
  border: 1px solid var(--vui-border);
  border-radius: var(--vui-radius-s);
  overflow: hidden;
  background: var(--vui-bg-container);
}

.fv-str-list__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}

/* 行间发丝线每行都有、**末行无条件保留**（2026-11-10 用户两度报缺，含查看态无添加行场景；
   与容器底框相邻的双线观感经用户确认可接受，不再做让位例外） */
.fv-str-list__row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  padding: 2px 8px;
  border-bottom: 1px solid var(--vui-split);
}

/* 单选门控开启：固化行整行可点 */
.fv-str-list--selectable .fv-str-list__row {
  cursor: pointer;
}

/* 选中行底色 = FvTable single 同款（2026-10-20 定稿口径）：主色 10% 叠容器底 + 左缘 3px 主色竖条
   （inset 阴影实现不位移）；文字保持常规色不染主色 */
.fv-str-list__row--selected,
.fv-str-list__row--selected:hover {
  background: color-mix(in srgb, var(--vui-primary) 10%, var(--vui-bg-container));
  box-shadow: inset 3px 0 0 var(--vui-primary);
}

/* 固化行文本：单行省略（类表格单元格） */
.fv-str-list__text {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 13px;
  line-height: 32px;
  color: var(--vui-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 编辑态行内裸 input（用户定稿 2026-11-10：不走 FvTextInput/v-text-field） */
.fv-str-list__input {
  flex: 1 1 auto;
  min-width: 0;
  height: 28px;
  padding: 0 8px;
  font-size: 13px;
  color: var(--vui-text);
  background: var(--vui-bg-container);
  border: 1px solid var(--vui-border);
  border-radius: var(--vui-radius-xs);
  outline: none;
  transition: border-color 0.15s ease;
}

.fv-str-list__input:focus {
  border-color: var(--vui-primary);
}

.fv-str-list__ops {
  flex: 0 0 auto;
  display: inline-flex;
  gap: 2px;
}

/* 提交=主题绿 / 编辑=信息蓝 / 删除=灰（SystemMiscJsonMapEditor key 图标同族口径）；
   提交勾描粗一档（text-stroke 作用于 FA 字形，2026-11-10 用户定稿） */
.fv-str-list__submit {
  color: var(--vui-primary);
}

.fv-str-list__check {
  -webkit-text-stroke: 0.8px currentColor;
}

.fv-str-list__edit {
  color: var(--vui-info);
}

.fv-str-list__remove {
  color: var(--vui-text-secondary);
}

.fv-str-list__empty {
  padding: 16px 0;
  text-align: center;
  font-size: 12px;
  color: var(--vui-text-placeholder);
}

/* 末行添加行：占满全宽、加号居中、浅灰底与内容行区分（2026-11-10 用户定稿）；
   与内容行的分隔由末行下边框承担（本行不再叠 border-top 防双线） */
.fv-str-list__add {
  flex: 0 0 auto;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 6px 0;
  border: none;
  background: var(--vui-fill-alter);
  /* 加号普通深灰（2026-11-10 用户定稿：不用主题色） */
  color: var(--vui-text-secondary);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.fv-str-list__add:hover {
  background: var(--vui-split);
}
</style>
