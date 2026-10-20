<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

import FvLogo from '@/app/images/FvLogo.vue'
import FvCheckbox from '@/shared/components/FvCheckbox.vue'
import FvTextInput from '@/shared/components/FvTextInput.vue'
import LoginArtLog from '@/app/images/LoginArtLog.vue'
import LoginArtReport from '@/app/images/LoginArtReport.vue'
import { changePasswordRequest } from '@/api/security-management/requests/authRequest'
import { LoginFailError } from '@/api/security-management/types/authTypes'
import { useAuthStore } from '@/app/stores/auth'
import { newPwdPolicyRule } from '@/shared/utils/pwdPolicy'
import { ApiError } from '@/shared/api/errors'
import { useAlertToast } from '@/shared/toast/useAlertToast'
import { useModalDialog } from '@/shared/dialog/useModalDialog'

import type { LoginFailCode } from '@/api/security-management/types/authTypes'

/** 登录失败码 → i18n 文案键（errMsg 是机器码，展示归前端词典，2026-10-17 口径） */
const LOGIN_FAIL_TEXT: Record<LoginFailCode, string> = {
  AUTH_FAILED: 'login.failAuthFailed',
  ACCOUNT_INVALID: 'login.failAccountInvalid',
  ACCOUNT_EXPIRED: 'login.failAccountExpired',
  ACCOUNT_LOCKED: 'login.failAccountLocked',
  PASSWORD_EXPIRED: 'login.failPasswordExpired',
}

const REMEMBER_KEY = 'vui.rememberUser'

/** 左侧展示：一张圆圈代表一张图（内联矢量组件）；点击圆圈切换，当前项拉长为胶囊；每 10s 自动轮换（手动点击后重置计时） */
const slides = [LoginArtLog, LoginArtReport] as const
const slideTexts = computed(() => [t('login.slideLogCaption'), t('login.slideReportCaption')])
const activeSlide = ref(0)

const SLIDE_INTERVAL = 10_000
let slideTimer: number | undefined

function startSlideTimer() {
  window.clearInterval(slideTimer)
  slideTimer = window.setInterval(() => {
    activeSlide.value = (activeSlide.value + 1) % slides.length
  }, SLIDE_INTERVAL)
}

function selectSlide(index: number) {
  activeSlide.value = index
  startSlideTimer()
}

onMounted(startSlideTimer)
onUnmounted(() => {
  window.clearInterval(slideTimer)
})

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

/** 登录 / 修改密码 由独立 URL 控制（用户定稿 2026-10-14）：/login 与 /change-password */
type Mode = 'login' | 'change-pwd'
const mode = computed<Mode>(() => (route.path === '/change-password' ? 'change-pwd' : 'login'))

/** 反转动画只作用于卡片（用户定稿 2026-10-14）：前进（登录→修改密码）正向翻、返回反向翻 */
const flipName = ref('flip-forward')
watch(mode, (to) => {
  flipName.value = to === 'change-pwd' ? 'flip-forward' : 'flip-back'
})

const form = reactive({ username: '', password: '', remember: false })
const pwdForm = reactive({ username: '', oldPassword: '', newPassword: '', confirmPassword: '' })
const formRef = ref()
const pwdFormRef = ref()
const loading = ref(false)

/** 全局成功 Toast（圆形实体图标前缀、成功色边框 + 20% 透明底、5s 自动消失，见 shared/toast） */
const toast = useAlertToast()

/** 全局失败 Dialog（错误图标标题、复制 + OK，正文为接口 errMsg，见 shared/dialog） */
const dialog = useModalDialog()

// 记住我：回填上次记住的用户名（登录与修改密码共用）
form.username = localStorage.getItem(REMEMBER_KEY) ?? ''
form.remember = !!form.username
pwdForm.username = form.username

