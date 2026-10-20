import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { fetchPermissions } from '@/api/security-management/requests/authRequest'

const STORAGE_KEY = 'vui.permissions'

/**
 * 功能权限（用户定稿 2026-10-15 规则）：
 * - 后端只回字符串 JSON list，格式为前端约定——功能权限 `Function:<完整URL>`，
 *   控件权限 `Control:<完整URL>:<控件ID>`
 * - 登录成功后拉取并自行拆分为 功能权限（URL 集合）与 控件权限（URL+控件ID 集合）
 * - 菜单过滤在导航生成时完成（registry.getNavItems 传入 isGranted 谓词）：
 *   URL 命中模块/功能组 → 其下全部功能放行；命中功能 → 仅该功能；
 *   模块/功能组下无任何有权限功能 → 整组不显示
 */

function load(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? (parsed as string[]) : []
  } catch {
    return []
  }
}

export const usePermissionStore = defineStore('permission', () => {
  const list = ref<string[]>(load())

  const functionUrls = computed(
    () => new Set(list.value.filter((s) => s.startsWith('Function:')).map((s) => s.slice('Function:'.length))),
  )

  /** 控件权限键：`<功能URL>@<控件ID>`（@ 分隔避免与 URL/ID 内的冒号混淆） */
  const controlKeys = computed(
    () =>
      new Set(
        list.value
          .filter((s) => s.startsWith('Control:'))
          .map((s) => {
            const rest = s.slice('Control:'.length)
            const idx = rest.lastIndexOf(':')
            return idx > 0 ? `${rest.slice(0, idx)}@${rest.slice(idx + 1)}` : ''
          })
          .filter(Boolean),
      ),
  )

  /** 控件通配（功能级全开）：不带控件 ID 的 `Control:<功能URL>` */
  const controlWildcards = computed(
    () =>
      new Set(
        list.value
          .filter((s) => s.startsWith('Control:') && !s.slice('Control:'.length).includes(':'))
          .map((s) => s.slice('Control:'.length)),
      ),
  )

  /**
   * 排除串（2026-10-16 权限树三态机引入）：`Deny:<功能URL>` / `Deny:<功能URL>:<控件ID>`——
   * 祖先授权期间对单个节点的显式取消（被动选中→取消选中的唯一一致表示），前端约定、后端不关心格式。
   * 权限树编辑器在级联取消时写入整棵子树的 Deny，故此处按精确匹配减法即可。
   */
  const denyUrls = computed(
    () => new Set(list.value.filter((s) => s.startsWith('Deny:') && !s.slice(5).includes(':')).map((s) => s.slice(5))),
  )
  const denyControlKeys = computed(() => {
    const out = new Set<string>()
    for (const s of list.value) {
      if (!s.startsWith('Deny:')) continue
      const rest = s.slice(5)
      const idx = rest.lastIndexOf(':')
      if (idx > 0) out.add(`${rest.slice(0, idx)}@${rest.slice(idx + 1)}`)
    }
    return out
  })

  /** 功能/模块 URL 是否放行（供导航生成匹配）；Deny 优先于 Function 授权 */
  function isGranted(url: string): boolean {
    return functionUrls.value.has(url) && !denyUrls.value.has(url)
  }

  /** 页内受管控控件是否放行：功能级通配 或 精确控件串，且未被 Deny（控件级或其功能级）排除 */
  function hasControl(featureUrl: string, controlId: string): boolean {
    if (denyUrls.value.has(featureUrl) || denyControlKeys.value.has(`${featureUrl}@${controlId}`)) return false
    return controlWildcards.value.has(featureUrl) || controlKeys.value.has(`${featureUrl}@${controlId}`)
  }

  /** 登录后按用户名拉取权限清单（接口失败按空清单处理 = 无权限，fail-closed） */
  async function loadPermissions(username: string): Promise<void> {
    try {
      set(await fetchPermissions(username))
    } catch {
      set([])
    }
  }

  function set(items: string[]): void {
    list.value = items
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }

  function clear(): void {
    list.value = []
    localStorage.removeItem(STORAGE_KEY)
  }

  return {
    list,
    functionUrls,
    controlKeys,
    controlWildcards,
    denyUrls,
    denyControlKeys,
    isGranted,
    hasControl,
    loadPermissions,
    set,
    clear,
  }
})
