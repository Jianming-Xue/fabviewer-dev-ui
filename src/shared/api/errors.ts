/** 业务/传输错误（HTTP 非 2xx / mock 拒绝 / 服务层出参壳 success≠0）。
 *  旧全局统一响应包 Envelope 已于 2026-10-17 删除——出参壳属服务私有事（见各服务 types） */
export class ApiError extends Error {
  /** 接口返回的业务错误信息（envelope.errMsg）；后端未给出时为 undefined（message 为自动兜底文案） */
  errMsg?: string

  /** 传输层错误（HTTP 非 200，shared/http 统一收口并全局呈现错误 Dialog）；
      业务出参壳失败（success≠0）为 undefined/false——呈现归调用方（有上下文/重试语义） */
  transport?: boolean

  constructor(
    public errCode: number,
    message?: string,
  ) {
    super(message ?? `API error ${errCode}`)
    this.name = 'ApiError'
    this.errMsg = message
  }
}

/** errCode → i18n 词典键（无映射时为 null，调用方回退通用文案） */
export function errCodeToI18nKey(errCode: number): string | null {
  switch (errCode) {
    case 409:
      return 'validation.duplicateConfig'
    default:
      return null
  }
}
