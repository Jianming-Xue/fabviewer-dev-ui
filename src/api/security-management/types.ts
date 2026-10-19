/** security-management 服务公用对象（2026-10-17 口径）：本文件只放 PageRo / PageDto /
 *  SecurityReplyDto 这类公用参数；业务对象归各业务文件（角色业务对象见 ./roleTypes），
 *  UI 层复用同一套类型、不另建视图模型。 */

/** 分页接口公用入参——本服务分页一律遵循此对象 */
export interface PageRo {
  pageIndex: number
  pageSize: number
}

/** 服务统一回复壳（security-management 口径，2026-10-16）：code 非服务问题恒 200；
 *  success 数字 0=成功/非 0=失败（失败 errMsg 非空）；contents 为业务内容 */
export interface SecurityReplyDto<T> {
  code: number
  success: number
  errMsg?: string | null
  contents: T
}

/** 分页接口 contents 壳 */
export interface PageDto<T> {
  pageSize: number
  pageIndex: number
  totalSize: number
  data: T[]
}
