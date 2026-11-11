<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import FvInteractiveDialog from '@/shared/dialog/FvInteractiveDialog.vue'
import { useModalDialog } from '@/shared/dialog/useModalDialog'
import FvTextInput from '@/shared/components/FvTextInput.vue'
import FvSwitch from '@/shared/components/FvSwitch.vue'
import FvTab from '@/shared/components/FvTab.vue'
import FvStringListEditor from '@/shared/components/FvStringListEditor.vue'
import SystemMiscJsonMapEditor from '../components/SystemMiscJsonMapEditor.vue'
import { showOpError } from '@/shared/api/opError'
import FvNormalButton from '@/shared/components/FvNormalButton.vue'
import FvPrimaryButton from '@/shared/components/FvPrimaryButton.vue'
import { updateSystemMiscValue } from '@/api/telemetry-hub/requests/systemMiscRequest'

import type {
  ChangeSystemMiscValueRo,
  SystemMiscDto,
  SystemMiscValue,
} from '@/api/telemetry-hub/types/systemMiscTypes'

/**
 * System Misc 编辑弹窗（模块5 · 02 §3.5，2026-11-09 新建；FvInteractiveDialog 体系，
 * 经 openInteractiveDialog 打开，提交收口本组件——ServerHangReasonConfigEditDialog 同定式：
 * Confirm 即 PUT、成功 emit('resolve', 出参 Dto) + 关窗、失败 showOpError 留窗可重试）。
 * 结构（自上而下）：
 * - FvTab 两页签 Value / Default Value（默认 Value；**Boolean 的 DefaultValue 页签只读**，
 *   且 Boolean 提交体不带 defaultValue——后端忽略，文档 §5.2）；
 * - Json 形态**进弹窗自动判定、用户不可改**（2026-11-10 用户定稿单选退役）：value 非空按其形态
 *   （数组=List/对象=Map）、value 空回落 defaultValue 形态、再空默认 List；v-show 双编辑器常驻，
 *   提交按判定形态换算（§3.5：List→string[]；Map 每 key 0 行→""、1 行→标量、>1 行→数组）；
 * - 控件按 valueType：Text=输入 ≤4000；Integer/Float=数字校验（草稿存字符串，提交 parse）；
 *   Boolean=FvSwitch；Json=FvStringListEditor / 模块件 SystemMiscJsonMapEditor（maxRows/maxKeys=100 顶层上限）；
 *   **输入框/开关行内 label 全退役**（页签+描述条已足定位），控件之上统一挂**灰底描述条**（item 描述，
 *   Value/DefaultValue 双页签共见；描述为空不渲染）。
 * 页签只渲染一套控件（绑当前页签草稿的 computed 代理），隐藏页签草稿在 Confirm 时手动补校验
 * （Integer/Float 正则、Text 长度、Json 100 项/序列化 4000 字）——不过关则跳到该页签并红字提示。
 * Cancel 有未提交改动先弹「放弃修改？」确认（§3.5）；基座 X/Esc 直关不拦（仓库既有弹窗同口径）。
 * **查看态 `view` prop（2026-11-10 用户定稿）**：value/defaultValue 的编辑与查看共用本弹窗
 * （SystemMiscJsonViewDialog 同日退役，Json 卡片「…」钮改开本弹窗 view 态）——隐藏提交钮、Cancel 换
 * Close 直关不提示；Text/Integer/Float 输入 disabled、Boolean 开关 disabled、List 编辑器增/改/删全取消、
 * Map 经 JsonMapEditor `disabled` 收口（左列禁增删、**Key 选择保留**供浏览换值、右列三钮全隐）；标题切 viewTitle。
 */
/** `view` = 查看态（2026-11-10 用户定稿：value/defaultValue 的编辑与查看共用本弹窗，Json 查看弹窗退役）——
 *  隐藏提交钮、Cancel 换 Close 直关不提示；String 编辑器增/改/删全取消（Map 的 Key 选择保留供浏览换值） */
const props = withDefaults(defineProps<{ row: SystemMiscDto; view?: boolean }>(), { view: false })

const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ resolve: [saved: SystemMiscDto] }>()

const { t } = useI18n()
const dialog = useModalDialog()
const formRef = ref()
const saving = ref(false)
const formError = ref('')

type TabKey = 'value' | 'default'

/* ===== 初始草稿播种（wire 原生值 → 编辑器形态） ===== */

const toStr = (v: SystemMiscValue): string => (v == null ? '' : String(v))

