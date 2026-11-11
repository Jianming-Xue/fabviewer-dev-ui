<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { showOpError } from '@/shared/api/opError'
import { useModalDialog } from '@/shared/dialog/useModalDialog'
import { useAlertToast } from '@/shared/toast/useAlertToast'
import { openInteractiveDialog } from '@/shared/dialog/openInteractiveDialog'
import FvTable from '@/shared/components/FvTable.vue'
import FvTableHeader from '@/shared/components/FvTableHeader.vue'
import FvCard from '@/shared/components/FvCard.vue'
import FvAlertStrip from '@/shared/components/FvAlertStrip.vue'
import FvTextInput from '@/shared/components/FvTextInput.vue'
import FvSearchButton from '@/shared/components/FvSearchButton.vue'
import FvNormalButton from '@/shared/components/FvNormalButton.vue'
import FvEllipsisText from '@/shared/components/FvEllipsisText.vue'
import FvMultiValueCell from '@/shared/components/FvMultiValueCell.vue'
import AlarmPriorityBadge from '../components/AlarmPriorityBadge.vue'
import LogMonitorCfgEditDialog from '../dialogs/LogMonitorCfgEditDialog.vue'
import {
  deleteLogMonitorCfg,
  fetchLogMonitorCfgDetail,
  fetchLogMonitorCfgPage,
} from '@/api/telemetry-hub/requests/logMonitorCfgRequest'

import type { LogMonitorCfgDto } from '@/api/telemetry-hub/types/logMonitorCfgTypes'

/**
 * 模块2 · 01 MES 日志监控配置（2026-11-10 新建）：关键字告警规则 CRUD 页。
 * 单列两卡（文档 §3.2）：上查询卡——单 keyword 输入（大小写不敏感子串模糊四列
 * item/description/environment/keyword，Enter=查询；无重置钮，清空再查=全量）；
 * 下表格卡——FvTable 服务端分页（env→item 升序归后端），工具行刷新+New（FvTable 定稿布局），
 * 操作列 编辑/删除。11 列（文档定序）：Item 粗体截断、Keyword 等宽、Description/三列表字段
 * 空值=空白单元格（2026-11-11 用户定稿：缺省不替换中划线，保持为空；FvMultiValueCell 全局定稿空=空白同口径）、
 * Priority 色标徽标（P1 红/P2 橙/P3 黄/P4 灰）。
 * 新增/编辑走 dialogs/LogMonitorCfgEditDialog（两 Tab，openInteractiveDialog 打开）：
 * 编辑先经 detail 接口取整条回填（NotFound→报错+重拉）；新增成功回第 1 页重拉、编辑成功就地换行；
 * 保存成功 toast「下次配置加载生效」（文档 §3.3）；删除 Warning 确认框（非立即生效+告警保留口径）。
 * 取数失败：FvAlertStrip 错误条+重试（ResultTable 同口径）。
 */
const { t } = useI18n()
const dialog = useModalDialog()
const toast = useAlertToast()

/* ===== 查询条件（点查询/Enter 才生效，输入过程不触发） ===== */
const keyword = ref('')
/** 搜索框焦点态：聚焦时隐藏框内 placeholder（2026-11-11 用户定稿） */
const searchFocused = ref(false)

/* ===== 表格区 ===== */
const rows = ref<LogMonitorCfgDto[]>([])
const pageContent = reactive({ total: 0, totalPage: 1, pageIndex: 1, pageSize: 20 })
const loading = ref(false)
const loadError = ref(false)
const selected = ref<LogMonitorCfgDto | null>(null)

async function loadPage(page = pageContent.pageIndex) {
  loading.value = true
  loadError.value = false
  try {
    const data = await fetchLogMonitorCfgPage(page, pageContent.pageSize, keyword.value.trim() || undefined)
    rows.value = data.data
    pageContent.total = data.totalSize
    pageContent.totalPage = data.totalPage
    pageContent.pageIndex = data.pageIndex
  } catch {
    // 错误条+重试承载（本页不弹全局 Dialog，05 §4.3 六件套口径）
    loadError.value = true
  } finally {
    loading.value = false
  }
}

onMounted(() => loadPage(1))

/** 分页回写重查（FvTable v-model 回写 pageIndex/pageSize，取数归消费方；换 pageSize 回第 1 页 FvTable 内部处理） */
watch(
  () => [pageContent.pageIndex, pageContent.pageSize] as const,
  () => loadPage(),
)

/** 查询钮/Enter：回第 1 页重查（已在第 1 页时 watch 不触发，手动拉） */
function onSearch() {
  if (pageContent.pageIndex !== 1) pageContent.pageIndex = 1
  else loadPage(1)
}

const sameKey = (a: LogMonitorCfgDto, b: LogMonitorCfgDto) => a.item === b.item && a.environment === b.environment

