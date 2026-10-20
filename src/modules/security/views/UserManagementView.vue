<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { useI18n } from 'vue-i18n'

import FvSearchButton from '@/shared/components/FvSearchButton.vue'
import FvTextInput from '@/shared/components/FvTextInput.vue'
import FvTable from '@/shared/components/FvTable.vue'
import FvTableHeader, { type FvTableMenuItem } from '@/shared/components/FvTableHeader.vue'
import { openInteractiveDialog } from '@/shared/dialog/openInteractiveDialog'
import { useModalDialog } from '@/shared/dialog/useModalDialog'
import { useAlertToast } from '@/shared/toast/useAlertToast'
import { usePermissionStore } from '@/app/stores/permission'
import { showOpError } from '@/shared/api/opError'
import CreateUserDialog from '../dialogs/CreateUserDialog.vue'
import EditUserDialog from '../dialogs/EditUserDialog.vue'
import ChangeUserStateDialog from '../dialogs/ChangeUserStateDialog.vue'
import EditUserRolePolicyDialog from '../dialogs/EditUserRolePolicyDialog.vue'
import ResetPasswordDialog from '../dialogs/ResetPasswordDialog.vue'
import UserViewDialog from '../dialogs/UserViewDialog.vue'
import {
  fetchUsersPage,
  deleteUser,
} from '@/api/security-management/requests/userRequest'
import { ensureRoleNames, ensurePolicyNames, roleNameOf, policyNameOf } from '@/api/security-management/rolePolicyNameCollection'
import type { UserDto } from '@/api/security-management/types/userTypes'

/**
 * 用户管理（模块 6 · 用户和安全，2026-10-18 首版）：上搜索卡片 + 下结果表格卡片（布局总纲同角色页）。
 * 搜索：单关键字框，模糊匹配 用户名 / 昵称 / 邮箱（后端口径，前端只管发起）。
 * 表格列（2026-10-18 扩全档案）：用户名/昵称/邮箱/电话/状态/角色/策略/账户过期时间/密码过期时间/
 * 密码有效期(天)/账户有效期(天) + 操作；列表不展示 创建时间/上次密码修改/上次登录时间/上次登录IP
 * （查看弹窗全量展示）。
 * 新增按钮（security.users.new 管控）；操作列 = 查看（不管控，恒有）+ 修改 + more 下拉菜单
 *  （角色和策略/重置密码受 edit 管控、删除用户受 delete 管控，2026-10-19 删除从图标钮收进菜单；
 *   编辑拆分：EditUserDialog 只留昵称/邮箱/电话，角色/策略/两有效期天数/账户到期日移入
 *   EditUserRolePolicyDialog，重置密码走 ResetPasswordDialog——UserRo 相应改稀疏语义）。
 * 新增/修改提交收口在弹窗内（成功才关窗），删除 = 公共确认 Dialog 后页面提交。
 */
const { t } = useI18n()
const dialog = useModalDialog()
const toast = useAlertToast()
const permission = usePermissionStore()

const FEATURE_URL = '/security/users'
const can = (id: string) => permission.hasControl(FEATURE_URL, id)

/** more 下拉菜单（2026-10-19 改造：删除从图标钮收进菜单）：角色和策略/重置密码受 edit 管控、
    删除用户受 delete 管控——受控项按权限过滤（口径同原图标钮显隐），全无权则菜单为空 */
const moreMenu = computed<FvTableMenuItem[]>(() => {
  const out: FvTableMenuItem[] = []
  if (can('security.users.edit')) {
    out.push({ key: 'rolesPolicy', label: t('security.users.ctlRolesPolicy'), icon: 'fas fa-user-shield' })
    out.push({ key: 'resetPwd', label: t('security.users.ctlResetPwd'), icon: 'fas fa-key' })
  }
  if (can('security.users.delete'))
    out.push({ key: 'delete', label: t('security.users.ctlDelete'), icon: 'fas fa-trash', color: 'error' })
  return out
})

/** 操作列：查看不受控恒可见；修改按控件权限显隐；more 仅当菜单有权项时出现（FvTable 守卫要求配了 moreMenu 才能挂 more） */
const rowActions = computed<Array<'view' | 'edit' | 'more'>>(() => {
  const out: Array<'view' | 'edit' | 'more'> = ['view']
  if (can('security.users.edit')) out.push('edit')
  if (moreMenu.value.length) out.push('more')
  return out
})

/** more 菜单分发：角色和策略/重置密码走各自弹窗（落库在弹窗内收口），删除走原公共确认删除链路 */
function onMoreSelect({ item, key }: { item: UserDto; key: string }) {
  if (key === 'rolesPolicy') void openRolesPolicy(item)
  else if (key === 'resetPwd') void openResetPwd(item)
  else if (key === 'delete') void remove(item)
}