/** Json → List 草稿：仅数组形态可播；其余留空（未选中的形态从无草稿起步） */
function toListDraft(v: SystemMiscValue): string[] {
  return Array.isArray(v) ? [...v] : []
}

/** Json → Map 草稿：对象形态归一 Record<string,string[]>（标量值升单元素数组）；其余留空 */
function toMapDraft(v: SystemMiscValue): Record<string, string[]> {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return Object.fromEntries(
      Object.entries(v as Record<string, string | string[]>).map(([k, x]) => [
        k,
        typeof x === 'string' ? [x] : [...x],
      ]),
    )
  }
  return {}
}

/** Json 形态判定（2026-11-10 用户定稿：**单选退役，进弹窗按数据形态自动定、用户不可改**）：
 *  value 非空按其形态（数组=List/对象=Map）；value 空（[]/{} /null）回落 defaultValue 形态；再空默认 List */
function detectJsonForm(v: SystemMiscValue): 'List' | 'Map' | null {
  if (Array.isArray(v)) return v.length ? 'List' : null
  if (v && typeof v === 'object') return Object.keys(v).length ? 'Map' : null
  return null
}
const initialForm: 'List' | 'Map' =
  detectJsonForm(props.row.value) ?? detectJsonForm(props.row.defaultValue) ?? 'List'

const drafts = reactive({
  text: { value: toStr(props.row.value), default: toStr(props.row.defaultValue) },
  num: { value: toStr(props.row.value), default: toStr(props.row.defaultValue) },
  boolValue: props.row.value === true,
  list: { value: toListDraft(props.row.value), default: toListDraft(props.row.defaultValue) },
  map: { value: toMapDraft(props.row.value), default: toMapDraft(props.row.defaultValue) },
})
const jsonForm = ref<'List' | 'Map'>(initialForm)

/** 脏检查基线：Cancel 时对比（草稿或形态任一变动 = 有未提交修改） */
const snapshot = (): string => JSON.stringify({ drafts, jsonForm: jsonForm.value })
const initialSnapshot = snapshot()

/* ===== 页签（FvTab model 为 string，读写经 tab 收窄） ===== */

const activeTab = ref('value')
const tab = computed<TabKey>(() => (activeTab.value === 'default' ? 'default' : 'value'))
const tabItems = computed(() => [
  { title: t('config.misc.value'), value: 'value' },
  { title: t('config.misc.defaultValue'), value: 'default' },
])


/* ===== 各型控件的页签代理（单套控件绑当前页签草稿） ===== */

const textModel = computed<string>({
  get: () => drafts.text[tab.value],
  set: (v) => {
    drafts.text[tab.value] = v
  },
})
const numModel = computed<string>({
  get: () => drafts.num[tab.value],
  set: (v) => {
    drafts.num[tab.value] = v
  },
})
const boolModel = computed<boolean>({
  // DefaultValue 页签只读展示库内 defaultValue（Boolean 的 defaultValue 不可空且页面不可编，§四）
  get: () => (tab.value === 'value' ? drafts.boolValue : props.row.defaultValue === true),
  set: (v) => {
    if (tab.value === 'value') drafts.boolValue = v
  },
})
const listModel = computed<string[]>({
  get: () => drafts.list[tab.value],
  set: (v) => {
    drafts.list[tab.value] = v
  },
})
const mapModel = computed<Record<string, string[]>>({
  get: () => drafts.map[tab.value],
  set: (v) => {
    drafts.map[tab.value] = v
  },
})

const isNum = computed(() => props.row.valueType === 'Integer' || props.row.valueType === 'Float')
const INT_RE = /^-?\d+$/
const FLOAT_RE = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/

/** 当前页签输入框的即时规则（v-form 校验仅覆盖在场控件；双页签兜底见 numErrorOf） */
const numRules = computed(() => {
  if (props.row.valueType === 'Integer') {
    return [(v: string) => !v || INT_RE.test(v) || t('config.misc.validation.integer')]
  }
  return [(v: string) => !v || FLOAT_RE.test(v) || t('config.misc.validation.float')]
})

function numErrorOf(tk: TabKey): string {
  const s = drafts.num[tk]
  if (s === '') return ''
  if (props.row.valueType === 'Integer' && !INT_RE.test(s)) return t('config.misc.validation.integer')
  if (props.row.valueType === 'Float' && !FLOAT_RE.test(s)) return t('config.misc.validation.float')
  return ''
}

/* ===== 提交换算（§3.5） ===== */

/** Json 草稿 → wire 值：List=string[]（空置 []）；Map 每 key 0 行→""、1 行→标量、>1 行→数组（0 key 整体置 []）。
 *  返回型收窄为 Json 两形态（非全 SystemMiscValue），供 validateJson 的 Object.keys 直接用 */
