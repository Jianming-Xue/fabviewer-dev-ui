<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { showOpError } from '@/shared/api/opError'
import { useModalDialog } from '@/shared/dialog/useModalDialog'
import { openInteractiveDialog } from '@/shared/dialog/openInteractiveDialog'
import { usePermissionStore } from '@/app/stores/permission'
import FvSideList from '@/shared/components/FvSideList.vue'
import FvSwitch from '@/shared/components/FvSwitch.vue'
import FvEllipsisText from '@/shared/components/FvEllipsisText.vue'
import FvTextInput from '@/shared/components/FvTextInput.vue'
import FvIconButton from '@/shared/components/FvIconButton.vue'
import FvCard from '@/shared/components/FvCard.vue'
import FvSpinner from '@/shared/components/FvSpinner.vue'
import SystemMiscEditDialog from '../dialogs/SystemMiscEditDialog.vue'
import {
  fetchSystemMiscCategories,
  fetchSystemMiscList,
  updateSystemMiscValue,
} from '@/api/telemetry-hub/requests/systemMiscRequest'

import type { SystemMiscDto } from '@/api/telemetry-hub/types/systemMiscTypes'

/**
 * 模块 5 · 02 System Misc（2026-11-09 新建）：平台级全局变量维护页——左类目右卡片双栏，
 * 只允许编辑、不允许增删（条目清单来自初始化脚本/DBA）。仓库首个横向布局页：
 * 根 section.vui-fill 内自行 flex-row，两栏各自内部滚动（min-height:0 滚动链，RoleManagementView 同定式）。
 * 加载时序（§3.1 严格顺序）：category/list → 默认选中本地固定首项 "All" → list（All=不传 category）；
 * 类目为空 → 左侧只剩 "All"。左侧不显示条数；编辑后无需刷新类目（category 不可改）。
 * 卡片值区按 valueType（§3.3）：Boolean=FvSwitch（显示 value 空回落 defaultValue）、
 * Text/Integer/Float=单行 20 字截断+tooltip（FvEllipsisText）、Json="…" 钮开只读查看弹窗。
 * 双层权限：功能权限=菜单过滤承载（registry 现成机制）；编辑权限=Control config.sys-misc.edit——
 * 无则 Editable 总开关与全部编辑入口不渲染（页面纯只读）。Editable 总开关默认 OFF（不持久化，§七已决）：
 * OFF=非 Boolean 编辑钮隐藏+Boolean 开关 disabled；ON=编辑钮显现+开关可交互。
 * Boolean 卡片切换先弹二次确认框再 PUT（§3.3）；开关为受控绑定（:model-value 派生自 row），
 * 取消/失败天然回拨、无本地状态可脏。编辑成功用出参就地换行、不重拉（§5.2）。
 */
const { t } = useI18n()
const dialog = useModalDialog()
const permission = usePermissionStore()

const FEATURE_URL = '/config/sys-misc'
/** 编辑权限（computed 保持响应——权限清单可能晚于页面挂载到位，RoleManagementView can() 同口径） */
const canEdit = computed(() => permission.hasControl(FEATURE_URL, 'config.sys-misc.edit'))

/** "All" 本地固定项哨兵（§3.2：恒首、恒显、不入接口参数） */
const ALL = ''

const categories = ref<string[]>([])
const activeCategory = ref(ALL)
const categoryItems = computed(() => [
  { label: t('config.misc.all'), value: ALL },
  ...categories.value.map((c) => ({ label: c, value: c })),
])

const rows = ref<SystemMiscDto[]>([])
const loading = ref(false)

/** 顶部搜索框关键字（2026-11-10 用户定稿）：item name / description 双字段模糊匹配、随输入即时过滤
 *  （纯客户端 computed，不重查接口）；清空（含 clearable 清除钮）= 关键字空 = 当前类目全量回显 */
const keyword = ref('')
const filteredRows = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return rows.value
  return rows.value.filter(
    (r) => r.item.toLowerCase().includes(kw) || (r.description ?? '').toLowerCase().includes(kw),
  )
})

/** Editable 总开关（仅编辑权限可见；默认 OFF、不持久化） */
const editable = ref(false)

async function loadList() {
  loading.value = true
  try {
    rows.value = await fetchSystemMiscList(activeCategory.value || undefined)
  } catch {
    showOpError(new Error(t('common.opFailed')))
  } finally {
    loading.value = false
  }
}

