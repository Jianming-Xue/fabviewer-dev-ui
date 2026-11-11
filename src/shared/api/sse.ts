import { onScopeDispose, ref, type Ref } from 'vue'

import { useModalDialog } from '@/shared/dialog/useModalDialog'
import { currentLocale, tShared } from '@/shared/i18n'

import { ApiError } from './errors'
import {
  MOCK_ENABLED,
  baseOf,
  getAuthToken,
  resolveUrl,
  servicePath,
  triggerUnauthorized,
  type RequestBase,
  type ServiceConfig,
} from './http'
import { mockStreamConnect } from './mock'

/**
 * SSE 流式传输基建（2026-11-11 调研定稿，首个消费方 = monitor-alarm「查看告警」实时推送）。
 * 选型：fetch + ReadableStream 手动解析，**不用原生 EventSource**——EventSource 无法携带
 * Authorization 头，而项目登录态是头注入制（setAuthTokenGetter，2026-10-29 定稿），
 * query 传令牌有 nginx/后端日志泄露面；fetch 流还天然复用 401 全局处置与 AbortController。
 *
 * 与 http.ts request 的口径差异（流语义不适用，刻意不套）：
 * - 不走 1 秒去重（长连接重复订阅应由调用方自管）
 * - 不挂全局 Loading 蒙层（流没有「落定」时刻）
 * - 不套 30s 总超时（改为「空闲心跳超时」判线：idleTimeout 内无任何字节即断线重连）
 * 错误收口同 http.ts：非 200 → ApiError(transport) + 全局错误 Dialog（silent 抑制）+ 401 触发
 * 全局未授权处置；流中断/解析失败不弹 Dialog（自动重连/onError 回调，弹窗留给调用方按语境呈现）。
 */

/* ===== 帧解析器 ===== */

/** SSE wire 帧（data 为原始字符串，JSON 解析归派发层） */
export interface SseFrame {
  /** 事件名（帧内未给 event: 时按规范缺省 'message'） */
  event: string
  /** data: 字段原文（多行按规范以 \n 拼接；可能为空串） */
  data: string
  /** 最近一次 id:（规范语义为跨帧持久，派发时每帧携带当前值） */
  id?: string
  /** retry: 字段（ms，服务端建议的重连基准间隔） */
  retry?: number
}

/**
 * 创建 SSE 行解析器（纯状态机，无 IO）：feed 喂入已解码文本，整帧经 onFrame 派发、
 * 注释行（`:` 开头，心跳 ping 即此形态）经 onComment 通报（不派发但算线路活动）。
 * 跨 chunk 残行内部缓冲；CRLF/CR/LF 三种行尾都认；chunk 以孤立 CR 结尾时挂起待下一片
 * （避免 CRLF 被拆两片导致多派发一次空行）。未知字段按规范忽略。
 */
export function createSseParser(onFrame: (frame: SseFrame) => void, onComment?: () => void) {
  let buf = ''
  let event = ''
  let dataLines: string[] = []
  let id: string | undefined
  let retry: number | undefined

  function dispatch(): void {
    // 规范：data 与 event 均空的派发是 no-op（连续空行/心跳后空行不产生帧）
    if (!dataLines.length && !event) return
    onFrame({ event: event || 'message', data: dataLines.join('\n'), id, retry })
    event = ''
    dataLines = []
    retry = undefined
    // id 不重置：last-event-id 跨帧持久（规范语义）
  }

  function line(ln: string): void {
    if (ln === '') return dispatch()
    if (ln.startsWith(':')) return void onComment?.()
    const ci = ln.indexOf(':')
    const field = ci >= 0 ? ln.slice(0, ci) : ln
    let value = ci >= 0 ? ln.slice(ci + 1) : ''
    if (value.startsWith(' ')) value = value.slice(1) // 规范：冒号后单个前导空格剔除
    switch (field) {
      case 'event':
        event = value
        break
      case 'data':
        dataLines.push(value)
        break
      case 'id':
        if (!value.includes('\u0000')) id = value // 含 NUL 的 id 按规范忽略
        break
      case 'retry': {
        const n = Number(value)
        if (Number.isInteger(n) && n >= 0) retry = n
        break
      }
      default:
        break // 未知字段忽略
    }
  }

  return {
    feed(text: string): void {
      buf += text
      const limit = buf.endsWith('\r') ? buf.length - 1 : buf.length
      let start = 0
      for (let i = 0; i < limit; i++) {
        const c = buf[i]
        if (c === '\n' || c === '\r') {
          line(buf.slice(start, i))
          if (c === '\r' && buf[i + 1] === '\n') i++
          start = i + 1
        }
      }
      buf = buf.slice(start)
    },
  }
}