function buildJson(tk: TabKey): string[] | Record<string, string | string[]> {
  if (jsonForm.value === 'List') {
    const arr = drafts.list[tk]
    return arr.length ? [...arr] : []
  }
  const src = drafts.map[tk]
  const keys = Object.keys(src)
  if (!keys.length) return []
  const out: Record<string, string | string[]> = {}
  for (const k of keys) {
    const vs = src[k] ?? []
    out[k] = vs.length === 0 ? '' : vs.length === 1 ? (vs[0] ?? '') : [...vs]
  }
  return out
}

function buildValue(tk: TabKey): SystemMiscValue {
  switch (props.row.valueType) {
    case 'Boolean':
      return drafts.boolValue // 仅 value 页签可编；defaultValue 不入提交体（后端忽略）
    case 'Text':
      return drafts.text[tk] === '' ? null : drafts.text[tk]
    case 'Integer':
      return drafts.num[tk] === '' ? null : parseInt(drafts.num[tk], 10)
    case 'Float':
      return drafts.num[tk] === '' ? null : Number(drafts.num[tk])
    case 'Json':
      return buildJson(tk)
  }
}

/** Json 双页签硬校验（§四）：顶层 ≤100 项、序列化 ≤4000 字符；不过关跳页签+红字 */
function validateJson(): boolean {
  for (const tk of ['value', 'default'] as const) {
    const built = buildJson(tk)
    const top = Array.isArray(built) ? built.length : Object.keys(built).length
    if (top > 100) {
      activeTab.value = tk
      formError.value = t('config.misc.validation.jsonTooMany')
      return false
    }
    if (JSON.stringify(built).length > 4000) {
      activeTab.value = tk
      formError.value = t('config.misc.validation.jsonTooLong')
      return false
    }
  }
  return true
}

async function save() {
  if (saving.value) return
  formError.value = ''
  const { valid } = await formRef.value.validate()
  if (!valid) return
  // 隐藏页签草稿手动补校验（v-form 只覆盖在场控件）
  if (props.row.valueType !== 'Boolean') {
    for (const tk of ['value', 'default'] as const) {
      const ne = numErrorOf(tk)
      if (ne) {
        activeTab.value = tk
        formError.value = ne
        return
      }
      if (props.row.valueType === 'Text' && drafts.text[tk].length > 4000) {
        activeTab.value = tk
        formError.value = t('validation.lengthLimit', { n: 4000 })
        return
      }
    }
  }
  if (props.row.valueType === 'Json' && !validateJson()) return

  saving.value = true
  const input: ChangeSystemMiscValueRo = { item: props.row.item, value: buildValue('value') }
  // Boolean 型不带 defaultValue（文档 §5.2：后端忽略；该型 defaultValue 不可空且页面不可编）
  if (props.row.valueType !== 'Boolean') input.defaultValue = buildValue('default')
  try {
    const saved = await updateSystemMiscValue(input)
    emit('resolve', saved)
    open.value = false
  } catch (e) {
    // 传输失败已由全局 Dialog 呈现；业务失败（校验不符即拒）Toast，弹窗保留可改可重试
    showOpError(e)
  } finally {
    saving.value = false
  }
}

/** Cancel：有未提交修改先弹「放弃修改？」确认（§3.5）；无修改直关；查看态直关不提示 */
async function cancel() {
  if (props.view) {
    open.value = false
    return
  }
  if (snapshot() !== initialSnapshot) {
    const discard = await dialog.confirm({
      title: t('config.misc.confirm.discardTitle'),
      message: t('config.misc.confirm.discardMsg'),
      okText: t('common.confirm'),
    })
    if (!discard) return
  }
  open.value = false
}
</script>