const rules = {
  required: (v: string) => !!v || t('validation.required'),
  /** 新密码限制（2026-10-20 统一口径）：登录页改密卡 = 未登录无策略 → 基础长度 6~18；
   *  与顶栏改密弹窗共用工厂，若会话策略已载（异常回跳场景）自动按策略校验 */
  policy: newPwdPolicyRule(() => auth.loginPolicy, t),
  match: (v: string) => v === pwdForm.newPassword || t('login.passwordMismatch'),
}

/** 模式切换 = 路由跳转（两个独立 URL） */
function switchMode() {
  pwdFormRef.value?.resetValidation()
  formRef.value?.resetValidation()
  router.push(mode.value === 'login' ? '/change-password' : '/login')
}

/** 失败反馈文案：优先接口返回的 errMsg（用户定稿 2026-10-14：登录/修改密码失败用失败 Dialog 呈现） */
function apiErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.errMsg) return e.errMsg
    if (e.errCode === 400 || e.errCode === 401) return t('login.invalidCredentials')
  }
  return t('login.failed')
}

/** 登录成功后回到来源页（守卫带的 redirect），无来源则回首页 */
async function onLogin() {
  const { valid } = await formRef.value.validate()
  if (!valid) return
  loading.value = true
  try {
    await auth.login(form.username.trim(), form.password)
    // 记住我：持久化用户名（不勾选则清除）
    if (form.remember) localStorage.setItem(REMEMBER_KEY, form.username.trim())
    else localStorage.removeItem(REMEMBER_KEY)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    toast.success(t('login.loginSuccess'))
    router.replace(redirect)
  } catch (e) {
    // 传输层非 200 已由 shared/http 全局呈现；登录业务失败 = 错误 Dialog + 点掉后按码动作（2026-10-17 口径）
    if (e instanceof ApiError && e.transport) return
    if (e instanceof LoginFailError) {
      await dialog.error(t(LOGIN_FAIL_TEXT[e.failCode]))
      switch (e.failCode) {
        case 'AUTH_FAILED': // 密码错误：清空密码重输
          form.password = ''
          break
        case 'ACCOUNT_INVALID': // 账户不存在：用户名与密码都清空重输
          form.username = ''
          form.password = ''
          break
        case 'PASSWORD_EXPIRED': // 密码过期：自动跳转改密码（用户名带出）
          pwdForm.username = form.username.trim()
          void router.replace('/change-password')
          break
        // ACCOUNT_EXPIRED / ACCOUNT_LOCKED：文案已提示联系管理员，无后续前端动作
      }
    } else {
      void dialog.error(apiErrorMessage(e))
    }
  } finally {
    loading.value = false
  }
}

/** 修改密码：成功后回登录模式（用户名带出） */
async function onChangePassword() {
  const { valid } = await pwdFormRef.value.validate()
  if (!valid) return
  loading.value = true
  try {
    await changePasswordRequest({
      username: pwdForm.username.trim(),
      oldPassword: pwdForm.oldPassword,
      newPassword: pwdForm.newPassword,
    })
    form.username = pwdForm.username.trim()
    form.password = ''
    pwdForm.oldPassword = ''
    pwdForm.newPassword = ''
    pwdForm.confirmPassword = ''
    pwdFormRef.value?.resetValidation()
    router.replace('/login') // 修改成功自动回登录页
    toast.success(t('login.changeSuccess'))
  } catch (e) {
    if (!(e instanceof ApiError && e.transport)) void dialog.error(apiErrorMessage(e))
  } finally {
    loading.value = false
  }
}

/** 守卫因登录失效跳转而来时提示 */
const expired = route.query.reason === 'expired'
</script>

