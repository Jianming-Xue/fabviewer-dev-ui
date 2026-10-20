<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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
import PolicyEditDialog from '../dialogs/PolicyEditDialog.vue'
import {
  fetchLoginPolicies,
  deletePolicy,
} from '@/api/security-management/requests/policyRequest'
import type { PolicyDto } from '@/api/security-management/types/policyTypes'

/**
 * 登录策略管理（模块 · 用户和安全，2026-10-20 页面定稿）：搜索卡片 + 表格卡片。
 * 读接口全量不分页（用户定稿）：一次拉全，keyword 客户端模糊匹配
 * policyId/policyName/description（大小写不敏感，同角色后端口径）；
 * FvTable 不传 pageContent（隐藏分页条）、select-mode=single、insert=New、操作列=编辑+删除，
 * 皆按 security.login-policy.* 控件权限显隐。
 * 列（用户定稿 11 列）：Policy ID / Policy Name / Description / Passwd Min Len / Passwd Max Len /
 * Passwd Req Digit / Req Lower Char / Req Upper Char / Req Specials / Passwd Valid Days / Account Valid Days；
 * 布尔 1/0 显示为是/否、天数 -1 显示为永不过期、须含特殊字符显示字符集合连写
 * （text 列原样渲染数值，此六列走 custom）。
 */
const { t } = useI18n()
const dialog = useModalDialog()
const toast = useAlertToast()
const permission = usePermissionStore()

const FEATURE_URL = '/security/login-policy'
const can = (id: string) => permission.hasControl(FEATURE_URL, id)

/** 操作列按钮按控件权限过滤：编辑/删除各自受控；全无权时不声明操作列 */
const rowActions = computed(() => {
  const out: Array<'edit' | 'delete'> = []
  if (can('security.login-policy.edit')) out.push('edit')
  if (can('security.login-policy.delete')) out.push('delete')
  return out
})

// ===== 搜索（全量拉取，输入值与已生效值分离：Enter/点击才生效） =====
const keywordInput = ref('')
const keyword = ref('')

// ===== 全量列表（无分页） =====
const allPolicies = ref<PolicyDto[]>([])
const loading = ref(false)
/** 行选中（单选）：当前操作对象 */
const selectedPolicy = ref<PolicyDto | PolicyDto[] | null>(null)

const rows = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return allPolicies.value
  return allPolicies.value.filter((p) =>
    [p.policyId, p.policyName, p.description].some((v) => v.toLowerCase().includes(kw)),
  )
})

async function load() {
  loading.value = true
  try {
    allPolicies.value = await fetchLoginPolicies()
  } finally {
    loading.value = false
  }
}

function search() {
  keyword.value = keywordInput.value.trim()
}

onMounted(load)

/** 布尔 1/0 → 是/否（表格显示口径，编辑走弹窗） */
const reqText = (v: number) => t(v === 1 ? 'security.loginPolicy.yes' : 'security.loginPolicy.no')
/** Passwd Req Specials 列（用户定稿 2026-10-20）：须含时显示字符集合连写，否/空集合显示否 */
const specialsText = (p: PolicyDto) =>
  p.passwdRequireSpecialChar === 1 && p.passwdSpecials.length > 0
    ? p.passwdSpecials.join('')
    : t('security.loginPolicy.no')
/** 有效天数 → 数字或永不过期（-1） */
const daysText = (v: number) => (v === -1 ? t('security.loginPolicy.neverExpire') : String(v))

/** 编辑：落库由弹窗内完成（成功才关窗、失败留窗重试），此处只 Toast + 重拉 */
async function openEditor(policy: PolicyDto) {
  const saved = await openInteractiveDialog<{ policy?: PolicyDto }, PolicyDto | undefined>(PolicyEditDialog, { policy })
  if (!saved) return
  toast.success(t('security.loginPolicy.updated'))
  await load()
}

/** 新增（FvTable insert 回调）：落库由弹窗内完成；返回新行回显首行 */
async function onInsertPolicy(): Promise<PolicyDto | null> {
  const saved = await openInteractiveDialog<{ policy?: PolicyDto }, PolicyDto | undefined>(PolicyEditDialog, {})
  if (!saved) return null
  toast.success(t('security.loginPolicy.created'))
  return saved
}

/** 删除：确认 Dialog → 落库 → 重拉 */
async function remove(policy: PolicyDto) {
  if (!(await dialog.confirm(t('security.loginPolicy.deleteConfirm', { name: policy.policyName })))) return
  try {
    await deletePolicy(policy.policyId)
    toast.success(t('security.loginPolicy.deleted'))
    await load()
  } catch (e) {
    showOpError(e)
  }
}
</script>

