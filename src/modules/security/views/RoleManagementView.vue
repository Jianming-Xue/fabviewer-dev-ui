<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import FvSearchButton from '@/shared/components/FvSearchButton.vue'
import FvTextInput from '@/shared/components/FvTextInput.vue'
import FvTable from '@/shared/components/FvTable.vue'
import FvTableHeader from '@/shared/components/FvTableHeader.vue'
import { openInteractiveDialog } from '@/shared/dialog/openInteractiveDialog'
import { useModalDialog } from '@/shared/dialog/useModalDialog'
import { useAlertToast } from '@/shared/toast/useAlertToast'
import { usePermissionStore } from '@/app/stores/permission'
import { showOpError } from '@/shared/api/opError'
import RoleEditDialog from '../dialogs/RoleEditDialog.vue'
import RolePermissionDialog from '../dialogs/RolePermissionDialog.vue'
import { fetchRolesPage, deleteRole, setRoleEnabled } from '@/api/security-management/roleRequest'
import { BUILTIN_ROLE_ID } from '@/api/security-management/roleTypes'
import type { RoleDto } from '@/api/security-management/roleTypes'

/**
 * 角色管理（模块 · 用户和安全）：搜索卡片 + 结果卡片。
 * 表格列：角色 ID / 名称 / 描述 / 启用开关（FvSwitch 行内切换）/ 权限（点击分配）/ 操作（编辑+删除）。
 * 卡片只含表格与 New Role（FvNewButton 圆形加号）。
 */
const { t } = useI18n()
const dialog = useModalDialog()
const toast = useAlertToast()
const permission = usePermissionStore()

const FEATURE_URL = '/security/roles'
const can = (id: string) => permission.hasControl(FEATURE_URL, id)

/** 操作列按钮按控件权限过滤：编辑/删除各自受控 */
const rowActions = computed(() => {
  const out: Array<'edit' | 'delete'> = []
  if (can('security.roles.edit')) out.push('edit')
  if (can('security.roles.delete')) out.push('delete')
  return out
})

/** 启用开关禁用判定（行级）：无 edit 权限整列禁 + 内置角色行恒禁（禁用态而非隐藏） */
function switchDisabled(row: unknown): boolean {
  return !can('security.roles.edit') || (row as RoleDto).roleId === BUILTIN_ROLE_ID
}

/** 操作列逐行禁用：内置角色禁删除（置灰 + 悬停提示）；编辑保留（名称/描述可改） */
function actionDisabled(row: unknown, action: 'edit' | 'delete' | 'view'): boolean {
  return (row as RoleDto).roleId === BUILTIN_ROLE_ID && action === 'delete'
}

// ===== 搜索（输入值与已生效值分离：Enter/点击才触发查询） =====
const keywordInput = ref('')
const keyword = ref('')

// ===== 分页列表 =====
const rows = ref<RoleDto[]>([])
const pageIndex = ref(1)
const pageSize = ref(10)
const pageContent = ref<{ total: number; totalPage: number; pageIndex: number; pageSize: number } | null>(null)
const loading = ref(false)
/** 行选中（单选）：当前操作对象，供后续详情/批量动作消费 */
const selectedRole = ref<RoleDto | RoleDto[] | null>(null)

async function loadPage() {
  loading.value = true
  try {
    const res = await fetchRolesPage({
      pageIndex: pageIndex.value,
      pageSize: pageSize.value,
      keyword: keyword.value,
    })
    // 后端口径（2026-10-17）：contents = { pageSize, pageIndex, totalSize, data }
    rows.value = res.data
    const totalPage = Math.max(1, Math.ceil(res.totalSize / res.pageSize))
    pageContent.value = { total: res.totalSize, totalPage, pageIndex: res.pageIndex, pageSize: res.pageSize }
    if (pageIndex.value > totalPage) pageIndex.value = totalPage
  } finally {
    loading.value = false
  }
}

function search() {
  keyword.value = keywordInput.value.trim()
  if (pageIndex.value === 1) void loadPage()
  else pageIndex.value = 1 // 触发下方 watch 加载
}

/** 翻页/改每页大小 → 重新加载（FvTable 的 v-model 驱动） */
watch([pageIndex, pageSize], () => void loadPage())

onMounted(loadPage)

/** 编辑基本信息：落库由弹窗内完成（成功才关窗、失败弹窗保留重试），此处只 Toast + 重拉 */
async function openEditor(role: RoleDto) {
  const saved = await openInteractiveDialog<{ role?: RoleDto }, RoleDto | undefined>(RoleEditDialog, { role })
  if (!saved) return
  toast.success(t('security.roles.updated'))
  await loadPage()
}

/** 新增（FvTable insert 回调）：落库由弹窗内完成（成功才关窗）；回显新行 + 计数 +1 */
async function onInsertRole(): Promise<RoleDto | null> {
  const saved = await openInteractiveDialog<{ role?: RoleDto }, RoleDto | undefined>(RoleEditDialog, {})
  if (!saved) return null
  toast.success(t('security.roles.created'))
  if (pageContent.value) pageContent.value = { ...pageContent.value, total: pageContent.value.total + 1 }
  return saved
}

/** 行内启用开关（FvTable switch 列回调）：切换即落库；失败回读。内置角色双保险拦截 */
async function onSwitchChange({ item, value }: { item: RoleDto; key: string; value: boolean }) {
  if (item.roleId === BUILTIN_ROLE_ID && !value) return
  try {
    await setRoleEnabled(item.roleId, value ? 1 : 0)
    item.enabled = value ? 1 : 0 // 出参口径数字 1/0（FvTable 内部写回的是布尔，此处归一）
    toast.success(t('security.roles.enabledUpdated'))
  } catch (e) {
    await loadPage()
    showOpError(e)
  }
}

