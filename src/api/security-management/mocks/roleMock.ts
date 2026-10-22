import { registerMock } from '@/shared/api/mock'

import { BUILTIN_ROLE_ID } from '../types/roleTypes'

import type { AssignRolePermissionRo, RoleDto, RoleNameDto, RoleRo } from '../types/roleTypes'
import type { PageDto, SecurityReplyDto } from '../types/types'

/**
 * security-management 服务 Mock（2026-10-22 后端改版口径）：出参统一壳
 * { code: 'OK'/失败 'FAIL'(字符串), success: 1=成功/0=失败, errMsg, data, txId }
 * （txId 回显——Mock 无请求头上下文，一律空串）；分页 data = { pageSize, pageIndex, totalSize, totalPage, data }。
 * 角色布尔一律数字 1/0；删除与是否启用经 URL query 传参；内置角色按 roleId === BUILTIN_ROLE_ID 守卫。
 * 业务失败（内置角色保护/ID 重复/未找到）以 success:0 + errMsg 返回，演练前端失败分支。
 */
const ok = <T>(data: T): SecurityReplyDto<T> => ({ code: 'OK', success: 1, errMsg: '', data, txId: '' })
const fail = (errMsg: string): SecurityReplyDto<null> => ({ code: 'FAIL', success: 0, errMsg, data: null, txId: '' })
/** 内存态角色集（业务命名真实；权限串遵循 Function:/Control: 前端规则）。
 *  导出供名称字典接口活引用（rows 原地变更即时反映）；用户 Mock 只存 roleId，
 *  ID→Name 翻译在前端 ./rolePolicyNameCollection（2026-10-20 定稿） */
export const rows: RoleDto[] = [
  {
    roleId: BUILTIN_ROLE_ID,
    roleName: '系统管理员',
    description: '全部模块与控件的完整权限',
    enabled: 1,
    permissions: [
      'Function:/log-searching',
      'Function:/config',
      'Function:/security',
      'Control:/log-searching/mes-rule-info',
      'Control:/config/srv-hang',
      'Control:/security/roles',
      'Control:/security/users',
    ],
  },
  {
    roleId: 'OPR-ENGINEER',
    roleName: '运维工程师',
    description: '检索全功能 + 配置维护（不含删除）',
    enabled: 1,
    permissions: [
      'Function:/log-searching/mes-rule-info',
      'Control:/log-searching/mes-rule-info',
      'Function:/config/srv-hang',
      'Control:/config/srv-hang:config.srv-hang.add',
      'Control:/config/srv-hang:config.srv-hang.edit',
    ],
  },
  {
    roleId: 'VIEWER',
    roleName: '只读用户',
    description: '仅日志检索查看',
    enabled: 0,
    permissions: ['Function:/log-searching/mes-rule-info'],
  },
  // 分页演示样本（2026-10-16 扩充至 15 条，pageSize 10 下两页）
  {
    roleId: 'AUDITOR',
    roleName: '审计角色',
    description: '跨模块只读 + 报表导出',
    enabled: 1,
    permissions: [
      'Function:/log-searching/mes-rule-info',
      'Function:/config/srv-hang',
      'Control:/log-searching/mes-rule-info:rule-searching.export',
    ],
  },
  {
    roleId: 'ETL-OPERATOR',
    roleName: 'ETL 操作员',
    description: '日志下载与列设置',
    enabled: 1,
    permissions: [
      'Function:/log-searching/mes-rule-info',
      'Control:/log-searching/mes-rule-info:rule-searching.full-log',
      'Control:/log-searching/mes-rule-info:rule-searching.columns',
    ],
  },
  {
    roleId: 'EQUIP-ENGINEER',
    roleName: '设备工程师',
    description: '配置维护全控件',
    enabled: 1,
    permissions: ['Function:/config/srv-hang', 'Control:/config/srv-hang'],
  },
  {
    roleId: 'MAINT-TECH',
    roleName: '维护技术员',
    description: '配置查看与状态切换',
    enabled: 0,
    permissions: ['Function:/config/srv-hang', 'Control:/config/srv-hang:config.srv-hang.toggle-status'],
  },
  {
    roleId: 'NIGHT-OPR',
    roleName: '夜班操作员',
    description: '仅检索主功能',
    enabled: 1,
    permissions: ['Function:/log-searching/mes-rule-info'],
  },
  {
    roleId: 'PROCESS-ENGINEER',
    roleName: '工艺工程师',
    description: '检索 + 规则日志弹窗',
    enabled: 1,
    permissions: [
      'Function:/log-searching/mes-rule-info',
      'Control:/log-searching/mes-rule-info:rule-searching.rule-log',
    ],
  },
  {
    roleId: 'QA-VIEWER',
    roleName: '质量查看员',
    description: '检索与配置只读',
    enabled: 1,
    permissions: ['Function:/log-searching/mes-rule-info', 'Function:/config/srv-hang'],
  },
  {
    roleId: 'REPORT-VIEWER',
    roleName: '报表查看员',
    description: '仅导出控件',
    enabled: 0,
    permissions: [
      'Function:/log-searching/mes-rule-info',
      'Control:/log-searching/mes-rule-info:rule-searching.export',
    ],
  },
  {
    roleId: 'ROLE-AUDITOR',
    roleName: '角色审计员',
    description: '角色管理只读视角',
    enabled: 1,
    permissions: ['Function:/security/roles'],
  },
  {
    roleId: 'SPC-OPERATOR',
    roleName: 'SPC 操作员',
    description: '检索全控件',
    enabled: 1,
    permissions: ['Function:/log-searching/mes-rule-info', 'Control:/log-searching/mes-rule-info'],
  },
  {
    roleId: 'TRAINING',
    roleName: '培训角色',
    description: '仅检索主功能（演示用）',
    enabled: 0,
    permissions: ['Function:/log-searching/mes-rule-info'],
  },
  {
    roleId: 'YIELD-ANALYST',
    roleName: '良率分析员',
    description: '检索 + 导出 + 全量下载',
    enabled: 1,
    permissions: [
      'Function:/log-searching/mes-rule-info',
      'Control:/log-searching/mes-rule-info:rule-searching.export',
      'Control:/log-searching/mes-rule-info:rule-searching.full-log',
    ],
  },
]