<template>
  <FvInteractiveDialog v-model="open" center-title :max-width="800" :body-scroll="false">
    <template #title>
      <span>{{ view ? t('config.misc.viewTitle') : t('config.misc.editTitle') }}</span>
      <span class="vui-mono sm-edit__title-item">{{ row.item }}</span>
    </template>

    <!-- 填充链（2026-11-11 用户定稿：滚动限定在页签内容区，Tab 条恒显不随内容滚走）：
         基座 bodyScroll=false → 正文变 flex 列不自滚，本层接管满高、表单区自挂滚动 -->
    <div class="sm-edit">
    <!-- 顶部只读四字段退役（2026-11-10 用户定稿）：Item/Category/Description/ValueType 均不可编辑、
         不入提交体，展示无意义——item 名已由标题 mono 副题承载，其余不显 -->
    <FvTab v-model="activeTab" :items="tabItems" class="sm-edit__tabs" />

    <v-form ref="formRef" class="sm-edit__body" @submit.prevent="save">
      <!-- 灰底描述条（2026-11-10 用户定稿）：Json/输入框/开关**之上**统一挂 item 描述，
           Value/DefaultValue 两页签共用控件集故一条覆盖双页签；描述为空不渲染 -->
      <div v-if="row.description" class="sm-edit__desc">{{ row.description }}</div>
      <!-- Text：≤4000 字符（maxlength 硬顶 + counter）；label 退役（2026-11-10 用户定稿：页签+描述条已足定位） -->
      <FvTextInput
        v-if="row.valueType === 'Text'"
        v-model="textModel"
        counter="4000"
        :maxlength="4000"
        :disabled="view"
      />
      <!-- Integer / Float：正则即时校验（双页签兜底在 save）；label 同退役 -->
      <FvTextInput
        v-else-if="isNum"
        v-model="numModel"
        :rules="numRules"
        :disabled="view"
      />
      <!-- Boolean：Value 页签可编；DefaultValue 页签只读展示库内值；行内 label 同退役 -->
      <div v-else-if="row.valueType === 'Boolean'" class="sm-edit__bool">
        <FvSwitch v-model="boolModel" :disabled="view || tab === 'default'" />
      </div>
      <!-- Json：单选已上移页签之上（同时控制两页签形态）；v-show 双编辑器常驻保草稿。
           页签切换时 listModel/mapModel 代理换绑草稿，编辑器组件内部 watch 自动重播种
           （2026-11-09 实测坑：两页签/两 key 复用实例拿旧行态互相污染，契约已收进组件）；
           Map 编辑器=模块件 SystemMiscJsonMapEditor（2026-11-10 自 shared/FvKeyValueEditor 降级迁入） -->
      <template v-else>
        <!-- 查看态：String 编辑器增/改/删全取消（List 三钮门控置 false 后操作列自动隐藏）；
             Map 经 JsonMapEditor disabled 收口（左列禁增删、**Key 选择保留**、右列三钮全隐） -->
        <div v-show="jsonForm === 'List'" class="sm-edit__json">
          <FvStringListEditor
            v-model="listModel"
            :max-rows="100"
            :addable="!view"
            :editable="!view"
            :deletable="!view"
          />
        </div>
        <div v-show="jsonForm === 'Map'" class="sm-edit__json">
          <SystemMiscJsonMapEditor v-model="mapModel" :max-keys="100" :disabled="view" />
        </div>
      </template>

      <!-- 跨页签校验错误（Integer/Float/Text/Json 硬限）：红字提示，页签已自动跳到出错处 -->
      <p v-if="formError" class="sm-edit__error">{{ formError }}</p>
    </v-form>
    </div><!-- /.sm-edit -->

    <!-- 查看态：隐藏提交、单 Close 直关不提示（2026-11-10 用户定稿） -->
    <template #actions>
      <FvNormalButton v-if="view" @click="open = false">{{ t('common.close') }}</FvNormalButton>
      <template v-else>
        <FvNormalButton @click="cancel">{{ t('common.cancel') }}</FvNormalButton>
        <FvPrimaryButton :loading="saving" @click="save">{{ t('common.confirm') }}</FvPrimaryButton>
      </template>
    </template>
  </FvInteractiveDialog>
</template>

<style scoped>
.sm-edit__title-item {
  margin-left: 8px;
  font-size: 12px;
  color: var(--vui-text-secondary);
}

/* 灰底描述条（控件之上、双页签共见，2026-11-10 用户定稿） */
.sm-edit__desc {
  margin: 0 3px 8px;
  padding: 6px 10px;
  border-radius: var(--vui-radius-s);
  background: var(--vui-fill-alter);
  font-size: 12px;
  line-height: 18px;
  color: var(--vui-text-secondary);
}

/* 填充链（2026-11-11 用户定稿：滚动限定在页签内容区）：基座 bodyScroll=false 下
   根层满高占住正文，Tab 条 flex:none 恒显，表单区 flex:1 内部滚动 */
.sm-edit {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.sm-edit__tabs {
  flex: none;
  margin: 4px 3px 0;
}

.sm-edit__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-top: 8px;
}

.sm-edit__bool {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 3px;
}

.sm-edit__json {
  padding: 4px 3px 0;
}

.sm-edit__error {
  margin: 8px 3px 0;
  font-size: 12px;
  color: var(--vui-error);
}
</style>
