import { ApiError } from '../errors'

export interface MockContext {
  params?: Record<string, string | number | undefined>
  body?: Record<string, unknown>
}

type Handler = (ctx: MockContext) => unknown

/**
 * Mock 处理器注册表（注册式）：各模块在自己的 api/mock.ts 里注册，
 * 随模块装卸 —— 卸载模块时其 mock 一并消失。
 * key 形如 `GET /security-management/api/v1/roles/page`：method + 服务前缀后的完整路径
 * （与真实请求同口径，2026-10-17 更新；旧 /log-viewer 前缀口径已废）。
 */
const handlers = new Map<string, Handler>()

export function registerMock(method: string, path: string, handler: Handler): void {
  handlers.set(`${method} ${path}`, handler)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function mockRequest<T>(
  method: string,
  path: string,
  ctx: MockContext,
): Promise<T> {
  const handler = handlers.get(`${method} ${path}`)
  if (!handler) throw new ApiError(404, `mock handler missing: ${method} ${path}`)
  // 模拟网络延迟，便于观察加载态（05 §4.3 状态六件套）
  await delay(120 + Math.random() * 260)
  return handler(ctx) as T
}