// ===== 搜索（输入值与已生效值分离：Enter/点击才触发查询） =====
const keywordInput = ref('')
const keyword = ref('')

/* 过期两列（账户/密码过期时间，用户定稿 v3 2026-10-19）：正文只留文字（到日、不着色无图标）；
   空值（永不过期）显示文案「永不过期/Never expires」且悬停**不**出状态；有日期的格子悬停在下方
   浮出黑底状态 tooltip：过期=日期<今天；临近过期=今天≤日期<今天+3；未过期=日期≥今天+3 */
function expireStatus(v: string): { text: string; cls: string } {
  const d = dayjs(v.slice(0, 10))
  const today = dayjs().startOf('day')
  if (d.isBefore(today))
    return { text: t('security.users.expireStatusExpired'), cls: 'vui-expire--error' }
  if (d.isBefore(today.add(3, 'day')))
    return { text: t('security.users.expireStatusSoon'), cls: 'vui-expire--warning' }
  return { text: t('security.users.expireStatusOk'), cls: 'vui-expire--success' }
}

/** 状态开关行级禁用：无 edit 权限整列禁（禁用态而非隐藏，口径同角色页） */
function switchDisabled(row: unknown): boolean {
  void row
  return !can('security.users.edit')
}

/** 行内启用开关（FvTable switch 列回调，2026-10-19 改造）：点击不即时提交——
    弹 ChangeUserStateDialog 录备注后落库（标题随方向=启用用户/禁用用户）；
    弹窗未成（取消/失败后关闭）回拨 FvTable 已即时写回的视觉态，服务端状态未动 */
async function onSwitchChange({ item, value }: { item: UserDto; key: string; value: boolean }) {
  const done = await openInteractiveDialog<{ user: UserDto; enabled: number }, boolean | undefined>(
    ChangeUserStateDialog,
    { user: item, enabled: value ? 1 : 0 },
  )
  if (!done) {
    item.enabled = value ? 0 : 1 // 回拨开关
    return
  }
  item.enabled = value ? 1 : 0 // 出参口径数字 1/0（FvTable 内部写回的是布尔，此处归一）
  toast.success(t('security.users.enabledUpdated'))
}

/* ===== 分页列表（挂载名翻译，用户定稿 2026-10-20）=====
   后端用户接口只发 ID（roleIds/policyId）；本视图进页预载全局名称字典（rolePolicyNameCollection），
   表格行经 computed 派生展示字段——字典刷新到达即自动重显名，无需重拉用户页 */
interface UserRow extends UserDto {
  roleNames: string[]
  policyNameShow: string
}
function toRow(u: UserDto): UserRow {
  return {
    ...u,
    roleNames: u.roleIds.map(roleNameOf).filter(Boolean),
    policyNameShow: u.policyId ? policyNameOf(u.policyId) : '',
  }
}
const users = ref<UserDto[]>([])
const rows = computed<UserRow[]>(() => users.value.map(toRow))
const pageIndex = ref(1)
const pageSize = ref(10)
const pageContent = ref<{
  total: number
  totalPage: number
  pageIndex: number
  pageSize: number
} | null>(null)
const loading = ref(false)

