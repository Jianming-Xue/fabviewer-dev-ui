<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { getNavModules } from '@/modules/registry'
import type { FvFeature } from '@/shared/module'
import FvLogo from '@/app/images/FvLogo.vue'
import FvNavItem from '@/shared/components/FvNavItem.vue'
import FvUserAvatar from '@/shared/components/FvUserAvatar.vue'
import { useLocale } from '@/app/composables/useLocale'
import { useAuthStore } from '@/app/stores/auth'
import { usePermissionStore } from '@/app/stores/permission'
import ChangePasswordDialog from '@/app/dialogs/ChangePasswordDialog.vue'
import UserProfileDialog from '@/app/dialogs/UserProfileDialog.vue'
import { openInteractiveDialog } from '@/shared/dialog/openInteractiveDialog'
import { useModalDialog } from '@/shared/dialog/useModalDialog'
import { useAlertToast } from '@/shared/toast/useAlertToast'
import { useThemeMode } from '@/app/composables/useThemeMode'
import type { AppLocale } from '@/app/i18n'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const permission = usePermissionStore()
const { toggle: toggleTheme, isDark } = useThemeMode()
const { locale, setLocale } = useLocale()

/** 语言选项（用各自语言的本地名称，不随界面语言翻译） */
const languageItems = [
  { title: '中文', value: 'zh-CN' },
  { title: 'English', value: 'en-US' },
]

const rail = ref(false)

/**
 * 收起侧栏 = 一并收起全部一级分组（选中态随路由保留）；
 * 展开 = 若有选中的菜单则打开其所在一级分组（选中项不变），否则不展开任何分组。
 */
function setRail(next: boolean) {
  if (next) {
    openGroups.value = []
  } else {
    syncOpenGroups() // 有选中 → 打开所在分组；无选中（如 Home）→ 保持全部收起
  }
  rail.value = next
}

function toggleRail() {
  setRail(!rail.value)
}

/**
 * rail 收起态下点击任意一级菜单 → 自动展开侧栏（展开后分组状态一律「跟随选中项」，
 * 不受点击的是哪个分组影响）。捕获阶段监听：分组头事件在此吞掉，阻止 Vuetify 内部
 * 的开合切换；叶子项（Home 等）放行，让路由跳转照常发生。
 */
function onRailListClick(e: MouseEvent) {
  if (!rail.value) return
  const item = (e.target as HTMLElement).closest('.v-list-item')
  if (!item) return
  setRail(false)
  if (item.closest('.v-list-group')) e.stopPropagation()
}

/** Home 固定一级项（壳层本地常量）；模块一级 + 功能树直接消费核心模型（2026-10-16 收敛） */
const homeItem = { key: 'nav.home', icon: 'fas fa-house', path: '/' }
/** 导航按权限过滤生成（URL 命中模块/功能组放行整棵子树；无权限功能整组隐藏，规则见 registry.getNavModules） */
const navModules = computed(() => getNavModules(permission.isGranted))

/** 导航链路节点（模块/功能统一视图：面包屑与分组展开态消费） */
interface TrailNode {
  key: string
  id: string
  group: boolean
}

/** 导航树递归寻径：返回从一级到当前路由的完整链路（任意层级同一原理，用户定稿 2026-10-14）。
 *  先探子级再匹配自身——节点既是页面又挂子项时，深层精确匹配优先于前缀匹配 */
function featureTrail(features: FvFeature[], path: string, trail: TrailNode[]): TrailNode[] | null {
  for (const f of features) {
    const next = [...trail, { key: f.key, id: f.id, group: !!f.children?.length }]
    if (f.children?.length) {
      const found = featureTrail(f.children, path, next)
      if (found) return found
    }
    if (f.url && (f.url === path || path.startsWith(f.url + '/'))) return next
  }
  return null
}

