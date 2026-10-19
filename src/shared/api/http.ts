import { useModalDialog } from '@/shared/dialog/useModalDialog'
import { tShared } from '@/shared/i18n'
import { acquireLoading, releaseLoading } from '@/shared/loading/loadingState'

import { mockRequest } from './mock'
import { ApiError } from './errors'


/**
 * 请求基址（2026-10-17 定稿）：service 属后端拓扑、与 UI 模块解耦，src/api 按微服务分目录维护；
 * 各服务 config.ts 只提供 service 名 + 可选编译期专属 Host（ServiceConfig.host）。
 * 实际请求 URL = host + /service + 后端给定接口路径（如
 * http://127.0.0.1:8081/security-management/api/v1/roles/page）。
 * Host 生效优先级见 hostOf：运行时 app-config.json（服务级 > 全局）> 构建 env FV_APP_HOST
 * > 服务代码默认 > 内置兜底；无服务前缀的调用（预留）走后三档。
 */
/** 全局后端 Host 构建 env（FV_APP_HOST，可缺省——缺省下移到后备链） */
export const GLOBAL_API_HOST: string = (import.meta.env.FV_APP_HOST as string) || ''
/** 内置兜底 Host（上述各档全部缺省时） */
const DEFAULT_API_HOST = 'http://127.0.0.1:8081'

export interface RequestBase {
  host: string
  service?: string
  /** 该服务的超时解析结果（ms；≤0 = 不限时） */
  timeout?: number
}

/** 微服务配置（2026-10-17 定稿）：由各服务 api 目录的 config.ts 提供——
 *  service 名 + 可选编译期专属 Host / 超时（不写则按全局链解析；版本号已迁 UI 模块 FvModule.version，不在本对象） */
export interface ServiceConfig {
  service: string
  host?: string
  /** 编译期服务级默认超时（ms）；省略走全局链，-1 = 该服务显式不超时 */
  timeout?: number
}

/** Mock 开关（.env 的 VITE_MOCK） */
export const MOCK_ENABLED = import.meta.env.VITE_MOCK === 'true'

export interface RequestOptions {
  /** URL 查询参数 */
  params?: Record<string, string | number | undefined>
  /** JSON 请求体 */
  body?: unknown
  /** 自定义请求头（服务私有头如交易头由服务 api 层注入） */
  headers?: Record<string, string>
  /** 抑制共享层非 200 全局错误 Dialog（登出等静默场景） */
  silent?: boolean
  /** 全局接口 Loading 蒙层（调用方决定，默认不加载）：
   *  true = 请求发出前显示、落定后消失（shared/loading/FvLoadingHost 单片浮层，并发请求共享计数） */
  loading?: boolean
}

/** 服务前缀后的接口路径（Mock 注册键与真实请求共用同一路径口径） */
function servicePath(base: RequestBase | undefined, path: string): string {
  return base?.service ? `/${base.service}${path}` : path
}

/** 请求生效 Host：服务 Host（baseOf 已按 hostOf 优先级算好）> 运行时 globalHost > env > 内置兜底 */
function hostOfBase(base?: RequestBase): string {
  return base?.host || runtimeConfig?.globalHost || GLOBAL_API_HOST || DEFAULT_API_HOST
}

/** 绝对请求 URL（host + service + path + query）；raw fetch 场景（文件下载等）亦用此拼接 */
export function resolveUrl(base: RequestBase | undefined, path: string, params?: RequestOptions['params']): string {
  const url = new URL(hostOfBase(base) + servicePath(base, path))
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v))
    }
  }
  return url.toString()
}

/* ===== 同接口 1 秒去重取消（用户定稿 2026-10-17） =====
   键 = method + 服务前缀路径 + params + body；窗口内的重复请求不再发起，直接复用窗口内
   的 promise（即取消重复的那次），调用方共享同一结果/拒绝；窗口过期惰性清理。 */