/* ===== 连接层 ===== */

export type SseState = 'connecting' | 'open' | 'reconnecting' | 'closed'

/** 派发帧（data 已 JSON 解析为 T；data 为空串时 data=undefined 形态由调用方按 T 自判） */
export interface SseEvent<T = unknown> {
  event: string
  data: T
  id?: string
}

export interface SseOptions {
  /** URL 查询参数（同 RequestOptions.params） */
  params?: Record<string, string | number | boolean | undefined>
  /** 抑制非 200 全局错误 Dialog（同 RequestOptions.silent 口径） */
  silent?: boolean
  /** 空闲心跳超时 ms：期间无任何字节（含注释行心跳）即判定断线、abort 进重连；
   *  默认 45_000，≤0 = 不判空闲（后端无心跳机制时才关） */
  idleTimeout?: number
  /** 禁用自动重连（默认断线/服务端关闭即指数退避重连；关闭后 state 直接走 closed） */
  noReconnect?: boolean
  /** 业务帧回调（JSON 解析失败的帧不派发至此，走 onError） */
  onEvent?: (evt: SseEvent) => void
  /** 错误回调（HTTP 非 200 / 流中断 / 帧 data 解析失败；前两者伴随自动重连或 closed） */
  onError?: (err: ApiError) => void
  /** 连接状态迁移回调 */
  onState?: (state: SseState) => void
}

export interface SseHandle {
  /** 关闭连接（幂等）：abort 在飞请求、清退避/空闲定时器，之后不再重连 */
  close(): void
  /** 当前连接状态（同步读；变化经 onState 通报） */
  readonly state: SseState
}

/** 自有退避基准/上限（ms；仅在后端从未发过 retry: 帧时生效——契约 2026-11-12：
 *  收到过 retry 即按其毫秒数固定等待，不再叠加指数退避） */
const BASE_RETRY_MS = 1_000
const MAX_RETRY_MS = 30_000
/** 默认空闲心跳超时（ms；后端契约建议心跳 15~30s 一帧，45s 留两倍余量） */
const DEFAULT_IDLE_TIMEOUT = 45_000

/** error 保留帧 data → ApiError（errCode=200 业务失败口径，同 telemetryRequest 壳失败惯例；
 *  errMsg/message 优先、非 JSON data 原文兜底——前端只消费 errMsg 不消费 code 的既定口径） */
function toStreamError(rawData: string): ApiError {
  let errMsg: string | undefined
  try {
    const body = JSON.parse(rawData) as { errMsg?: string | null; message?: string | null }
    errMsg = body?.errMsg ?? body?.message ?? undefined
  } catch {
    /* data 非 JSON：原文作 errMsg */
  }
  return new ApiError(200, errMsg ?? (rawData || 'SSE stream error'))
}

/**
 * 建立 SSE 连接（立即发起，异步收帧）。Mock 模式（VITE_MOCK=true）走 registerMockStream
 * 注册表、不发 fetch；真实分支 URL = resolveUrl（Host 五档链自动生效），头注入 Bearer /
 * Accept-Language / Accept: text/event-stream，重连时带 Last-Event-ID 续传。
 */