function findTrail(path: string): TrailNode[] | null {
  for (const m of navModules.value) {
    const found = featureTrail(m.features, path, [{ key: m.key, id: m.id, group: true }])
    if (found) return found
  }
  return null
}

const trail = computed(() => (route.name === 'home' ? null : findTrail(route.path)))

/** 分组展开态 = 当前链路上的全部分组（含多级嵌套分组） */
const openGroups = ref<string[]>([])
function syncOpenGroups() {
  const t0 = trail.value
  if (t0) openGroups.value = t0.filter((n) => n.group).map((n) => n.id)
}
watch(() => route.path, syncOpenGroups, { immediate: true })

/** 面包屑 = 导航链路（一级 > … > 当前页）；Home 是独立一级菜单，仅 Home 页显示 Home */
const breadcrumbs = computed(() => {
  if (route.name === 'home') return [{ title: t('nav.home') }]
  const t0 = trail.value
  if (t0 && t0.length > 0) {
    return t0.map((it, i) => ({ title: t(it.key), to: i === t0.length - 1 ? route.path : undefined }))
  }
  const titleKey = route.meta.titleKey as string | undefined
  return titleKey ? [{ title: t(titleKey) }] : []
})

const themeIcon = computed(() => (isDark.value ? 'fas fa-sun' : 'fas fa-moon'))

// ===== 用户菜单：修改密码 / 登出 =====
const userMenu = ref(false)
const dialog = useModalDialog()
const toast = useAlertToast()

/** 修改密码：经 openInteractiveDialog 编程式打开（业务弹窗继承 FvInteractiveDialog 基类，跨界面传参由此组织） */
function onChangePassword() {
  void openInteractiveDialog(ChangePasswordDialog)
}

/** 用户信息：登录档案 + 足迹展示弹窗（openInteractiveDialog，2026-10-18） */
function onShowProfile() {
  userMenu.value = false
  void openInteractiveDialog(UserProfileDialog)
}

/** 登出：公共确认 Dialog（2026-10-14 迁移自自建 v-dialog），确认后清会话回登录页 */
/* ===== 未活动自动登出看门狗（2026-10-21 用户定稿）=====
   阈值 = 登录下发的策略 idleLogoutMinutes 分钟（-1/缺 → 不启用）；
   活动侦测 = 窗口 pointerdown/keydown/wheel/scroll（捕获期，冒泡被组件截断亦可见），
   10s 节流记戳；15s 巡检超时 → 登出 + 警告 Toast + 回登录页（reason=idle 提示条）。 */
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'scroll'] as const
const TOUCH_THROTTLE_MS = 10_000
const TICK_MS = 15_000
let lastActivityAt = Date.now()
let lastTouchAt = 0
let idleTicker: ReturnType<typeof setInterval> | null = null

function onTouch() {
  const now = Date.now()
  if (now - lastTouchAt < TOUCH_THROTTLE_MS) return
  lastTouchAt = now
  lastActivityAt = now
}

async function idleLogoutNow() {
  stopIdleWatch()
  await auth.logout()
  toast.warning(t('login.idleLogout'))
  router.replace({ path: '/login', query: { reason: 'idle' } })
}

function tickIdle() {
  const limit = auth.idleLogoutMinutes
  if (limit <= 0) return
  if (Date.now() - lastActivityAt >= limit * 60_000) void idleLogoutNow()
}

function startIdleWatch() {
  if (idleTicker !== null) return
  for (const e of ACTIVITY_EVENTS) window.addEventListener(e, onTouch, { passive: true, capture: true })
  lastActivityAt = Date.now()
  idleTicker = setInterval(tickIdle, TICK_MS)
}

function stopIdleWatch() {
  if (idleTicker !== null) {
    clearInterval(idleTicker)
    idleTicker = null
  }
  for (const e of ACTIVITY_EVENTS) window.removeEventListener(e, onTouch, { capture: true })
}