<template>
  <section class="vui-policy-page vui-fill">
    <!-- 上：搜索卡片（Enter / 点击查询） -->
    <v-card elevation="0" border class="vui-policy-search">
      <v-form class="d-flex align-end ga-3 pa-4" @submit.prevent="search">
        <FvTextInput
          v-model="keywordInput"
          :label="t('security.loginPolicy.searchKeyword')"
          prepend-icon="fas fa-magnifying-glass"
          clear
          hide-details
          class="vui-policy-keyword"
        />
        <FvSearchButton class="vui-policy-search-btn" @click="search" />
      </v-form>
    </v-card>

    <!-- 下：结果卡片（仅表格 + New；向下铺满，表格区内部滚动）；
         边框由 FvTable 自带，卡片不描边避免双重框 -->
    <v-card elevation="0" class="vui-policy-result">
      <div class="vui-policy-table">
        <FvTable
          :data="rows"
          :loading="loading"
          select-mode="single"
          v-model:selected="selectedPolicy"
          :insert="can('security.login-policy.new') ? onInsertPolicy : undefined"
          @edit="openEditor"
          @delete="remove"
        >
          <FvTableHeader :title="t('security.loginPolicy.col.id')" data-key="policyId" header-class="vui-mono text-body-2" sort />
          <FvTableHeader :title="t('security.loginPolicy.col.name')" data-key="policyName" header-class="text-body-2" sort />
          <FvTableHeader
            :title="t('security.loginPolicy.col.description')"
            data-key="description"
            header-class="text-body-2 text-medium-emphasis"
            sort
          />
          <FvTableHeader :title="t('security.loginPolicy.col.passwdMinLen')" data-key="passwdMinLength" align="center" sort />
          <FvTableHeader :title="t('security.loginPolicy.col.passwdMaxLen')" data-key="passwdMaxLength" align="center" sort />
          <!-- 布尔 1/0 列显示为是/否（custom）；天数 -1 显示永不过期；sort 仅 text 列生效故此处不带 -->
          <FvTableHeader :title="t('security.loginPolicy.col.reqDigit')" data-key="passwdRequireDigit" header-type="custom" align="center">
            <template #default="{ item }">
              <span class="text-body-2">{{ reqText((item as PolicyDto).passwdRequireDigit) }}</span>
            </template>
          </FvTableHeader>
          <FvTableHeader :title="t('security.loginPolicy.col.reqLowerChar')" data-key="passwdRequireLowerChar" header-type="custom" align="center">
            <template #default="{ item }">
              <span class="text-body-2">{{ reqText((item as PolicyDto).passwdRequireLowerChar) }}</span>
            </template>
          </FvTableHeader>
          <FvTableHeader :title="t('security.loginPolicy.col.reqUpperChar')" data-key="passwdRequireUpperChar" header-type="custom" align="center">
            <template #default="{ item }">
              <span class="text-body-2">{{ reqText((item as PolicyDto).passwdRequireUpperChar) }}</span>
            </template>
          </FvTableHeader>
          <FvTableHeader :title="t('security.loginPolicy.col.reqSpecialChar')" data-key="passwdRequireSpecialChar" header-type="custom" align="center">
            <template #default="{ item }">
              <span class="text-body-2">{{ specialsText(item as PolicyDto) }}</span>
            </template>
          </FvTableHeader>
          <FvTableHeader :title="t('security.loginPolicy.col.passwdValidDays')" data-key="passwdValidDays" header-type="custom" align="center">
            <template #default="{ item }">
              <span class="text-body-2">{{ daysText((item as PolicyDto).passwdValidDays) }}</span>
            </template>
          </FvTableHeader>
          <FvTableHeader :title="t('security.loginPolicy.col.accountValidDays')" data-key="accountValidDays" header-type="custom" align="center">
            <template #default="{ item }">
              <span class="text-body-2">{{ daysText((item as PolicyDto).accountValidDays) }}</span>
            </template>
          </FvTableHeader>
          <!-- 受控操作列按控件权限显隐：全无权时不声明（FvTable 无 actions 即无此列） -->
          <FvTableHeader v-if="rowActions.length" header-type="action" :actions="rowActions" />
        </FvTable>
      </div>
    </v-card>
  </section>
</template>

<style scoped>
/* 页面满高布局（同角色页定稿口径）：四向 3px 边距与纵向铺满由布局层自动提供 */
.vui-policy-page {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.vui-policy-keyword {
  /* 搜索框外边距清零（2026-10-20）：全局字段规范 margin 3/3/7 在 align-end 搜索栏里
     把框体抬起 7px、与搜索按钮底边错位——仅本页搜索框局部归零（scoped 双特异度压全局），
     其余页面字段保持全局节奏 */
  margin: 0;
  width: 480px;
  max-width: 480px;
}

/* 搜索卡不可压缩（同角色页 2026-10-16 修挤压）：结果卡独吞收缩（内部滚动） */
.vui-policy-search {
  flex: 0 0 auto;
}

.vui-policy-result {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: var(--vui-radius-s); /* 与 FvTable 自带圆角同心，裁剪不留角缝 */
}

/* 表格区：flex 链收高，滚动交给 FvTable 内部表格区 */
.vui-policy-table {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* 表格外边距 5px（同角色页定稿）：边框与结果卡边缘留隙 */
.vui-policy-table :deep(.fv-table) {
  margin: 5px;
}
</style>
