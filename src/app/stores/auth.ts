import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { loginRequest, logoutRequest } from '@/api/security-management/requests/authRequest'
import { fetchPolicyDetail } from '@/api/security-management/requests/policyRequest'
import { getDeviceId, getClientIp } from '@/shared/utils/device'

import type { LoginDto } from '@/api/security-management/types/authTypes'
import type { PolicyDto } from '@/api/security-management/types/policyTypes'
import type { UserDto } from '@/api/security-management/types/userTypes'
import { usePermissionStore } from '@/app/stores/permission'

const STORAGE_KEY = 'vui.auth'

/** Token 有效期临时定值（2026-10-20：LoginDto.expiresIn 已移除，
 *  后续有效期口径并入登录策略统一后再改为策略驱动） */
const TOKEN_TTL_MS = 8 * 3600 * 1000

const DEFAULT_IDLE_LOGOUT_MINUTES = 30

/** 'YYYY-MM-DD HH:mm:ss' → epoch ms；''/非法 → null */
function toDateTs(s: string): number | null {
  if (!s) return null
  const t = new Date(s.replace(' ', 'T')).getTime()
  return Number.isNaN(t) ? null : t
}

/** 账户/密码到期卡点（用户定稿 2026-10-21，路由守卫叠加）：档案到期时刻早于当前即失效 */
function dateExpired(u: UserDto): boolean {
  const now = Date.now()
  const a = toDateTs(u.accountExpiresAt)
  const p = toDateTs(u.passwordExpiresAt)
  return (a !== null && a < now) || (p !== null && p < now)
}

/** 空档案（初始/旧持久化格式兜底；旧版本存的是扁平档案，读不出的字段一律补默认） */
const EMPTY_USER: UserDto = {
  userId: '',
  userName: '',
  nickName: '',
  email: '',
  phoneNumber: '',
  avatar: '',
  enabled: 0,
  roleIds: [],
  policyId: '',
  createdAt: '',
  accountActiveAt: '',
  accountExpiresAt: '',
  passwordChangedAt: '',
  passwordExpiresAt: '',
  lastLoginTime: '',
  lastLoginIp: '',
  passwordValidDays: -1,
  accountValidDays: -1,
}

interface StoredAuth {
  token: string
  /** 过期时刻（epoch ms） */
  expiresAt: number
  /** 未活动登出分钟（登录下发，-1=不开启；旧持久化缺省回 30，2026-10-21） */
  idleLogoutMinutes: number
  /** 用户档案（LoginDto 嵌套改版 2026-10-20：整包 UserDto 入库，头像/足迹随档案） */
  user: UserDto
}

function normalizeUser(raw?: Partial<UserDto> | null): UserDto {
  return { ...EMPTY_USER, ...raw, roleIds: [...(raw?.roleIds ?? [])] }
}

function load(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredAuth
    if (!parsed?.token || !parsed?.expiresAt) return null
    // 过期与否交给 expireIfNeeded 判定（守卫需要区分「从未登录」与「登录失效」）；user 归一兼容旧格式
    return {
      token: parsed.token,
      expiresAt: parsed.expiresAt,
      idleLogoutMinutes: Number.isFinite(parsed.idleLogoutMinutes) ? parsed.idleLogoutMinutes : 30,
      user: normalizeUser(parsed.user),
    }
  } catch {
    return null
  }
}

function persist(value: StoredAuth | null): void {
  if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  else localStorage.removeItem(STORAGE_KEY)
}

