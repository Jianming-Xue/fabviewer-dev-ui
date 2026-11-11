import { ApiError } from '../errors'

export interface MockContext {
  params?: Record<string, string | number | boolean | undefined>
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

/* ===== Mock 流式通道（2026-11-11，SSE 基建 shared/api/sse.ts 专用） =====
   注册表独立于请求-响应 handlers；键口径同 registerMock（服务前缀后完整路径），流只有 GET。
   push 的 data 经 JSON.stringify 上线（与真实 SSE 帧 data=字符串同形态），
   由 sse.ts 同一解析/派发路径消费——mock 与真实分支共用帧处理代码。 */

/** mock 流帧（wire 形态，与 sse.ts SseFrame 同构） */
export interface MockStreamFrame {
  event: string
  data: string
  id?: string
}

/** 流内推帧函数（data 任意值，上线前 JSON.stringify） */
export type MockStreamPush = (event: string, data: unknown, id?: string) => void

/** 流 emitter：建连后调用，自行定时/按需 push；返回值作连接关闭时的 cleanup */
export type MockStreamEmitter = (ctx: MockContext, push: MockStreamPush) => (() => void) | void

const streamHandlers = new Map<string, MockStreamEmitter>()

/** 注册 mock 流处理器（path = 服务前缀后完整路径，同 registerMock 口径） */
export function registerMockStream(path: string, emitter: MockStreamEmitter): void {
  streamHandlers.set(`GET ${path}`, emitter)
}

/** 建立 mock 流连接：模拟建连延迟（与 mockRequest 同节奏 120~380ms）后启动 emitter，
 *  期间 push 的帧经 onFrame 回流；resolve 出关闭句柄（幂等：清延迟定时器 + 调 emitter cleanup）。
 *  未注册路径拒绝 ApiError(404)，与 mockRequest 同款。 */
export async function mockStreamConnect(
  path: string,
  ctx: MockContext,
  onFrame: (frame: MockStreamFrame) => void,
): Promise<() => void> {
  const emitter = streamHandlers.get(`GET ${path}`)
  if (!emitter) throw new ApiError(404, `mock stream handler missing: GET ${path}`)
  let cleanup: (() => void) | void
  let closed = false
  const timer = setTimeout(() => {
    if (closed) return
    cleanup = emitter(ctx, (event, data, id) => {
      if (!closed) onFrame({ event, data: JSON.stringify(data), id })
    })
  }, 120 + Math.random() * 260)
  return () => {
    closed = true
    clearTimeout(timer)
    if (typeof cleanup === 'function') cleanup()
  }
}
