<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { showOpError } from '@/shared/api/opError'
import { useModalDialog } from '@/shared/dialog/useModalDialog'
import { openInteractiveDialog } from '@/shared/dialog/openInteractiveDialog'
import FvTable from '@/shared/components/FvTable.vue'
import FvTableHeader from '@/shared/components/FvTableHeader.vue'
import ServerHangReasonConfigEditDialog from '../dialogs/ServerHangReasonConfigEditDialog.vue'
import {
  deleteSrvHangCfg,
  fetchSrvHangCfgPage,
  toggleSrvHangCfgState,
} from '@/api/log-service/requests/srvHangCfg'
import type { SrvHangCfgDto } from '@/api/log-service/types/types'

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
const rows = ref<SrvHangCfgDto[]>([])
const pageContent = reactive({ total: 0, totalPage: 1, pageIndex: 1, pageSize: 20 }) // 默认每页 20 条（§4.1）
const loading = ref(false)
const selected = ref<SrvHangCfgDto | null>(null)

async function loadPage(page = pageContent.pageIndex) {
  loading.value = true
  try {
    const data = await fetchSrvHangCfgPage(page, pageContent.pageSize)
    rows.value = data.contents
    pageContent.total = data.total
    pageContent.totalPage = data.totalPage
    pageContent.pageIndex = data.pageIndex
  } catch {
    showOpError(new Error(t('common.opFailed')))
  } finally {
    loading.value = false
  }
}

onMounted(() => loadPage(1))

/** Enabled 开关：FvTable 先写回行再抛 switch-change；失败回拨该格（§4.1 就地改不重拉） */
async function onSwitchChange({ item, value }: { item: SrvHangCfgDto; key: string; value: boolean }) {
  const prev = !value
  try {
    await toggleSrvHangCfgState(item.id, value)
  } catch {
    item.enabled = prev
    showOpError(new Error(t('common.opFailed')))
  }
}

/** 新增（FvTable insert → FvNewButton）：弹窗提交成功后出参回显首行，总数 +1 */
async function onInsert(): Promise<SrvHangCfgDto | null> {
  const created = await openInteractiveDialog<{ row?: SrvHangCfgDto }, SrvHangCfgDto>(
    ServerHangReasonConfigEditDialog,
    {},
  )
  if (!created) return null
  pageContent.total += 1
  return created
}

/** 编辑（action 列 pen）：弹窗提交成功后用出参换引用更新该行（§4.3 整行更新） */
async function onEdit(row: SrvHangCfgDto) {
  const updated = await openInteractiveDialog<{ row?: SrvHangCfgDto }, SrvHangCfgDto>(
    ServerHangReasonConfigEditDialog,
    { row },
  )
  if (!updated) return
  rows.value = rows.value.map((r) => (r.id === updated.id ? updated : r))
}

// ===== 删除（§4.1：弹框确认后调用；公共确认 Dialog） =====
async function onDelete(row: SrvHangCfgDto) {
  const ok = await dialog.confirm({
    title: t('common.delete'),
    message: t('common.deleteConfirm'),
    okText: t('common.delete'),
  })
  if (!ok) return
  try {
    await deleteSrvHangCfg(row.id)
    rows.value = rows.value.filter((r) => r.id !== row.id)
    pageContent.total = Math.max(0, pageContent.total - 1)
    if (selected.value?.id === row.id) selected.value = null
  } catch (e) {
    showOpError(e)
  }
}
</script>

<template>
  <section class="shc-page">
    <!-- 单卡铺满（角色页同构布局链）：卡不描边（FvTable 自带框），表格区内部滚动 -->
    <v-card elevation="0" class="shc-result">
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
          <FvTableHeader :title="t('config.columns.updatedAt')" data-key="updatedAt" />
          <FvTableHeader :title="t('config.columns.updatedBy')" data-key="updatedBy" />
          <FvTableHeader header-type="action" :actions="['edit', 'delete']" />
        </FvTable>
      </div>
    </v-card>
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