/** 认证状态：token + 用户档案本地持久化（含过期时刻），登录失效 = 过期或不存在 */
export const useAuthStore = defineStore('auth', () => {
  const auth = ref<StoredAuth | null>(load())
  let justExpired = auth.value !== null && auth.value.expiresAt <= Date.now()

  /** 登录策略详情（2026-10-20）：登录返回 user.policyId 非空时异步拉取；
   *  null = 无策略或拉取失败（不阻塞登录）——修改密码退化为基础长度限制（6~18）；
   *  仅存内存不持久化：刷新后按新会话登录重新拉取 */
  const loginPolicy = ref<PolicyDto | null>(null)
  /** 未活动登出分钟数（FvShell 看门狗消费；未登录/非法值 → 0 = 不启用） */
  const idleLogoutMinutes = computed(() => {
    const v = auth.value?.idleLogoutMinutes
    return auth.value && Number.isFinite(v) && (v as number) > 0 ? (v as number) : 0
  })

  const isLoggedIn = computed(() => auth.value !== null && auth.value.expiresAt > Date.now())
  const userName = computed(() => auth.value?.user.userName ?? '')
  /** 用户档案全量（只读）：用户信息弹窗等消费 */
  const user = computed<UserDto>(() => auth.value?.user ?? EMPTY_USER)
  /** 顶栏便捷视图（头像/昵称/邮箱/电话） */
  const profile = computed(() => ({
    name: user.value.userName,
    nickName: user.value.nickName,
    email: user.value.email,
    phone: user.value.phoneNumber,
    avatar: user.value.avatar,
  }))

  async function login(username: string, password: string): Promise<LoginDto> {
    // 登录入参 = 账密 + 本机 IP / 设备指纹透传（LoginRo，2026-10-17 口径；IP 尽力获取取不到为空串）
    const res = await loginRequest({ username, password, clientIp: await getClientIp(), deviceId: getDeviceId() })
    // 档案整体入库（嵌套 UserDto：昵称/邮箱/电话/头像 + 上次登录时间/IP，2026-10-20 改版）
    auth.value = {
      token: res.token,
      expiresAt: Date.now() + TOKEN_TTL_MS,
      idleLogoutMinutes: Number.isFinite(res.idleLogoutMinutes) ? res.idleLogoutMinutes : DEFAULT_IDLE_LOGOUT_MINUTES,
      user: normalizeUser(res.user),
    }
    justExpired = false
    persist(auth.value)
    // 登录策略：policyId 非空 → 异步拉详情（不阻塞登录跳转；失败静默，改密走基础限制）
    loginPolicy.value = null
    if (res.user.policyId) {
      void fetchPolicyDetail(res.user.policyId).then(
        (policy) => {
          loginPolicy.value = policy
        },
        () => {
          /* 详情拉取失败不影响登录：修改密码限制自动退化为基础内容（6~18 长度） */
        },
      )
    }
    // 登录成功即按服务端确认的身份拉取权限清单（菜单/控件权限由此派生，见 stores/permission.ts）
    await usePermissionStore().loadPermissions(res.user.userName)
    return res
  }

  async function logout(): Promise<void> {
    try {
      await logoutRequest()
    } catch {
      /* 后端登出失败不阻塞本地清理 */
    }
    auth.value = null
    loginPolicy.value = null
    justExpired = false
    persist(null)
    usePermissionStore().clear()
  }

  /** 单属性本地同步（2026-10-20 用户信息弹窗行内编辑）：/users/attribute 提交成功后调用，
   *  会话档案即唯一事实源，同步持久化供刷新后沿用 */
  function patchUser(patch: Partial<UserDto>): void {
    if (!auth.value) return
    auth.value = { ...auth.value, user: { ...auth.value.user, ...patch } }
    persist(auth.value)
  }

  /** 校验过期（路由守卫每次导航调用）：返回 true = 登录失效（从未登录不算）。
   *  2026-10-21 叠加日期卡点：token 时刻过期 或 账户/密码到期时间早于当前 → 清会话 */
  function expireIfNeeded(): boolean {
    if (auth.value && (auth.value.expiresAt <= Date.now() || dateExpired(auth.value.user))) {
      auth.value = null
      loginPolicy.value = null
      persist(null)
      usePermissionStore().clear() // 会话失效连带清理权限
      justExpired = true
    }
    return justExpired
  }

  return { isLoggedIn, userName, user, profile, loginPolicy, idleLogoutMinutes, login, logout, patchUser, expireIfNeeded }
})