// §3.1 严格顺序：先类目、后清单（默认 All=全表）
onMounted(async () => {
  try {
    categories.value = await fetchSystemMiscCategories()
  } catch {
    categories.value = []
    showOpError(new Error(t('common.opFailed')))
  }
  await loadList()
})

watch(activeCategory, () => loadList())

/* ===== 卡片值区（§3.3） ===== */

/** Boolean 显示值：value 空回落 defaultValue */
function boolDisplay(row: SystemMiscDto): boolean {
  const v = row.value == null ? row.defaultValue : row.value
  return v === true
}

/** 查看态打开编辑弹窗（2026-11-10 用户定稿：编辑/查看共用 SystemMiscEditDialog，Json 查看弹窗退役）——
 *  view 态隐藏提交、Close 直关不提示、编辑器增改删全取消（Map Key 选择保留） */
function onView(row: SystemMiscDto) {
  openInteractiveDialog<{ row: SystemMiscDto; view?: boolean }, SystemMiscDto>(SystemMiscEditDialog, {
    row,
    view: true,
  })
}

/** 编辑弹窗：提交成功后用出参就地换行（item 为行键） */
async function onEdit(row: SystemMiscDto) {
  const updated = await openInteractiveDialog<{ row: SystemMiscDto }, SystemMiscDto>(
    SystemMiscEditDialog,
    { row },
  )
  if (!updated) return
  rows.value = rows.value.map((r) => (r.item === updated.item ? updated : r))
}

/** Boolean 卡片切换（§3.3 二次确认）：先本地写回 row.value 再弹确认（FvTable「先写回行再抛
 *  switch-change、失败回拨」同口径）——单向 :model-value 下 FvSwitch 内部 defineModel 会本地漂移，
 *  取消时只有 prop **值变化**（回拨写回原值）才能驱动开关视觉复位（2026-11-09 实测坑：
 *  纯受控不回写 → 取消后开关停在点击位）。确认才 PUT，取消零请求；成功用出参整行更新（审计字段同步刷新） */
async function onBoolToggle(row: SystemMiscDto, next: boolean) {
  const prev = row.value // 原值（可能为 null——显示回落 defaultValue，回拨须还原原值而非 false）
  row.value = next
  const confirmed = await dialog.confirm({
    title: t('config.misc.confirm.title'),
    message: t('config.misc.confirm.toggleMsg', {
      item: row.item,
      state: next ? t('config.misc.on') : t('config.misc.off'),
    }),
    okText: t('common.confirm'),
  })
  if (!confirmed) {
    row.value = prev
    return
  }
  try {
    const updated = await updateSystemMiscValue({ item: row.item, value: next })
    rows.value = rows.value.map((r) => (r.item === updated.item ? updated : r))
  } catch (e) {
    row.value = prev
    showOpError(e)
  }
}
</script>