/* Esc 协调已上收至 FvInteractiveDialogHost 全局仲裁器（2026-10-22，见该文件注释）：
   有 v-menu 在场时代之以外点关闭、业务栈顶走模型通路关——本壳层不再自听 keydown。
   看门狗 ACTIVITY_EVENTS 的 keydown 捕获仍保留（活动计时与关闭无关）。 */
onMounted(startIdleWatch)
onBeforeUnmount(stopIdleWatch)

async function onLogout() {
  userMenu.value = false
  if (!(await dialog.confirm(t('topbar.logoutConfirm')))) return
  await auth.logout()
  router.replace('/login')
}
</script>

<template>
  <div class="vui-shell">
    <!-- 左侧一级菜单：底色跟随明暗主题，展开 260px / 收起 68px -->
    <v-navigation-drawer permanent :rail="rail" :width="260" :rail-width="68" class="vui-sidebar">
      <div class="vui-sidebar__logo">
        <FvLogo :size="32" />
        <span class="vui-sidebar__brand">{{ t('app.title') }}</span>
      </div>
      <v-list
        v-model:opened="openGroups"
        nav
        bg-transparent
        density="compact"
        class="vui-sidebar__list"
        @click.capture="onRailListClick"
      >
        <!-- Home（一级，带图标）：不走 router-link（/ 是全部模块路由的父记录，
             router-link 会恒判 active 且误挂 aria-current，2026-10-15 修 Bug）——
             点击导航 + active 精确匹配，与其他菜单同一选中逻辑 -->
        <v-list-item
          :active="route.path === homeItem.path"
          :prepend-icon="homeItem.icon"
          :title="t(homeItem.key)"
          rounded="lg"
          @click="router.push(homeItem.path ?? '/')"
        />

        <!-- 模块一级（带图标）由壳渲染；功能层递归 FvNavItem（核心模型 FvModule/FvFeature 直消费） -->
        <v-list-group v-for="m in navModules" :key="m.id" :value="m.id">
          <template #activator="{ props: groupProps }">
            <v-list-item v-bind="groupProps" :prepend-icon="m.icon" :title="t(m.key)" rounded="lg" />
          </template>
          <FvNavItem v-for="f in m.features" :key="f.id" :feature="f" />
        </v-list-group>
      </v-list>
    </v-navigation-drawer>

    <!-- 顶部栏：吸顶 + 毛玻璃（高度 48px，用户调优 2026-10-14） -->
    <v-app-bar flat :height="48" class="vui-topbar">
      <v-app-bar-nav-icon :title="rail ? t('app.title') : ''" size="small" @click="toggleRail">
        <v-icon icon="fas fa-bars" size="18" />
      </v-app-bar-nav-icon>
      <v-breadcrumbs :items="breadcrumbs" class="pa-0" />
      <v-spacer />

      <!-- 右侧操作组：语言 / 主题 / 用户，统一间距（ga-4）、垂直居中、距右 24px（用户定稿 2026-10-14） -->
      <div class="vui-topbar-actions">
        <!-- 语言选择：图标按钮 + 弹出菜单（中文 / English，当前项带勾选） -->
        <v-menu location="bottom end">
          <template #activator="{ props: menuProps }">
            <v-tooltip location="bottom" open-delay="300" :text="t('topbar.language')">
              <template #activator="{ props: tipProps }">
                <v-btn
                  v-bind="{ ...menuProps, ...tipProps }"
                  icon
                  variant="text"
                  size="small"
                  :aria-label="t('topbar.language')"
                >
                  <v-icon icon="fas fa-language" size="18" />
                </v-btn>
              </template>
            </v-tooltip>
          </template>
          <v-list density="compact" class="py-1" min-width="150">
            <v-list-item
              v-for="lang in languageItems"
              :key="lang.value"
              :title="lang.title"
              :active="locale === lang.value"
              @click="setLocale(lang.value as AppLocale)"
            >
              <template #append>
                <v-icon v-if="locale === lang.value" icon="fas fa-check" size="14" />
              </template>
            </v-list-item>
          </v-list>
        </v-menu>

        <v-tooltip location="bottom" :text="t('topbar.theme')">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              icon
              variant="text"
              size="small"
              :aria-label="t('topbar.theme')"
              @click="toggleTheme"
            >
              <v-icon :icon="themeIcon" size="18" />
            </v-btn>
          </template>
        </v-tooltip>

        <!-- 用户图像：点击弹出菜单（修改密码 / 登出） -->
        <v-menu v-model="userMenu" location="bottom end">
          <template #activator="{ props: menuProps }">
            <v-btn v-bind="menuProps" icon variant="text" size="small" :aria-label="t('topbar.user')">
              <!-- 头像统一渲染（2026-10-22）：JSON 配置（字母/表情）或图片，空=退化首字母 -->
              <FvUserAvatar
                :avatar="auth.profile.avatar"
                :user-name="auth.user.userName"
                :fallback-name="auth.profile.nickName || auth.profile.name"
                :size="24"
              />
            </v-btn>
          </template>
          <v-list density="compact" class="py-1" min-width="180">
            <v-list-item
              prepend-icon="fas fa-address-card"
              :title="t('topbar.profileMenu')"
              @click="onShowProfile"
            />
            <v-list-item
              prepend-icon="fas fa-key"
              :title="t('topbar.changePassword')"
              @click="onChangePassword"
            />
            <v-list-item
              prepend-icon="fas fa-arrow-right-from-bracket"
              :title="t('topbar.logout')"
              @click="onLogout"
            />
          </v-list>
        </v-menu>
      </div>
    </v-app-bar>

    <v-main class="vui-main">
      <a href="#main-content" class="vui-skip-link">{{ t('common.skipToContent') }}</a>
      <div id="main-content" class="vui-content">
        <slot />
      </div>
    </v-main>

    <!-- 修改密码弹窗：独立组件 ChangePasswordDialog，经 openInteractiveDialog() 编程式打开（见 onChangePassword） -->
  </div>
