/** security-management 服务公用对象（2026-10-22 后端改版口径）：本文件只放 PageRo / PageDto /
 *  SecurityReplyDto 这类公用参数；业务对象归各业务文件（角色业务对象见 ./roleTypes），
 *  UI 层复用同一套类型、不另建视图模型。 */

/** 分页接口公用入参——本服务分页一律遵循此对象 */
export interface PageRo {
  pageIndex: number
  pageSize: number
}

/** 服务统一回复壳（security-management 口径，2026-10-22 后端定）：code 字符串——成功恒 'OK'，
 *  失败默认 'FAIL'（可指定具体业务码）；success 数字 1=成功/0=失败（失败 errMsg 携错误信息）；
 *  data 为业务出参；txId 将请求头入参原封回显；
 *  正常情况（含业务失败）HTTP 码恒 200，非正常状态才为其他值（shared/http 统一收口） */
export interface SecurityReplyDto<T> {
  code: string
  success: number
  errMsg: string
  data: T
  txId: string
}

/** 分页接口 data 壳（2026-10-22 增 totalPage 总页数——后端算好直发，前端不再自行推算） */
export interface PageDto<T> {
  pageSize: number
  pageIndex: number
  totalSize: number
  totalPage: number
  data: T[]
}