/** 权限分配：受 edit 管控——无权限以只读态打开（树可查看、Confirm 禁用）；
 *  落库由弹窗内完成（成功才关窗、失败保留勾选重试），此处只 Toast + 重拉 */
async function openPermissions(role: RoleDto) {
  const saved = await openInteractiveDialog<{ role: RoleDto; readonly?: boolean }, boolean | undefined>(
    RolePermissionDialog,
    { role, readonly: !can('security.roles.edit') || role.roleId === BUILTIN_ROLE_ID },
  )
  if (!saved) return
  toast.success(t('security.roles.permUpdated'))
  await loadPage()
}

/** 删除：确认 Dialog → 落库 → 重拉（删空尾页回退一页）。内置角色双保险拦截 */
async function remove(role: RoleDto) {
  if (role.roleId === BUILTIN_ROLE_ID) return
  if (!(await dialog.confirm(t('security.roles.deleteConfirm')))) return
  try {
    await deleteRole(role.roleId)
    toast.success(t('security.roles.deleted'))
    if (rows.value.length === 1 && pageIndex.value > 1) pageIndex.value -= 1 // watch 加载
    else await loadPage()
  } catch (e) {
    showOpError(e)
  }
}
</script>

<template>
  <section class="vui-roles-page vui-fill">
    <!-- 上：搜索卡片（Enter / 点击查询） -->
    <v-card elevation="0" border class="vui-roles-search">
      <v-form class="d-flex align-end ga-3 pa-4" @submit.prevent="search">
        <FvTextInput
          v-model="keywordInput"
          :label="t('security.roles.searchKeyword')"
          prepend-icon="fas fa-magnifying-glass"
          clear
          hide-details
          class="vui-roles-keyword"
        />
        <FvSearchButton class="vui-roles-search-btn" @click="search" />
      </v-form>
    </v-card>

    <!-- 下：结果卡片（仅表格 + New Role；向下铺满，表格区内部滚动）；
         边框由 FvTable 自带（2026-10-16），卡片不再描边避免双重框 -->
    <v-card elevation="0" class="vui-roles-result">
      <div class="vui-roles-table">

      <FvTable
        v-model:page-index="pageIndex"
        v-model:page-size="pageSize"
        :data="rows"
        :page-content="pageContent"
        :loading="loading"
        select-mode="single"
        v-model:selected="selectedRole"
        :insert="can('security.roles.new') ? onInsertRole : undefined"
        @edit="openEditor"
        @delete="remove"
        @switch-change="onSwitchChange"
      >
        <FvTableHeader :title="t('security.roles.col.id')" data-key="roleId" header-class="vui-mono text-body-2" sort />
        <FvTableHeader :title="t('security.roles.col.name')" data-key="roleName" header-class="text-body-2" sort />
        <FvTableHeader
          :title="t('security.roles.col.description')"
          data-key="description"
          header-class="text-body-2 text-medium-emphasis"
          sort
        />
        <!-- 启用开关受 edit 管控（列级）+ 内置角色行禁用（行级）：均为禁用态而非隐藏 -->
        <FvTableHeader
          :title="t('security.roles.col.enabled')"
          data-key="enabled"
          header-type="switch"
          :header-disabled="switchDisabled"
        />
        <FvTableHeader :title="t('security.roles.col.permissions')" data-key="permissions" header-type="custom">
          <template #default="{ item }">
            <v-btn
              variant="text"
              size="small"
              color="primary"
              prepend-icon="fas fa-key"
              @click.stop="openPermissions(item as RoleDto)"
            >
              {{ t('security.roles.permCount', { n: (item as RoleDto).permissions.length }) }}
            </v-btn>
          </template>
        </FvTableHeader>
        <!-- 受控按钮按控件权限显隐（用户定稿）：全无权时不声明操作列（FvTable 无 actions 即无此列） -->
        <FvTableHeader
          v-if="rowActions.length"
          header-type="action"
          :actions="rowActions"
          :action-disabled="actionDisabled"
          :action-disabled-hint="t('security.roles.builtinHint')"
        />
      </FvTable>
      </div>
    </v-card>
  </section>
</template>

<style scoped>
/* 页面满高布局（用户定稿 2026-10-15）：壳层内容区内边距 24px，
   页面负边距收窄为 3px（左右/上），底部留 3px；卡片间距 3px；结果卡片铺满剩余高度 */
.vui-roles-page {
  display: flex;
  flex-direction: column;
  gap: 3px; /* 卡片间距；四向 3px 边距与纵向铺满由布局层（FvShell .vui-content）自动提供 */
}

/* 搜索框加大（用户调优 2026-10-15） */
.vui-roles-keyword {
  width: 480px;
  max-width: 480px;
}

/* 搜索卡不可压缩（2026-10-16 修挤压）：结果卡内容基高随 pageSize 增大时，
   flex 负空间曾按基准比例分摊到搜索卡；搜索卡定死、结果卡独吞收缩（内部滚动） */
.vui-roles-search {
  flex: 0 0 auto;
}

.vui-roles-result {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: var(--vui-radius-s); /* 与 FvTable 自带圆角同心，裁剪不留角缝 */
}

/* 表格区：flex 链收高，滚动交给 FvTable 内部表格区（工具行/分页条固定） */
.vui-roles-table {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* 表格外边距 5px（用户定稿 2026-10-16）：边框与结果卡边缘留隙 */
.vui-roles-table :deep(.fv-table) {
  margin: 5px;
}
</style>