export function sseConnect<T = unknown>(path: string, opts: SseOptions = {}, base?: RequestBase): SseHandle {
  let state: SseState = 'connecting'
  let closed = false
  let ctrl: AbortController | null = null
  let retryTimer = 0
  let idleTimer = 0
  let backoff = BASE_RETRY_MS
  /** 服务端 retry: 帧给定的重连等待（ms；收到过即恒用它，跨重连持久，规范语义） */
  let serverRetryMs: number | undefined
  let lastEventId: string | undefined
  let mockClose: (() => void) | null = null
  const idleTimeout = opts.idleTimeout ?? DEFAULT_IDLE_TIMEOUT

  function setState(s: SseState): void {
    state = s
    opts.onState?.(s)
  }

  /** 空闲判线重臂：超时即 abort 当前连接（read 循环抛 AbortError → 进重连） */
  function armIdle(): void {
    if (idleTimeout <= 0) return
    window.clearTimeout(idleTimer)
    idleTimer = window.setTimeout(() => {
      ctrl?.abort()
      mockClose?.()
      scheduleReconnect()
    }, idleTimeout)
  }

  function clearTimers(): void {
    window.clearTimeout(retryTimer)
    window.clearTimeout(idleTimer)
    retryTimer = 0
    idleTimer = 0
  }

  /** 派发帧：id/retry 先入账（Last-Event-ID 续传 + 重连等待随服务端），data JSON 解析失败
   *  走 onError 不断流（单帧坏数据不该杀连接）。
   *  **error 是保留事件名（后端契约 2026-11-12）**：流内业务错误帧不当普通事件派发 onEvent，
   *  收口 onError（toStreamError，transport=false）；服务端发完 error 帧即关流，
   *  断开后照常走重连流程（retry/退避等待 + Last-Event-ID 续传） */
  function dispatchFrame(frame: { event: string; data: string; id?: string; retry?: number }): void {
    if (frame.id !== undefined) lastEventId = frame.id
    if (frame.retry !== undefined && frame.retry > 0) serverRetryMs = frame.retry
    if (frame.event === 'error') {
      opts.onError?.(toStreamError(frame.data))
      return
    }
    let data: T
    if (frame.data === '') {
      data = undefined as T
    } else {
      try {
        data = JSON.parse(frame.data) as T
      } catch {
        opts.onError?.(new ApiError(-1, `SSE frame data is not valid JSON (event=${frame.event})`))
        return
      }
    }
    opts.onEvent?.({ event: frame.event, data, id: frame.id })
  }

  function scheduleReconnect(): void {
    if (closed) return
    if (opts.noReconnect) return setState('closed')
    setState('reconnecting')
    // 等待策略（后端契约 2026-11-12）：收到过 retry: 帧 = 按其毫秒数固定等待；
    // 从未收到 = 自有指数退避 1s→2s→…→30s 封顶（open 即重置）
    const wait = serverRetryMs ?? backoff
    if (serverRetryMs === undefined) backoff = Math.min(backoff * 2, MAX_RETRY_MS)
    retryTimer = window.setTimeout(() => void connect(), wait)
  }

  /** HTTP 非 200 收口（与 http.ts execute 同口径）：errMsg 优先响应体、401 触发全局处置、
   *  非 silent 弹全局错误 Dialog；返回是否可重连（401 会话已清，重连无意义） */
  async function failHttp(res: Response): Promise<boolean> {
    let errMsg: string | undefined
    try {
      const body = (await res.json()) as { errMsg?: string | null; message?: string | null }
      errMsg = body?.errMsg ?? body?.message ?? undefined
    } catch {
      /* 非 JSON 响应体：errMsg 留空走状态码兜底 */
    }
    const err = new ApiError(res.status, errMsg)
    err.transport = true
    if (res.status === 401) triggerUnauthorized()
    if (!opts.silent)
      void useModalDialog().error(
        errMsg ?? (res.status === 401 ? tShared('common.httpUnauthorized') : tShared('common.httpError', { code: res.status })),
      )
    opts.onError?.(err)
    return res.status !== 401
  }

  async function connectReal(): Promise<void> {
    const headers: Record<string, string> = {
      Accept: 'text/event-stream',
      'Accept-Language': currentLocale(),
    }
    const bearer = getAuthToken()
    if (bearer) headers['Authorization'] = `Bearer ${bearer}`
    if (lastEventId) headers['Last-Event-ID'] = lastEventId
    ctrl = new AbortController()
    let res: Response
    try {
      res = await fetch(resolveUrl(base, path, opts.params), { headers, signal: ctrl.signal })
    } catch (e) {
      if (closed) return
      if ((e as Error)?.name !== 'AbortError') {
        // 网络层失败（断网/DNS/CORS）：不弹 Dialog（重连中反复弹是骚扰），onError 通报后进重连
        const err = new ApiError(0, (e as Error)?.message || 'network error')
        err.transport = true
        opts.onError?.(err)
      }
      return scheduleReconnect()
    }
    if (closed) return
    if (!res.ok) {
      const retryable = await failHttp(res)
      if (retryable) scheduleReconnect()
      else setState('closed')
      return
    }
    if (!res.body) {
      opts.onError?.(new ApiError(0, 'SSE response has no body'))
      return scheduleReconnect()
    }
    setState('open')
    backoff = BASE_RETRY_MS
    const decoder = new TextDecoder()
    const parser = createSseParser(dispatchFrame, armIdle)
    const reader = res.body.getReader()
    armIdle()
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        armIdle() // 任何字节都算线路活动（心跳注释行在 parser.feed 内走 onComment 再喂一次，幂等）
        parser.feed(decoder.decode(value, { stream: true }))
      }
      parser.feed(decoder.decode()) // flush 解码器尾字节
    } catch (e) {
      // 主动 close()/空闲 abort 的 AbortError 静默；其余读取错误通报后照常重连
      if (!closed && (e as Error)?.name !== 'AbortError') {
        const err = new ApiError(0, (e as Error)?.message || 'stream read error')
        err.transport = true
        opts.onError?.(err)
      }
    }
    if (closed) return
    // 服务端正常关闭流也重连（SSE 语义：流是长连接，断开即异常态）
    scheduleReconnect()
  }

  async function connectMock(): Promise<void> {
    try {
      mockClose = await mockStreamConnect(servicePath(base, path), { params: opts.params }, (frame) => {
        armIdle()
        dispatchFrame(frame)
      })
    } catch (e) {
      // mock 未注册（404）重连也不会自愈：直接 onError + closed，不弹 Dialog（同 mockRequest 抛错口径）
      opts.onError?.(e instanceof ApiError ? e : new ApiError(0, (e as Error)?.message))
      return setState('closed')
    }
    if (closed) return void mockClose?.()
    setState('open')
    backoff = BASE_RETRY_MS
    armIdle()
  }

  function connect(): Promise<void> {
    if (closed) return Promise.resolve()
    if (state !== 'reconnecting') setState('connecting')
    return MOCK_ENABLED ? connectMock() : connectReal()
  }

  void connect()

  return {
    close(): void {
      if (closed) return
      closed = true
      clearTimers()
      ctrl?.abort()
      mockClose?.()
      setState('closed')
    },
    get state(): SseState {
      return state
    },
  }
}

/** 微服务级 SSE 工厂（与 createServiceRequest 对称）：绑定该服务 config（service/host 链） */
export function createServiceSse(cfg: ServiceConfig) {
  const base = baseOf(cfg)
  return <T = unknown>(path: string, opts: SseOptions = {}): SseHandle => sseConnect<T>(path, opts, base)
}

/* ===== Composable ===== */

/**
 * 组件/作用域内 SSE 订阅：立即建流，onScopeDispose 自动 close（卸载即断流，防泄漏）。
 * state 额外含 'idle' 初值（首帧 onState 同步到达前的瞬时态）；事件/错误仍走 opts 回调。
 */
export function useSse<T = unknown>(path: string, opts: SseOptions = {}, base?: RequestBase) {
  const state = ref<SseState | 'idle'>('idle') as Ref<SseState | 'idle'>
  const handle = sseConnect<T>(
    path,
    {
      ...opts,
      onState: (s) => {
        state.value = s
        opts.onState?.(s)
      },
    },
    base,
  )
  onScopeDispose(() => handle.close())
  return { state, close: () => handle.close() }
}