</template>

<style scoped>
/* 侧栏底色跟随明暗主题（用户定稿 2026-10-14：不做恒深色） */
.vui-sidebar {
  background: var(--vui-sidebar-bg) !important;
  border-right: 1px solid var(--vui-sidebar-border);
  transition: width var(--vui-transition-sidebar), transform var(--vui-transition-sidebar);
}

/* v4 的 bg-transparent 布尔属性失效，列表自带 surface 底色会盖住抽屉底色（深色下 #141414 ≠ #090909） */
.vui-sidebar :deep(.v-list) {
  background: transparent !important;
}

.vui-sidebar__logo {
  display: flex;
  align-items: center;
  gap: 10px;
  height: var(--vui-topbar-height); /* 与顶栏同高对齐 */
  padding: 0 20px;
  white-space: nowrap;
  overflow: hidden;
}

/* 品牌文字：15px、加粗，颜色随主题主色变化 */
.vui-sidebar__brand {
  font-size: 15px;
  font-weight: 800;
  color: var(--vui-sidebar-active);
}

.vui-sidebar__list :deep(.v-list-item) {
  color: var(--vui-sidebar-text);
  margin-block: 2px;
  height: 44px; /* 上下间距（用户定稿 2026-10-14：所有层级统一 44px） */
  min-height: 44px;
  padding-block: 0;
  font-size: 14px; /* 菜单统一标准字号（全局标准 14px） */
}

/* 点击水波纹：tokens.css 全局统一浅灰（图标按钮 + 全部菜单项一致） */

/* 一级菜单图标与展开箭头缩小（二/三级无图标，不受影响） */
.vui-sidebar__list :deep(.v-list-item .v-icon) {
  font-size: 15px;
  width: 15px;
  height: 15px;
}

/* 悬停分级（用户定稿 2026-10-14）：一级项悬停不变色；二/三级文字变主题色 */
.vui-sidebar__list :deep(.vui-nav-child:hover) {
  color: var(--vui-sidebar-active);
}