async function loadPage() {
  loading.value = true
  try {
    const res = await fetchUsersPage({
      pageIndex: pageIndex.value,
      pageSize: pageSize.value,
      keyword: keyword.value,
    })
    users.value = res.data
    const totalPage = Math.max(1, Math.ceil(res.totalSize / res.pageSize))
    pageContent.value = {
      total: res.totalSize,
      totalPage,
      pageIndex: res.pageIndex,
      pageSize: res.pageSize,
    }
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

onMounted(() => {
  // 进用户界面先查全局角色/策略名称字典并缓存（失败不拦列表加载）
  void ensureRoleNames()
  void ensurePolicyNames()
  void loadPage()
})

/** 查看：只读展示弹窗（行数据即全量），不回收结果 */
async function openViewer(user: UserDto) {
  await openInteractiveDialog<{ user: UserDto }, unknown>(UserViewDialog, { user })
}

/** 编辑：落库由弹窗内完成（成功才关窗、失败保留重试），此处只 Toast + 重拉 */
async function openEditor(user: UserDto) {
  const saved = await openInteractiveDialog<{ user: UserDto }, UserDto | undefined>(
    EditUserDialog,
    { user },
  )
  if (!saved) return
  toast.success(t('security.users.updated'))
  await loadPage()
}

/** 新增（FvTable insert 回调）：落库由弹窗内完成（成功才关窗）；回显新行 + 计数 +1 */
async function onInsertUser(): Promise<UserRow | null> {
  const saved = await openInteractiveDialog<Record<string, never>, UserDto | undefined>(
    CreateUserDialog,
    {},
  )
  if (!saved) return null
  toast.success(t('security.users.created'))
  if (pageContent.value)
    pageContent.value = { ...pageContent.value, total: pageContent.value.total + 1 }
  return toRow(saved)
}

/** 角色和策略（More 菜单）：落库由弹窗内完成（成功才关窗），此处只 Toast + 重拉 */
async function openRolesPolicy(user: UserDto) {
  const saved = await openInteractiveDialog<{ user: UserDto }, UserDto | undefined>(
    EditUserRolePolicyDialog,
    { user },
  )
  if (!saved) return
  toast.success(t('security.users.updated'))
  await loadPage()
}

/** 重置密码（More 菜单）：成功仅提示——列表列不含密码足迹，无需重拉 */
async function openResetPwd(user: UserDto) {
  const done = await openInteractiveDialog<{ user: UserDto }, boolean | undefined>(
    ResetPasswordDialog,
    { user },
  )
  if (!done) return
  toast.success(t('security.users.passwordReset'))
}

/** 删除：确认 Dialog → 落库 → 重拉（删空尾页回退一页） */
async function remove(user: UserDto) {
  if (!(await dialog.confirm(t('security.users.deleteConfirm', { name: user.userName })))) return
  try {
    await deleteUser(user.userId)
    toast.success(t('security.users.deleted'))
    if (rows.value.length === 1 && pageIndex.value > 1)
      pageIndex.value -= 1 // watch 加载
    else await loadPage()
  } catch (e) {
    showOpError(e)
  }
}
</script>

<template>
  <section class="vui-users-page vui-fill">
    <!-- 上：搜索卡片（Enter / 点击查询） -->
    <v-card elevation="0" border class="vui-users-search">
      <v-form class="d-flex align-end ga-3 pa-4" @submit.prevent="search">
        <FvTextInput
          v-model="keywordInput"
          :label="t('security.users.searchKeyword')"
          prepend-icon="fas fa-magnifying-glass"
          clear
          hide-details
          class="vui-users-keyword"
        />
        <FvSearchButton class="vui-users-search-btn" @click="search" />
      </v-form>
    </v-card>

    <!-- 下：结果卡片（仅表格 + New User；向下铺满，表格区内部滚动）；
         边框由 FvTable 自带，卡片不再描边避免双重框 -->
    <v-card elevation="0" class="vui-users-result">
      <div class="vui-users-table">
        <FvTable
          v-model:page-index="pageIndex"
          v-model:page-size="pageSize"
          :data="rows"
          :page-content="pageContent"
          :loading="loading"
          :insert="can('security.users.new') ? onInsertUser : undefined"
          @view="openViewer"
          @edit="openEditor"
          @more-select="onMoreSelect"
          @switch-change="onSwitchChange"
        >
          <FvTableHeader
            :title="t('security.users.col.userName')"
            data-key="userName"
            header-class="text-body-2"
            sort
          />
          <FvTableHeader
            :title="t('security.users.col.nickName')"
            data-key="nickName"
            header-class="text-body-2"
            sort
          />
          <FvTableHeader
            :title="t('security.users.col.email')"
            data-key="email"
            header-class="text-body-2 text-medium-emphasis"
            sort
          />
          <FvTableHeader
            :title="t('security.users.col.phoneNumber')"
            data-key="phoneNumber"
            header-class="text-body-2 text-medium-emphasis"
          />
          <!-- 状态：FvSwitch 行内开关（切换即落库；无 edit 权限禁用），不再纯文本 -->
          <FvTableHeader
            :title="t('security.users.col.status')"
            data-key="enabled"
            header-type="switch"
            :header-disabled="switchDisabled"
          />
          <!-- 角色列：多值单元格（ID 已经名称字典翻译为 roleNames，2026-10-20） -->
          <FvTableHeader
            :title="t('security.users.col.roles')"
            data-key="roleNames"
            header-type="multiValue"
          />
          <FvTableHeader
            :title="t('security.users.col.policy')"
            data-key="policyNameShow"
            header-type="custom"
          >
            <template #default="{ item }">
              <span class="text-body-2 text-medium-emphasis">{{
                (item as UserRow).policyNameShow || t('security.users.defaultPolicy')
              }}</span>
            </template>
          </FvTableHeader>
          <FvTableHeader
            :title="t('security.users.col.accountExpiresAt')"
            data-key="accountExpiresAt"
            header-type="custom"
          >
            <template #default="{ item }">
              <v-tooltip
                v-if="(item as UserDto).accountExpiresAt"
                location="bottom"
                content-class="vui-table-tip"
              >
                <template #activator="{ props: tp }">
                  <span v-bind="tp" class="vui-expire-cell text-body-2 text-medium-emphasis">{{
                    (item as UserDto).accountExpiresAt.slice(0, 10)
                  }}</span>
                </template>
                <span :class="expireStatus((item as UserDto).accountExpiresAt).cls">{{
                  expireStatus((item as UserDto).accountExpiresAt).text
                }}</span>
              </v-tooltip>
              <span v-else class="text-body-2 text-medium-emphasis">{{
                t('security.users.neverExpire')
              }}</span>
            </template>
          </FvTableHeader>
          <FvTableHeader
            :title="t('security.users.col.passwordExpiresAt')"
            data-key="passwordExpiresAt"
            header-type="custom"
          >
            <template #default="{ item }">
              <v-tooltip
                v-if="(item as UserDto).passwordExpiresAt"
                location="bottom"
                content-class="vui-table-tip"
              >
                <template #activator="{ props: tp }">
                  <span v-bind="tp" class="vui-expire-cell text-body-2 text-medium-emphasis">{{
                    (item as UserDto).passwordExpiresAt.slice(0, 10)
                  }}</span>
                </template>
                <span :class="expireStatus((item as UserDto).passwordExpiresAt).cls">{{
                  expireStatus((item as UserDto).passwordExpiresAt).text
                }}</span>
              </v-tooltip>
              <span v-else class="text-body-2 text-medium-emphasis">{{
                t('security.users.neverExpire')
              }}</span>
            </template>
          </FvTableHeader>
          <FvTableHeader
            :title="t('security.users.col.passwordValidDays')"
            data-key="passwordValidDays"
            header-type="custom"
          >
            <template #default="{ item }">
              <span class="text-body-2 text-medium-emphasis">{{
                (item as UserDto).passwordValidDays > 0
                  ? (item as UserDto).passwordValidDays
                  : t('security.users.forever')
              }}</span>
            </template>
          </FvTableHeader>
          <FvTableHeader
            :title="t('security.users.col.accountValidDays')"
            data-key="accountValidDays"
            header-type="custom"
          >
            <template #default="{ item }">
              <span class="text-body-2 text-medium-emphasis">{{
                (item as UserDto).accountValidDays > 0
                  ? (item as UserDto).accountValidDays
                  : t('security.users.forever')
              }}</span>
            </template>
          </FvTableHeader>
          <FvTableHeader header-type="action" :actions="rowActions" :more-menu="moreMenu" />
        </FvTable>
      </div>
    </v-card>
  </section>
</template>

<style scoped>
/* 页面满高布局（用户定稿 2026-10-15）：壳层内容区内边距 24px，
   页面负边距收窄为 3px（左右/上），底部留 3px；卡片间距 3px；结果卡片铺满剩余高度 */
.vui-users-page {
  display: flex;
  flex-direction: column;
  gap: 3px; /* 卡片间距；四向 3px 边距与纵向铺满由布局层（FvShell .vui-content）自动提供 */
}

/* 搜索框加大（与角色页同调优） */
.vui-users-keyword {
  /* 搜索框外边距清零（2026-10-20）：全局字段规范 margin 3/3/7 在 align-end 搜索栏里
     把框体抬起 7px、与搜索按钮底边错位——仅本页搜索框局部归零（scoped 双特异度压全局），
     其余页面字段保持全局节奏 */
  margin: 0;
  width: 480px;
  max-width: 480px;
}

/* 过期状态 tooltip 三色（正文只留文字，见 expireStatus）：取深底亮色档 --vui-tip-*，
   正文语义色在深灰/黑底上对比不足（用户反馈 2026-10-19：成功绿看不清） */
.vui-expire--error {
  color: var(--vui-tip-error);
}

.vui-expire--warning {
  color: var(--vui-tip-warning);
}

.vui-expire--success {
  color: var(--vui-tip-success);
}

/* 搜索卡不可压缩（同角色页修挤压口径）：结果卡独吞收缩（内部滚动） */
.vui-users-search {
  flex: 0 0 auto;
}

.vui-users-result {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: var(--vui-radius-s); /* 与 FvTable 自带圆角同心，裁剪不留角缝 */
}

/* 表格区：flex 链收高，滚动交给 FvTable 内部表格区（工具行/分页条固定） */
.vui-users-table {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* 表格外边距 5px（用户定稿 2026-10-16）：边框与结果卡边缘留隙 */
.vui-users-table :deep(.fv-table) {
  margin: 5px;
}
</style>
