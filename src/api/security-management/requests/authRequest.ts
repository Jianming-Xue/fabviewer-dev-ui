import { ApiError } from '@/shared/api/errors'

import { securityReply, securityRequest } from './request'

import { isLoginFailCode, LoginFailError } from '../types/authTypes'
import { decodeUserDto } from '../datetimeCodec'

import type { ChangePasswordRo, LoginDto, LoginRo } from '../types/authTypes'

/**
 * 认证/权限接口（security-management 服务，前缀 /api/v1/auth，2026-10-17 文件分类同角色口径：
 * 业务对象在 ./types，本文件只放调用）：
 * 登录 POST /login（LoginRo → LoginDto）；登出 POST /logout（空体，静默失败不阻塞本地清理）；
 * 修改密码 POST /change_password（ChangePasswordRo → null）；
 * 权限 GET /permissions（URL query username → 权限串清单）。
 * 走服务私有请求层 securityRequest（交易头 + SecurityReplyDto 出参壳，2026-10-22 壳口径改版）。
 * 登录前调用时交易头 userName 为空串（尚未有登录态），属正常口径。
 * 函数保留 *Request 命名——stores/auth 已有局部 login/logout，避免同名遮蔽。
 */

/** 1 · 登录（公共接口，不属于任何业务模块）——特殊壳口径（2026-10-22 随新壳对齐）：
 *  登录业务失败 = success 0（新壳常规判据）且 errMsg 携 LoginFailCode 机器码；
 *  success=1 但 errMsg 非空仍按失败防御处理；非枚举的 errMsg 视为后端直发文案 */
export async function loginRequest(ro: LoginRo): Promise<LoginDto> {
  const env = await securityReply<LoginDto>('loginRequest', 'POST', '/api/v1/auth/login', { body: ro })
  const errMsg = env.errMsg?.trim() ?? ''
  if (env.success !== 1 || errMsg) {
    if (isLoginFailCode(errMsg)) throw new LoginFailError(errMsg)
    throw new ApiError(200, errMsg || undefined)
  }
  return { ...env.data, user: decodeUserDto(env.data.user) } // 档案日期 wire→UI（2026-10-28 codec）
}

/** 2 · 登出（失败不阻塞本地清理，silent 抑制全局错误 Dialog） */
export function logoutRequest(): Promise<null> {
  return securityRequest<null>('logoutRequest', 'POST', '/api/v1/auth/logout', { body: {}, silent: true })
}

/** 3 · 修改密码（登录页未登录场景与主界面已登录场景共用，用户名显式入参） */
export function changePasswordRequest(ro: ChangePasswordRo): Promise<null> {
  return securityRequest<null>('changePasswordRequest', 'POST', '/api/v1/auth/change_password', { body: ro })
}

/** 4 · 权限清单（登录后按用户名拉取）：字符串数组，格式约定见 app/stores/permission.ts */
export function fetchPermissions(username: string): Promise<string[]> {
  return securityRequest<string[]>('fetchPermissions', 'GET', '/api/v1/auth/permissions', {
    params: { username },
  })
}

// Mock 注册点已迁至 ./config.ts（项目约定 2026-10-18：Mock 一律收在 api 层服务入口）

// Mock 注册点已迁至 ../config.ts（项目约定 2026-10-18：Mock 一律收在 api 层服务入口）