/* 选中项：底色 = 主题色 10% 透明度，文字与图标同变主题色（用户定稿 2026-10-14；悬停/按压仍不变底色） */
.vui-sidebar__list :deep(.v-list-item--active) {
  background: color-mix(in srgb, var(--vui-sidebar-active) 10%, transparent);
  color: var(--vui-sidebar-active);
}

.vui-sidebar__list :deep(.v-list-item--active .v-icon) {
  color: var(--vui-sidebar-active);
}

/* 悬停不变底色：overlay/underlay 已在 tokens.css 全局清零（v-btn / v-list-item 统一基线）；
   侧栏点击反馈为浅灰水波纹 */

/* rail 收起态：文字与箭头由 overflow 随宽度动画平滑裁出视野（不做 display 切换，避免跳变）。
   图标在两种状态下保持同一 x 坐标（起始 padding 26px ≈ 收起态 68px 栏的中心），动画全程不移动。 */
.vui-sidebar.v-navigation-drawer--rail {
  overflow: hidden;
}

.vui-sidebar.v-navigation-drawer--rail :deep(.v-list-item) {
  overflow: hidden;
  padding-inline-end: 0 !important;
}

.vui-sidebar__list :deep(.v-list-item),
.vui-sidebar__logo {
  padding-inline-start: 18px; /* 图标实际落点 = padding + prepend 内偏移 8.5px → 中心 ≈ 34px = 收起态栏中心（两态恒定，动画不移动） */
}

.vui-sidebar__logo {
  padding-inline-end: 0;
  overflow: hidden;
  white-space: nowrap;
}

/* 品牌文字常驻渲染（平滑裁剪）后，防止 flex 把 logo 挤缩；文字整段外溢由 overflow 裁掉 */
.vui-sidebar__logo :deep(svg) {
  flex-shrink: 0;
}

.vui-sidebar__brand {
  flex-shrink: 0;
  transition: opacity var(--vui-transition);
}

/* 收起态品牌文字淡出（裁剪只能切掉栏外部分，栏内仍会露字尾） */
.vui-sidebar.v-navigation-drawer--rail .vui-sidebar__brand {
  opacity: 0;
}

/* 二级菜单：不带图标、缩进对齐一级文字、标准字号 14px、行高与一级一致（44px，用户定稿 2026-10-14） */
.vui-sidebar__list :deep(.v-list-group__items .v-list-item.vui-nav-child) {
  height: 44px;
  min-height: 44px;
  padding-block: 0;
  padding-inline-start: 56px !important;
}

/* 顶栏毛玻璃 */
.vui-topbar {
  background: var(--vui-topbar-bg) !important;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--vui-split);
}

/* 右侧操作组：三项统一 16px 间距、垂直居中、距右 24px */
.vui-topbar-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-right: 24px;
}

.vui-main {
  background: transparent; /* 透出 .v-application 上的全局背景（浅色 = 主题色浅渐变；深色 = 纯色） */
  height: 100vh; /* 主区锁定视口（用户定稿 2026-10-15：页面级不出滚动条） */
  box-sizing: border-box;
  overflow: hidden;
}

/* 唯一允许纵向滚动的区域（布局 Body 区）；横向滚动一律禁止 */
.vui-content {
  height: 100%;
  box-sizing: border-box;
  padding: var(--vui-content-padding);
  max-width: 1680px;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
}


/* 跳到主内容（无障碍基线 · 05 §2.7）：仅获得键盘焦点时出现 */
.vui-skip-link {
  position: absolute;
  left: -9999px;
  top: 8px;
  z-index: 2000;
  padding: 8px 16px;
  border-radius: var(--vui-radius-s);
  background: var(--vui-primary);
  color: rgb(var(--v-theme-on-primary));
  text-decoration: none;
}

.vui-skip-link:focus-visible {
  left: 8px;
}
</style>