<template>
  <v-main class="vui-login">
    <!-- 左侧展示区：占据「页面左缘 → 登录卡左缘」整段，内容居中即该段的中央；
         圆圈代表内联矢量组件、可点击切换，当前项拉长；图片上下轻微浮动 + 淡入淡出切换，每 10s 自动轮换 -->
    <div class="vui-login__showcase">
      <div class="vui-login__art-float">
        <transition name="vui-art">
          <component :is="slides[activeSlide]" :key="activeSlide" class="vui-login__art" />
        </transition>
      </div>
      <p class="vui-login__art-caption">{{ slideTexts[activeSlide] }}</p>
      <div class="vui-login__dots">
        <button
          v-for="(slide, i) in slides"
          :key="i"
          type="button"
          class="vui-login__dot"
          :class="{ 'vui-login__dot--active': activeSlide === i }"
          :aria-label="`slide-${i + 1}`"
          @click="selectSlide(i)"
        />
      </div>
    </div>

    <div class="vui-login__stage">
      <transition :name="flipName" mode="out-in">
        <v-card :key="mode" elevation="0" class="vui-login__card">
      <!-- 品牌区：logo 居中放大 + 欢迎语 -->
      <div class="vui-login__brand">
        <FvLogo :size="88" />
        <h1 class="text-h6 font-weight-bold mt-4">{{ mode === 'login' ? t('login.hello') : t('login.changePasswordMode') }}</h1>
      </div>

      <v-alert
        v-if="expired"
        type="info"
        variant="tonal"
        density="compact"
        class="mb-4"
        :text="t('login.expired')"
      />

      <!-- 登录模式 -->
      <v-form v-if="mode === 'login'" ref="formRef" class="vui-form-col" @submit.prevent="onLogin">
        <FvTextInput
          v-model="form.username"
          :label="t('login.username')"
          :rules="[rules.required]"
          required
          autocomplete="username"
          prepend-icon="fas fa-user"
        />
        <FvTextInput
          v-model="form.password"
          type="password"
          :label="t('login.password')"
          :rules="[rules.required]"
          required
          autocomplete="current-password"
        />
        <FvCheckbox v-model="form.remember" :label="t('login.rememberMe')" class="mt-1"
        />
        <v-btn block color="primary" type="submit" :loading="loading" class="mt-6">
          {{ t('login.signIn') }}
        </v-btn>
      </v-form>

      <!-- 修改密码模式 -->
      <v-form v-else ref="pwdFormRef" class="vui-form-col" @submit.prevent="onChangePassword">
        <FvTextInput
          v-model="pwdForm.username"
          :label="t('login.username')"
          :rules="[rules.required]"
          required
          autocomplete="username"
          prepend-icon="fas fa-user"
        />
        <FvTextInput
          v-model="pwdForm.oldPassword"
          type="password"
          :label="t('login.oldPassword')"
          :rules="[rules.required]"
          required
          autocomplete="current-password"
        />
        <FvTextInput
          v-model="pwdForm.newPassword"
          type="password"
          :label="t('login.newPassword')"
          :rules="[rules.required, rules.policy]"
          required
          autocomplete="new-password"
        />
        <FvTextInput
          v-model="pwdForm.confirmPassword"
          type="password"
          :label="t('login.confirmPassword')"
          :rules="[rules.required, rules.match]"
          required
          autocomplete="new-password"
        />
        <v-btn block color="primary" type="submit" :loading="loading" class="mt-2">
          {{ t('login.confirmChange') }}
        </v-btn>
      </v-form>

      <!-- 右下角：登录 ⇄ 修改密码 超链接切换（登录态箭头在后向右；修改态箭头在前向左） -->
      <div class="vui-login__switch">
        <a v-if="mode === 'login'" href="#" @click.prevent="switchMode">
          {{ t('login.changePasswordMode') }}
          <v-icon icon="fas fa-arrow-right" size="13" />
        </a>
        <a v-else href="#" @click.prevent="switchMode">
          <v-icon icon="fas fa-arrow-left" size="13" />
          {{ t('login.backToLogin') }}
        </a>
      </div>
    </v-card>
      </transition>
    </div>
  </v-main>
</template>