/* ===== 新增（FvTable insert → FvNewButton；文档 §3.3：成功后列表刷新到第 1 页，不走 FvTable 首行回显） ===== */
async function onInsert(): Promise<null> {
  const created = await openInteractiveDialog<{ row?: LogMonitorCfgDto }, LogMonitorCfgDto>(
    LogMonitorCfgEditDialog,
    {},
  )
  if (created) {
    toast.success(t('monitorAlarm.logMonitor.toast.saved'))
    if (pageContent.pageIndex !== 1) pageContent.pageIndex = 1
    else loadPage(1)
  }
  return null
}

/* ===== 编辑：先 detail 取整条（含 alarmCfg）回填弹窗；成功就地换行（文档 §3.3） ===== */
async function onEdit(row: LogMonitorCfgDto) {
  let detail: LogMonitorCfgDto
  try {
    detail = await fetchLogMonitorCfgDetail(row.item, row.environment)
  } catch (e) {
    // NotFound 等：提示后刷新列表（文档 §4.3-2 前端口径）
    showOpError(e)
    loadPage()
    return
  }
  const updated = await openInteractiveDialog<{ row?: LogMonitorCfgDto }, LogMonitorCfgDto>(
    LogMonitorCfgEditDialog,
    { row: detail },
  )
  if (!updated) return
  toast.success(t('monitorAlarm.logMonitor.toast.saved'))
  rows.value = rows.value.map((r) => (sameKey(r, updated) ? updated : r))
}

/* ===== 查看（2026-11-11 用户定稿）：与编辑同径先 detail 取整条（含 alarmCfg），
   开弹窗 view 态——全部控件禁用、底部去确认钮、页签可翻看 ===== */
async function onView(row: LogMonitorCfgDto) {
  let detail: LogMonitorCfgDto
  try {
    detail = await fetchLogMonitorCfgDetail(row.item, row.environment)
  } catch (e) {
    showOpError(e)
    loadPage()
    return
  }
  await openInteractiveDialog<{ row?: LogMonitorCfgDto; view?: boolean }, LogMonitorCfgDto>(
    LogMonitorCfgEditDialog,
    { row: detail, view: true },
  )
}

/* ===== 删除：Warning 确认框（非立即生效——待告警服务下次配置加载；已产生告警永久保留） ===== */
async function onDelete(row: LogMonitorCfgDto) {
  const okDel = await dialog.confirm({
    title: t('common.delete'),
    message: t('monitorAlarm.logMonitor.warn.deleteMsg'),
    okText: t('common.delete'),
    tone: 'warning',
  })
  if (!okDel) return
  try {
    await deleteLogMonitorCfg(row.item, row.environment)
    rows.value = rows.value.filter((r) => !sameKey(r, row))
    pageContent.total = Math.max(0, pageContent.total - 1)
    if (selected.value && sameKey(selected.value, row)) selected.value = null
  } catch (e) {
    showOpError(e)
  }
}

</script>