const DEDUP_WINDOW_MS = 1000
const dedup = new Map<string, { promise: Promise<unknown>; ts: number }>()

function dedupKey(method: string, finalPath: string, opts: RequestOptions): string {
  return `${method} ${finalPath}?${JSON.stringify(opts.params ?? {})}#${JSON.stringify(opts.body ?? null)}`
}

/**
 * 通用请求入口（去重 + 可选全局 Loading）：Mock 与真实分支共用同一去重/Loading 策略。
 * base 由 createServiceRequest 注入（微服务 host/service）；不传 = 全局公共接口。
 * 出参壳解析/交易头等服务私有事不在本层（见各服务 api 目录，2026-10-16 定稿）。
 */
export function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  opts: RequestOptions = {},
  base?: RequestBase,
): Promise<T> {
  const finalPath = servicePath(base, path)
  const key = dedupKey(method, finalPath, opts)
  const ts = Date.now()
  const hit = dedup.get(key)
  const promise =
    hit && ts - hit.ts < DEDUP_WINDOW_MS ? (hit.promise as Promise<T>) : start<T>(method, finalPath, opts, base, key, ts)
  if (opts.loading) {
    acquireLoading()
    // 双分支 then 即结算监听（避免 finally 链上派生 rejection 触发 unhandledrejection 噪声）；
    // 去重复用的调用方各自 acquire/release，计数平衡
    void promise.then(releaseLoading, releaseLoading)
  }
  return promise
}

/** 实际发起并登记去重窗口（窗口过期惰性清理） */
function start<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  finalPath: string,
  opts: RequestOptions,
  base: RequestBase | undefined,
  key: string,
  ts: number,
): Promise<T> {
  const promise = execute<T>(method, finalPath, opts, base)
  dedup.set(key, { promise, ts })
  window.setTimeout(() => {
    if (dedup.get(key)?.ts === ts) dedup.delete(key)
  }, DEDUP_WINDOW_MS)
  return promise
}

async function execute<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  finalPath: string,
  opts: RequestOptions,
  base?: RequestBase,
): Promise<T> {
  if (MOCK_ENABLED) {
    // Mock 原样返回各服务注册 handler 的产物（出参壳与否由各服务 api 层自决）
    return mockRequest<T>(method, finalPath, {
      params: opts.params,
      body: opts.body as Record<string, unknown> | undefined,
    })
  }

  // GET 不携带请求体（unicorn/no-invalid-fetch-options）；公共事务止于「发请求、等回复、
  // 非 2xx 统一收口、返回 JSON 原文」——出参壳解析属服务私有事，由各服务 api 层负责
  const init: RequestInit = { method }
  const headers: Record<string, string> = { ...opts.headers }
  if (method !== 'GET' && opts.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(opts.body)
  }
  if (Object.keys(headers).length) init.headers = headers
  // finalPath 已含服务前缀，此处不再经 resolveUrl（避免二次叠加前缀）；Host 与 resolveUrl 同链
  const url = new URL(hostOfBase(base) + finalPath)
  if (opts.params) {
    for (const [k, v] of Object.entries(opts.params)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v))
    }
  }
  // 超时（2026-10-17 新增，解析链见 timeoutFor）：AbortController 掐断 fetch，
  // 按传输错误收口——全局错误 Dialog 呈现（silent 抑制），调用方拿 ApiError(408, transport)
  const timeout = timeoutFor(base)
  const ctrl = new AbortController()
  const timer = timeout > 0 ? window.setTimeout(() => ctrl.abort(), timeout) : 0
  let res: Response
  try {
    res = await fetch(url.toString(), { ...init, signal: ctrl.signal })
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') {
      const err = new ApiError(408, tShared('common.requestTimeout'))
      err.transport = true
      if (!opts.silent) void useModalDialog().error(err.errMsg ?? tShared('common.requestTimeout'))
      throw err
    }
    throw e
  } finally {
    if (timer) window.clearTimeout(timer)
  }

  // 非 200 统一收口（用户定稿 2026-10-17）：优先取响应体 JSON 错误壳的 errMsg/message，
  // 非 JSON 体回退状态码；调用方按 ApiError.errMsg 呈现，无则回退通用文案
  if (!res.ok) {
    let errMsg: string | undefined
    try {
      const body = (await res.json()) as { errMsg?: string | null; message?: string | null }
      errMsg = body?.errMsg ?? body?.message ?? undefined
    } catch {
      /* 非 JSON 响应体：errMsg 留空走状态码兜底 */
    }
    const err = new ApiError(res.status, errMsg)
    err.transport = true
    // 非 200 全局呈现（用户定稿 2026-10-17）：错误 Dialog 直出 errMsg，无则状态码兜底；
    // silent 调用方（登出等）抑制；业务壳失败不在此列（调用方自呈现）
    if (!opts.silent) void useModalDialog().error(errMsg ?? tShared('common.httpError', { code: res.status }))
    throw err
  }
  return (await res.json()) as T
}

