import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { loginRequest, logoutRequest } from '@/api/security-management/authRequest'
import { getDeviceId, getClientIp } from '@/shared/utils/device'

import type { LoginDto } from '@/api/security-management/authTypes'
import { usePermissionStore } from '@/app/stores/permission'

const STORAGE_KEY = 'vui.auth'

/** 登录档案（来源 = LoginDto，2026-10-18 接顶栏头像/菜单）；旧持久化缺字段一律补空串 */
interface StoredUser {
  name: string
  nickName: string
  email: string
  phone: string
  /** 小头像 base64（data URL），空串 = 未提供（顶栏退化为文字缩写） */
  avatar: string
}

/** 登录足迹（LoginDto 随档案下发，2026-10-18 用户信息弹窗消费） */
interface StoredTrace {
  loginTime: string
  lastLoginTime: string
  lastLoginIp: string
}

interface StoredAuth {
  token: string
  /** 过期时刻（epoch ms） */
  expiresAt: number
  user: StoredUser
  trace: StoredTrace
}

const EMPTY_USER: StoredUser = { name: '', nickName: '', email: '', phone: '', avatar: '' }
const EMPTY_TRACE: StoredTrace = { loginTime: '', lastLoginTime: '', lastLoginIp: '' }

function normalizeTrace(raw?: Partial<StoredTrace> | null): StoredTrace {
  return {
    loginTime: raw?.loginTime ?? '',
    lastLoginTime: raw?.lastLoginTime ?? '',
    lastLoginIp: raw?.lastLoginIp ?? '',
  }
}

function normalizeUser(raw?: Partial<StoredUser> | null): StoredUser {
  return {
    name: raw?.name ?? '',
    nickName: raw?.nickName ?? '',
    email: raw?.email ?? '',
    phone: raw?.phone ?? '',
    avatar: raw?.avatar ?? '',
  }
}

function load(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredAuth
    if (!parsed?.token || !parsed?.expiresAt) return null
    // 过期与否交给 expireIfNeeded 判定（守卫需要区分「从未登录」与「登录失效」）；user/trace 归一兼容旧格式
    return {
      token: parsed.token,
      expiresAt: parsed.expiresAt,
      user: normalizeUser(parsed.user),
      trace: normalizeTrace(parsed.trace),
    }
  } catch {
    return null
  }
}

function persist(value: StoredAuth | null): void {
  if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  else localStorage.removeItem(STORAGE_KEY)
}

/** 认证状态：token 本地持久化（含过期时刻），登录失效 = 过期或不存在 */
export const useAuthStore = defineStore('auth', () => {
  const auth = ref<StoredAuth | null>(load())
  let justExpired = auth.value !== null && auth.value.expiresAt <= Date.now()

  const isLoggedIn = computed(() => auth.value !== null && auth.value.expiresAt > Date.now())
  const userName = computed(() => auth.value?.user.name ?? '')
  /** 登录档案（只读）：顶栏头像/用户菜单消费 */
  const profile = computed<StoredUser>(() => auth.value?.user ?? EMPTY_USER)
  /** 登录足迹（只读）：用户信息弹窗消费 */
  const trace = computed<StoredTrace>(() => auth.value?.trace ?? EMPTY_TRACE)

  async function login(username: string, password: string): Promise<LoginDto> {
    // 登录入参 = 账密 + 本机 IP / 设备指纹透传（LoginRo，2026-10-17 口径；IP 尽力获取取不到为空串）
    const res = await loginRequest({ username, password, clientIp: await getClientIp(), deviceId: getDeviceId() })
    // 档案与足迹整体入库（昵称/邮箱/电话/头像 + 本次/上次登录时间、上次登录 IP，随 LoginDto 下发，2026-10-18）
    auth.value = {
      token: res.token,
      expiresAt: Date.now() + res.expiresIn * 1000,
      user: normalizeUser({ name: res.userName, nickName: res.nickName, email: res.email, phone: res.phoneNumber, avatar: res.avatar }),
      trace: normalizeTrace({ loginTime: res.loginTime, lastLoginTime: res.lastLoginTime, lastLoginIp: res.lastLoginIp }),
    }
    justExpired = false
    persist(auth.value)
    // 登录成功即按服务端确认的身份拉取权限清单（菜单/控件权限由此派生，见 stores/permission.ts）
    await usePermissionStore().loadPermissions(res.userName)
    return res
  }

  async function logout(): Promise<void> {
    try {
      await logoutRequest()
    } catch {
      /* 后端登出失败不阻塞本地清理 */
    }
    auth.value = null
    justExpired = false
    persist(null)
    usePermissionStore().clear()
  }

  /** 校验过期（路由守卫每次导航调用）：返回 true = 登录失效（从未登录不算） */
  function expireIfNeeded(): boolean {
    if (auth.value && auth.value.expiresAt <= Date.now()) {
      auth.value = null
      persist(null)
      usePermissionStore().clear() // 会话失效连带清理权限
      justExpired = true
    }
    return justExpired
  }

  return { isLoggedIn, userName, profile, trace, login, logout, expireIfNeeded }
})
