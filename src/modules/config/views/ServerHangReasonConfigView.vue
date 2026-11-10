<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { showOpError } from '@/shared/api/opError'
import { useModalDialog } from '@/shared/dialog/useModalDialog'
import { openInteractiveDialog } from '@/shared/dialog/openInteractiveDialog'
import FvTable from '@/shared/components/FvTable.vue'
import FvTableHeader from '@/shared/components/FvTableHeader.vue'
import FvCard from '@/shared/components/FvCard.vue'
import ServerHangReasonConfigEditDialog from '../dialogs/ServerHangReasonConfigEditDialog.vue'
import {
  deleteSrvHangConfig,
  fetchSrvHangConfigPage,
  toggleSrvHangConfigState,
} from '@/api/telemetry-hub/requests/srvHangConfigRequest'
import type { ServerHangConfigDto } from '@/api/telemetry-hub/types/srvHangConfigTypes'

/**
 * 模块 5 · 01 Server Hang Reason Config（2026-10-27 二改版，用户定稿）：
 * 页面只留表格卡——标题行移除（面包屑/菜单已有功能名）、新增/编辑收进
 * `dialogs/ServerHangReasonConfigEditDialog`（FvInteractiveDialog 体系，提交收口弹窗内）、
 * New 钮经 FvTable insert 回调显现、刷新钮经 FvTable refresh prop + @refresh（重查当前页回显）；
 * 表格样式全走 FvTable 默认，页面级零调整。
 */
const { t } = useI18n()
const dialog = useModalDialog()

// ===== 表格区（§4.1） =====
const rows = ref<ServerHangConfigDto[]>([])
const pageContent = reactive({ total: 0, totalPage: 1, pageIndex: 1, pageSize: 20 }) // 默认每页 20 条（§4.1）
const loading = ref(false)
const selected = ref<ServerHangConfigDto | null>(null)

async function loadPage(page = pageContent.pageIndex) {
  loading.value = true
  try {
    const data = await fetchSrvHangConfigPage(page, pageContent.pageSize)
    rows.value = data.data
    pageContent.total = data.totalSize
    pageContent.totalPage = data.totalPage
    pageContent.pageIndex = data.pageIndex
  } catch {
    showOpError(new Error(t('common.opFailed')))
  } finally {
    loading.value = false
  }
}

onMounted(() => loadPage(1))

/** 分页组件触发重查（角色页同定式，2026-11-05 修：此前漏挂 watch，点页码/换每页条数只回写
 *  pageContent 不发请求）：FvTable 经 v-model 回写 pageIndex/pageSize，取数归消费方；
 *  换 pageSize 回第 1 页由 FvTable 内部 setPageSize 处理，此处无需重复 */
watch(
  () => [pageContent.pageIndex, pageContent.pageSize] as const,
  () => loadPage(),
)

/** Enabled 开关：FvTable 先写回行再抛 switch-change；失败回拨该格（§4.1 就地改不重拉）。
 *  2026-11-05 用户定稿：提交前先弹 Warning 确认框（5 分钟生效提醒）——取消=回拨开关不提交 */
async function onSwitchChange({ item, value }: { item: ServerHangConfigDto; key: string; value: boolean }) {
  const prev = !value
  const ok = await dialog.confirm({
    title: t('config.warn.effectTitle'),
    message: t('config.warn.toggleMsg'),
    okText: t('common.confirm'),
    tone: 'warning',
  })
  if (!ok) {
    item.enabled = prev
    return
  }
  try {
    await toggleSrvHangConfigState(item.id, value)
  } catch {
    item.enabled = prev
    showOpError(new Error(t('common.opFailed')))
  }
}

/** 新增（FvTable insert → FvNewButton）：弹窗提交成功后出参回显首行，总数 +1 */
async function onInsert(): Promise<ServerHangConfigDto | null> {
  const created = await openInteractiveDialog<{ row?: ServerHangConfigDto }, ServerHangConfigDto>(
    ServerHangReasonConfigEditDialog,
    {},
  )
  if (!created) return null
  pageContent.total += 1
  return created
}

/** 编辑（action 列 pen）：弹窗提交成功后用出参换引用更新该行（§4.3 整行更新） */
async function onEdit(row: ServerHangConfigDto) {
  const updated = await openInteractiveDialog<{ row?: ServerHangConfigDto }, ServerHangConfigDto>(
    ServerHangReasonConfigEditDialog,
    { row },
  )
  if (!updated) return
  rows.value = rows.value.map((r) => (r.id === updated.id ? updated : r))
}

// ===== 删除（§4.1：弹框确认后调用；2026-11-05 改 Warning 调确认框：生效延迟+历史不回算口径入文案） =====
async function onDelete(row: ServerHangConfigDto) {
  const ok = await dialog.confirm({
    title: t('common.delete'),
    message: t('config.warn.deleteMsg'),
    okText: t('common.delete'),
    tone: 'warning',
  })
  if (!ok) return
  try {
    await deleteSrvHangConfig(row.id)
    rows.value = rows.value.filter((r) => r.id !== row.id)
    pageContent.total = Math.max(0, pageContent.total - 1)
    if (selected.value?.id === row.id) selected.value = null
  } catch (e) {
    showOpError(e)
  }
}
</script>

<template>
  <!-- vui-fill（tokens.css 满高页面约定）：根元素允许收缩到内容区高——Body 区（.vui-content）不出滚动条，
       纵向滚动交给 FvTable 内部（工具行/分页条固定）。2026-11-05 修：此前漏挂该类，根节点吃
       .vui-content>* 默认 flex:1 0 auto 不收缩，真实数据 20 行把内容区撑出页面级滚动条 -->
  <section class="shc-page vui-fill">
    <!-- 单卡铺满（角色页同构布局链）：卡不描边（FvTable 自带框），表格区内部滚动 -->
    <FvCard class="shc-result">
      <div class="shc-table">
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
          @switch-change="onSwitchChange"
          @edit="onEdit"
          @delete="onDelete"
        >
          <FvTableHeader :title="t('config.columns.ruleName')" data-key="ruleName" />
          <FvTableHeader :title="t('config.columns.startLineLike')" data-key="startLineLike" />
          <FvTableHeader :title="t('config.columns.endLineLike')" data-key="endLineLike" />
          <FvTableHeader :title="t('config.columns.hangReason')" data-key="hangReason" />
          <FvTableHeader :title="t('config.columns.enabled')" data-key="enabled" header-type="switch" />
          <FvTableHeader :title="t('config.columns.lastUpdatedAt')" data-key="lastUpdatedAt" />
          <FvTableHeader :title="t('config.columns.lastUpdatedBy')" data-key="lastUpdatedBy" />
          <FvTableHeader header-type="action" :actions="['edit', 'delete']" />
        </FvTable>
      </div>
    </FvCard>
  </section>
</template>

<style scoped>
/* 满高布局链（与角色页同构，2026-10-27）：section 列向 → 结果卡铺满剩余高 →
   表格区收高、滚动交给 FvTable 内部（工具行/分页条固定） */
.shc-page {
  display: flex;
  flex-direction: column;
}

.shc-result {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: var(--vui-radius-s); /* 与 FvTable 自带圆角同心 */
}

.shc-table {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* 表格外边距 5px（角色页同口径）：边框与卡边缘留隙 */
.shc-table :deep(.fv-table) {
  margin: 5px;
}
</style>