<template>
  <section class="lmc-page vui-fill">
    <!-- 查询卡（文档 §3.2：单 keyword 输入 + 查询钮，Enter=点查询；无环境筛选、无重置钮） -->
    <FvCard border class="lmc-query">
      <v-form class="lmc-query__form" @submit.prevent="onSearch">
        <!-- label 走 search.searchKeyword 专键（2026-11-11 用户定稿角色页同款式：
             域词+匹配字段+模糊匹配）；底边对齐靠表单 align-end + 搜索框外距归零（角色页定式）；
             **焦点态隐藏框内 placeholder**（同日用户定稿：聚焦时不显框内 Hint——label 已承载匹配范围
             说明，失焦回显 placeholder 供空态引导） -->
        <FvTextInput
          v-model="keyword"
          class="lmc-query__input"
          :label="t('monitorAlarm.logMonitor.search.searchKeyword')"
          prepend-icon="fas fa-search"
          clear
          :placeholder="searchFocused ? '' : t('monitorAlarm.logMonitor.search.placeholder')"
          @focus="searchFocused = true"
          @blur="searchFocused = false"
        />
        <FvSearchButton>{{ t('common.search') }}</FvSearchButton>
      </v-form>
    </FvCard>

    <!-- 表格卡：错误条（取数失败+重试）恒显于表格上方；表格内部滚动 -->
    <FvCard class="lmc-result">
      <FvAlertStrip v-if="loadError" kind="error" class="ma-4" :title="t('monitorAlarm.logMonitor.states.errorTitle')">
        <FvNormalButton size="small" color="error" variant="text" @click="loadPage()">
          {{ t('common.retry') }}
        </FvNormalButton>
      </FvAlertStrip>
      <div class="lmc-table">
        <FvTable
          v-model:page-index="pageContent.pageIndex"
          v-model:page-size="pageContent.pageSize"
          v-model:selected="selected"
          :data="rows"
          :loading="loading"
          :page-content="pageContent"
          :insert="onInsert"
          refresh
          select-mode="single"
          @refresh="loadPage()"
          @view="onView"
          @edit="onEdit"
          @delete="onDelete"
        >
          <FvTableHeader :title="t('monitorAlarm.logMonitor.columns.environment')" data-key="environment" />
          <!-- Item：粗体 + 30 字截断悬停全文（文档 §3.2） -->
          <FvTableHeader :title="t('monitorAlarm.logMonitor.columns.item')" data-key="item" header-type="custom">
            <template #default="{ item }">
              <span class="lmc-cell-item">
                <FvEllipsisText :text="(item as LogMonitorCfgDto).item" :max-chars="30" />
              </span>
            </template>
          </FvTableHeader>
          <!-- Description：溢出截断悬停全文；空=空白 -->
          <FvTableHeader :title="t('monitorAlarm.logMonitor.columns.description')" data-key="description" header-type="custom">
            <template #default="{ item }">
              <FvEllipsisText
                v-if="(item as LogMonitorCfgDto).description"
                :text="(item as LogMonitorCfgDto).description"
                :max-chars="30"
              />
            </template>
          </FvTableHeader>
          <!-- Keyword：等宽字体 + 30 字截断 -->
          <FvTableHeader :title="t('monitorAlarm.logMonitor.columns.keyword')" data-key="keyword" header-type="custom">
            <template #default="{ item }">
              <span class="vui-mono">
                <FvEllipsisText :text="(item as LogMonitorCfgDto).keyword" :max-chars="30" />
              </span>
            </template>
          </FvTableHeader>
          <!-- 三个列表列：有值=多值标签（首值+[+N]，悬停全展）；空=空白（空即不限制/无排除，2026-11-11 用户定稿不显中划线） -->
          <FvTableHeader
            :title="t('monitorAlarm.logMonitor.columns.followRuleNames')"
            data-key="followRuleNames"
            header-type="custom"
          >
            <template #default="{ item }">
              <FvMultiValueCell
                v-if="(item as LogMonitorCfgDto).followRuleNames?.length"
                :values="(item as LogMonitorCfgDto).followRuleNames"
              />
            </template>
          </FvTableHeader>
          <FvTableHeader
            :title="t('monitorAlarm.logMonitor.columns.excludeKeywords')"
            data-key="excludeKeywords"
            header-type="custom"
          >
            <template #default="{ item }">
              <FvMultiValueCell
                v-if="(item as LogMonitorCfgDto).excludeKeywords?.length"
                :values="(item as LogMonitorCfgDto).excludeKeywords"
              />
            </template>
          </FvTableHeader>
          <FvTableHeader
            :title="t('monitorAlarm.logMonitor.columns.excludeRuleNames')"
            data-key="excludeRuleNames"
            header-type="custom"
          >
            <template #default="{ item }">
              <FvMultiValueCell
                v-if="(item as LogMonitorCfgDto).excludeRuleNames?.length"
                :values="(item as LogMonitorCfgDto).excludeRuleNames"
              />
            </template>
          </FvTableHeader>
          <FvTableHeader :title="t('monitorAlarm.logMonitor.columns.priority')" data-key="priority" header-type="custom">
            <template #default="{ item }">
              <AlarmPriorityBadge :priority="(item as LogMonitorCfgDto).priority" />
            </template>
          </FvTableHeader>
          <FvTableHeader :title="t('monitorAlarm.logMonitor.columns.lastUpdatedBy')" data-key="lastUpdatedBy" />
          <FvTableHeader :title="t('monitorAlarm.logMonitor.columns.lastUpdatedAt')" data-key="lastUpdatedAt" />
          <FvTableHeader header-type="action" :actions="['view', 'edit', 'delete']" />
        </FvTable>
      </div>
    </FvCard>
  </section>
</template>

<style scoped>
/* 满高布局链（ServerHangReasonConfigView 同构）：section 列向 → 查询卡定高 + 表格卡铺满剩余高，
   纵向滚动交给 FvTable 内部（工具行/分页条固定），Body 区零页面级滚动 */
.lmc-page {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.lmc-query {
  flex: 0 0 auto;
  border-radius: var(--vui-radius-s);
}

/* align-end：搜索钮底边与输入框底边齐平（角色页定式） */
.lmc-query__form {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 8px 12px;
}

.lmc-query__input {
  flex: 1 1 auto;
  max-width: 480px;
  /* 全局字段规范 margin 3/3/7 在 align-end 搜索栏里把框体抬起 7px、与钮底边错位——局部归零（角色页同口径） */
  margin: 0;
}

.lmc-result {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: var(--vui-radius-s); /* 与 FvTable 自带圆角同心 */
}

.lmc-table {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* 表格外边距 5px（角色页/挂起原因页同口径） */
.lmc-table :deep(.fv-table) {
  margin: 5px;
}

/* Item 列粗体（文档 §3.2） */
.lmc-cell-item {
  font-weight: 600;
}

</style>
