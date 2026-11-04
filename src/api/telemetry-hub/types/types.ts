/** telemetry-hub 服务公用对象（2026-11-04 定稿：请求壳/分页口径与 security-management 一致）：
 *  本文件只放 PageRo / PageDto / TelemetryReplyDto 这类公用参数；业务对象按域分文件（§5.3-9 等）。 */

/** 分页接口公用入参——本服务分页一律遵循此对象 */
export interface PageRo {
  pageIndex: number
  pageSize: number
}

/** 服务统一回复壳（与 security-management SecurityReplyDto 同构，2026-11-04 对齐）：code 字符串——成功恒 'OK'，
 *  失败默认 'FAIL'（可指定具体业务码）；success 布尔 true=成功/false=失败（失败 errMsg 携错误信息）；
 *  data 为业务出参；txId 将请求头入参原封回显；
 *  正常情况（含业务失败）HTTP 码恒 200，非正常状态才为其他值（shared/http 统一收口） */
export interface TelemetryReplyDto<T> {
  code: string
  success: boolean
  errMsg: string
  data: T
  txId: string
}

/** 分页接口 data 壳（security-management 同构：totalSize 总条数 + totalPage 总页数后端直发 + data 行数组） */
export interface PageDto<T> {
  pageSize: number
  pageIndex: number
  totalSize: number
  totalPage: number
  data: T[]
}

/** 动态耗时列数据源（§5.3-9 costBreakDown[]） */
export interface CostBreakDownDto {
  item: string
  group: string
  summary: number
}

/** 结果列表行（rule_info/page 出参 contents[] 条目） */
export interface RuleInfoDto {
  /** 块 id（值 = 块文档 _id，不出列；Rule Log / Full Log / detail 入参） */
  id: string
  env: string
  ipaddress: string
  serverId: string
  ruleName: string
  requestType: string
  startTime: string
  endTime: string
  ruleResult: string
  errorCode: string[]
  eqpId: string[]
  lotId: string[]
  carrierId: string[]
  userId: string[]
  tid: string[]
  totalCostTime: number
  costSummary: number
  unaccountedCost: number
  execStatus: string
  hangCount: number
  costBreakDown: CostBreakDownDto[]
}

/** 检索入参（§5.3-9 parameters） */
export interface RuleSearchRo {
  env?: string
  serverCategory?: string
  serverId?: string[]
  startTime: string
  endTime: string
  ruleName?: string
  tid?: string
  eqpId?: string
  carrierId?: string
  lotId?: string
  ipaddress?: string
  userId?: string
  errorCode?: string
  ruleResult?: string
  minCost: string
  maxCost: string
  descTime: boolean
}

/** rule_info/detail 出参（游标式按需加载，§5.3-7） */
export interface RuleDetailDto {
  raw: string
  finished: boolean
  fingerprint: string
  offset: number
}

/** rule_info/hang_list 出参条目（§5.3-10；本期按钮置灰，结构先建好） */
export interface HangEntryDto {
  startTime: string
  endTime: string
  hangCostMs: number
  startLineLog: string
  endLineLog: string
  hangReason: string
  startLineId: string
  endLineId: string
}