/* ===== 部署期运行时配置（用户定稿 2026-10-17） =====
   public/app-config.json 由部署直接修改（无需重新构建），启动时 loadRuntimeConfig() 拉取。
   Host 优先级：services[name].host > globalHost > 构建 env FV_APP_HOST > 代码 config.ts 默认 > 内置兜底。
   超时同链（单位 ms）：services[name].timeout > globalTimeout > 构建 env FV_APP_TIMEOUT >
   服务 config.ts 默认 > 内置 30s；0/缺省 = 跳下一档，-1 = 本档显式不限时。 */
export interface RuntimeAppConfig {
  globalHost?: string
  globalTimeout?: number
  services?: Record<string, { host?: string; timeout?: number }>
}
let runtimeConfig: RuntimeAppConfig | null = null

export async function loadRuntimeConfig(path = `${import.meta.env.BASE_URL}app-config.json`): Promise<void> {
  try {
    const res = await fetch(path)
    runtimeConfig = res.ok ? ((await res.json()) as RuntimeAppConfig) : null
  } catch {
    runtimeConfig = null // 文件缺失/不可读 = 全走 env 与代码默认
  }
}

/** 构建 env 全局请求超时（FV_APP_TIMEOUT，ms；0/缺省 = 跳下一档） */
const GLOBAL_API_TIMEOUT: number = Number(import.meta.env.FV_APP_TIMEOUT) || 0
/** 内置兜底请求超时（ms） */
const DEFAULT_REQUEST_TIMEOUT = 30_000

/** Host 优先级（服务级 > 全局级；运行时 > 构建 env > 服务代码默认 > 内置兜底——2026-10-17 定稿口径） */
function hostOf(cfg: ServiceConfig): string {
  return (
    runtimeConfig?.services?.[cfg.service]?.host ||
    runtimeConfig?.globalHost ||
    GLOBAL_API_HOST ||
    cfg.host ||
    DEFAULT_API_HOST
  )
}

/** 超时解析（与 Host 同链；返回 ≤0 = 不限时） */
function timeoutFor(base?: RequestBase): number {
  const rt = base?.service ? runtimeConfig?.services?.[base.service]?.timeout : undefined
  return rt || runtimeConfig?.globalTimeout || GLOBAL_API_TIMEOUT || base?.timeout || DEFAULT_REQUEST_TIMEOUT
}

/** 服务配置 → 请求基址（Host/超时按部署期优先级解析） */
export function baseOf(cfg: ServiceConfig): RequestBase {
  return { host: hostOf(cfg), service: cfg.service, timeout: cfg.timeout }
}

/** 微服务级 request 工厂：绑定该服务的 config（service/host），出参壳/交易头仍由服务层自决 */
export function createServiceRequest(cfg: ServiceConfig) {
  return <T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, opts: RequestOptions = {}): Promise<T> =>
    request<T>(method, path, opts, baseOf(cfg))
}