registerMock('GET', '/security-management/api/v1/roles/page', ({ params }) => {
  const pageIndex = Number(params?.pageIndex ?? 1)
  const pageSize = Number(params?.pageSize ?? 10)
  const kw = String(params?.keyword ?? '').trim().toLowerCase()
  const filtered = kw
    ? rows.filter((r) => [r.roleId, r.roleName, r.description].some((v) => v.toLowerCase().includes(kw)))
    : [...rows]
  const sorted = filtered.sort((a, b) => a.roleId.localeCompare(b.roleId))
  const start = (pageIndex - 1) * pageSize
  const page: PageDto<RoleDto> = {
    pageSize,
    pageIndex,
    totalSize: sorted.length,
    totalPage: Math.max(1, Math.ceil(sorted.length / pageSize)),
    data: sorted.slice(start, start + pageSize).map((r) => ({ ...r, permissions: [...r.permissions] })),
  }
  return ok(page)
})

/** 新建：入参 RoleRo；enabled/permissions 后端初始化（启用 + 空权限） */
registerMock('POST', '/security-management/api/v1/roles', ({ body }) => {
  const input = body as unknown as RoleRo
  if (!input?.roleId?.trim()) return fail('roleId 不能为空')
  if (!input?.roleName?.trim()) return fail('roleName 不能为空')
  if (rows.some((r) => r.roleId === input.roleId)) return fail('该角色 ID 已存在') // 角色 ID 唯一
  const created: RoleDto = {
    roleId: input.roleId.trim(),
    roleName: input.roleName.trim(),
    description: input.description ?? '',
    enabled: 1,
    permissions: [],
  }
  rows.unshift(created)
  return ok({ ...created, permissions: [...created.permissions] })
})

/** 编辑：入参 RoleRo（不含 enabled/permissions——各自独立接口）；内置角色名称/描述可改 */
registerMock('PUT', '/security-management/api/v1/roles', ({ body }) => {
  const input = body as unknown as RoleRo
  const row = rows.find((r) => r.roleId === input?.roleId)
  if (!row) return fail('角色不存在')
  if (!input?.roleName?.trim()) return fail('roleName 不能为空')
  const updated: RoleDto = { ...row, roleName: input.roleName.trim(), description: input.description ?? '' }
  rows[rows.indexOf(row)] = updated
  return ok({ ...updated, permissions: [...updated.permissions] })
})

/** 删除：roleId 经 URL query；内置角色服务端守卫拒删 */
registerMock('DELETE', '/security-management/api/v1/roles', ({ params }) => {
  const roleId = String(params?.roleId ?? '')
  const row = rows.find((r) => r.roleId === roleId)
  if (!row) return fail('角色不存在')
  if (row.roleId === BUILTIN_ROLE_ID) return fail('内置角色不可删除')
  rows.splice(rows.indexOf(row), 1)
  return ok(null)
})

/** 分配权限：AssignRolePermissionRo 请求体；内置角色禁改 */
registerMock('POST', '/security-management/api/v1/roles/permissions', ({ body }) => {
  const ro = body as unknown as AssignRolePermissionRo
  const row = rows.find((r) => r.roleId === ro?.roleId)
  if (!row) return fail('角色不存在')
  if (row.roleId === BUILTIN_ROLE_ID) return fail('内置角色不可修改权限')
  rows[rows.indexOf(row)] = { ...row, permissions: [...(ro.permissions ?? [])] }
  return ok(null)
})

/** 全局角色名称字典（活引用 rows：增删改名即时反映到用户侧下拉/缓存刷新） */
registerMock('GET', '/security-management/api/v1/roles/name/list', () =>
  ok<RoleNameDto[]>(rows.map((r) => ({ roleId: r.roleId, roleName: r.roleName }))),
)

/** 是否启用：URL query 传参，enabled 严格 0/1；内置角色禁停用 */
registerMock('POST', '/security-management/api/v1/roles/enabled', ({ params }) => {
  const roleId = String(params?.roleId ?? '')
  const enabled = Number(params?.enabled)
  if (enabled !== 0 && enabled !== 1) return fail('enabled 必须为 0 或 1')
  const row = rows.find((r) => r.roleId === roleId)
  if (!row) return fail('角色不存在')
  if (row.roleId === BUILTIN_ROLE_ID && enabled === 0) return fail('内置角色不可禁用')
  rows[rows.indexOf(row)] = { ...row, enabled }
  return ok(null)
})
