/** 分页出参通用壳（§5.3-9） */
export interface PageDto<T> {
  totalPage: number
  total: number
  pageIndex: number
  pageSize: number
  contents: T[]
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

/** Server Hang Reason 配置条目（模块 5 · 01 §二） */
export interface SrvHangCfgDto {
  id: string
  ruleName: string
  hangReason: string
  startLineLike: string
  endLineLike: string
  enabled: boolean
  updatedAt: string
  updatedBy: string
}

/** Confirm 提交体：新增 id=null，编辑 id=选中行 id（§4.3） */
export interface SrvHangCfgRo {
  id: string | null
  ruleName: string
  hangReason: string
  startLineLike: string
  endLineLike: string
}