<template>
  <section class="sys-misc-page vui-fill">
    <!-- 左栏：类目列表（"All" 恒首本地固定；选中 16px bold 主色，§3.2） -->
    <FvCard class="sys-misc-side">
      <FvSideList v-model="activeCategory" :items="categoryItems" />
    </FvCard>

    <!-- 右栏：Editable 总开关（仅编辑权限渲染）+ 卡片列表（容器滚动、无分页、item 升序） -->
    <FvCard class="sys-misc-main">
      <!-- 工具行（2026-11-10 加搜索框）：搜索框吃满剩余宽——左缘与卡片内容左界对齐、右缘与
           Editable 开关留隙相邻（开关仍贴右）；无 label、placeholder 承载说明 -->
      <div class="sys-misc-toolbar">
        <!-- 文本输入走 FvTextInput 统一规格（仓库口径）；清除钮用它自己的 `clear` prop
             （裸 clearable attr 会被组件内部 :clearable 显式绑定覆盖——2026-11-10 实测），
             清空 model（null 归一 ''）→ 关键字空 → 当前类目全量回显 -->
        <FvTextInput
          v-model="keyword"
          class="sys-misc-search"
          prepend-icon="fas fa-search"
          clear
          :placeholder="t('config.misc.searchPlaceholder')"
        />
        <!-- Editable 总开关：label 走 FvSwitch 自有 prop（2026-11-10 组件补件后手加 span 退役） -->
        <div v-if="canEdit" class="sys-misc-editable">
          <FvSwitch v-model="editable" :label="t('config.misc.editable')" />
        </div>
      </div>

      <div class="sys-misc-cards">
        <div v-if="loading" class="sys-misc-loading">
          <FvSpinner />
        </div>
        <template v-else>
          <div v-for="row in filteredRows" :key="row.item" class="sys-misc-card">
            <div class="sys-misc-card__info">
              <div class="sys-misc-card__item">{{ row.item }}</div>
              <div class="sys-misc-card__desc">
                <FvEllipsisText v-if="row.description" :text="row.description" />
              </div>
            </div>
            <div class="sys-misc-card__value">
              <!-- Boolean：受控开关（显示 value 空回落 defaultValue）；无编辑权限或总开关 OFF 均禁用 -->
              <FvSwitch
                v-if="row.valueType === 'Boolean'"
                :model-value="boolDisplay(row)"
                :disabled="!canEdit || !editable"
                @update:model-value="onBoolToggle(row, $event)"
              />
              <!-- Json："…" 钮开只读查看弹窗（查看不受 Editable 总开关限制） -->
              <FvIconButton
                v-else-if="row.valueType === 'Json'"
                icon="fas fa-ellipsis-h"
                :icon-size="14"
                size="24"
                class="sys-misc-card__json-btn"
                :label="t('common.view')"
                @click="onView(row)"
              />
              <!-- Text/Integer/Float：单行文本 20 字截断+tooltip；null 显占位 -->
              <span v-else class="sys-misc-card__text">
                <FvEllipsisText v-if="row.value != null" :text="String(row.value)" :max-chars="20" />
                <span v-else class="sys-misc-card__null">{{ t('config.misc.nullValue') }}</span>
              </span>
              <!-- 编辑钮：总开关 ON 才显现（§3.3）；**Boolean 卡片不给铅笔**（2026-11-10 用户定稿：
                   开关解除禁用即编辑入口，弹窗对 Boolean 无增量信息） -->
              <FvIconButton
                v-if="canEdit && editable && row.valueType !== 'Boolean'"
                icon="fas fa-pen"
                :icon-size="12"
                size="24"
                class="sys-misc-card__edit"
                :label="t('common.edit')"
                @click="onEdit(row)"
              />
            </div>
          </div>
          <div v-if="!filteredRows.length" class="sys-misc-empty">{{ t('common.empty') }}</div>
        </template>
      </div>
    </FvCard>
  </section>
</template>

<style scoped>
/* 横向双栏（仓库首页面级 flex-row）：满高链归 tokens .vui-fill，两栏各自内部滚动 */
.sys-misc-page {
  display: flex;
  flex-direction: row;
  gap: 3px; /* 页面卡片间隙（RoleManagementView 纵向 gap 同档） */
}

.sys-misc-side {
  flex: 0 0 220px;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sys-misc-main {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sys-misc-toolbar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 12px; /* 搜索框与 Editable 开关之间的保留间距 */
  padding: 8px 12px 0;
  min-height: 40px;
}

/* 搜索框吃满剩余宽：左缘贴卡片内容左界、右缘与开关留隙相邻；
   工具行非表单区——压掉 FvTextInput 的表单外距（3/3/7）防与开关错位 */
.sys-misc-search {
  flex: 1 1 auto;
  min-width: 0;
}

.sys-misc-toolbar :deep(.fv-text-input) {
  margin: 0;
}

.sys-misc-editable {
  flex: 0 0 auto;
}

.sys-misc-cards {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 12px 12px;
}

.sys-misc-loading {
  display: flex;
  justify-content: center;
  padding: 48px 0;
}

.sys-misc-card {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 56px;
  padding: 8px 4px;
  border-bottom: 1px solid var(--vui-split);
}

.sys-misc-card:last-child {
  border-bottom: none;
}

.sys-misc-card__info {
  flex: 1 1 auto;
  min-width: 0;
}

/* 卡片左上 item：14px bold（§3.3） */
.sys-misc-card__item {
  font-size: 14px;
  font-weight: 600;
  color: var(--vui-text);
  line-height: 20px;
}

/* 卡片左下 description：12px 灰、单行省略（溢出交给 CSS，非字符截断） */
.sys-misc-card__desc {
  font-size: 12px;
  color: var(--vui-text-secondary);
  line-height: 18px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sys-misc-card__value {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--vui-text);
}

.sys-misc-card__json-btn {
  color: var(--vui-text-secondary);
}

.sys-misc-card__edit {
  color: var(--vui-primary);
}

.sys-misc-card__null {
  font-size: 12px;
  color: var(--vui-text-placeholder);
}

.sys-misc-empty {
  padding: 48px 0;
  text-align: center;
  font-size: 12px;
  color: var(--vui-text-placeholder);
}
</style>