<style scoped>
.vui-login {
  /* 登录框整体右移 —— 靠右布局，右边距 12vw（可调） */
  --vui-login-inset: clamp(48px, 12vw, 220px);
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: var(--vui-login-inset);
  /* 背景固定为浅色渐变值（不随主题切换）：#2F7D5A 12% 调入 #F9FAFB（用户定稿 2026-10-14） */
  background: linear-gradient(to bottom right, #e1ebe7, #f9fafb);
  overflow: hidden;
}

/* 左侧展示区：flex 占满「页面左缘 → 登录卡左缘」整段，内容居中 = 该段中央 */
.vui-login__showcase {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
}

/* 图片上下轻微浮动（呼吸感）；放外层包裹，与内层切换过渡互不干扰 */
.vui-login__art-float {
  position: relative;
  animation: vui-art-float 6s ease-in-out infinite;
}

@keyframes vui-art-float {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-8px);
  }
}

/* 切换过渡：新旧交叉淡入淡出（旧图瞬时脱离文档流叠在下层，不留空白） */
.vui-art-enter-active {
  transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.vui-art-leave-active {
  transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: absolute;
  inset: 0;
}

.vui-art-enter-from,
.vui-art-leave-to {
  opacity: 0;
}

.vui-login__art {
  width: min(26vw, 380px);
  height: auto;
  display: block;
  /* 毛刺优化：缩小渲染的细线锯齿用亚像素模糊抹平 + GPU 平滑插值 */
  filter: blur(0.4px);
  transform: translateZ(0);
}

/* 图下简述：主题色 17px 加粗居中 */
.vui-login__art-caption {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--vui-primary);
  text-align: center;
}

/* 圆圈：一个代表一张 SVG；底色 = 主题色；当前项拉长为胶囊，其余保持圆点 */
.vui-login__dots {
  display: flex;
  gap: 12px;
}

.vui-login__dot {
  width: 10px;
  height: 10px;
  border-radius: var(--vui-radius-full);
  background: var(--vui-primary);
  border: none;
  padding: 0;
  cursor: pointer;
  transition: width 150ms cubic-bezier(0.4, 0, 0.2, 1);
}

.vui-login__dot--active {
  width: 26px;
  cursor: default;
}

@media (max-width: 960px) {
  .vui-login__showcase {
    display: none;
  }
}

/* 卡片舞台：3D 景深容器（背景与整页不动，只有卡片翻转） */
.vui-login__stage {
  perspective: 1400px;
  position: relative;
  z-index: 1;
}

.flip-forward-enter-active,
.flip-forward-leave-active,
.flip-back-enter-active,
.flip-back-leave-active {
  transition:
    transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 正向（登录 → 修改密码） */
.flip-forward-enter-from {
  transform: rotateY(70deg);
  opacity: 0;
}

.flip-forward-leave-to {
  transform: rotateY(-70deg);
  opacity: 0;
}

/* 反向（修改密码 → 登录） */
.flip-back-enter-from {
  transform: rotateY(-70deg);
  opacity: 0;
}

.flip-back-leave-to {
  transform: rotateY(70deg);
  opacity: 0;
}

.vui-login__card {
  position: relative;
  width: 400px;
  max-width: calc(100vw - 48px);
  /* 毛玻璃：半透表面 + 背景模糊（浅色渐变从卡后透出） */
  background: color-mix(in srgb, var(--vui-bg-container) 62%, transparent);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid color-mix(in srgb, var(--vui-primary) 18%, transparent);
  box-shadow: 0 8px 32px rgba(6, 13, 17, 0.12);
  padding: 44px 36px 36px;
  border-radius: var(--vui-radius);
}

/* 品牌区：logo 水平居中 */
.vui-login__brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 24px;
}

/* 右下角模式切换超链接 */
.vui-login__switch {
  margin-top: 20px;
  text-align: right;
}

.vui-login__switch a {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: var(--vui-primary);
  text-decoration: none;
}

.vui-login__switch a:hover {
  text-decoration: underline;
}

/* 记住我复选框缩小 */
.vui-login :deep(.v-selection-control__input) {
  width: 16px;
  height: 16px;
}

.vui-login :deep(.v-selection-control__input .v-icon) {
  font-size: 16px;
}
</style>
