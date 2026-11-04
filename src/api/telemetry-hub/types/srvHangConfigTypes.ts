/** Server Hang Reason Config 域对象（模块 5 · 01；2026-11-04 按域拆文件，Dto/Ro 统一 ServerHangConfig 前缀，
 *  与 security-management 的 roleTypes/userTypes 分域惯例一致）：服务公共壳（PageRo/PageDto/TelemetryReplyDto）留 ./types。 */

/** Server Hang Reason 配置条目（模块 5 · 01 §二；page 出参 data[] 条目、增改出参整条回显） */
export interface ServerHangConfigDto {
  id: string
  ruleName: string
  hangReason: string
  startLineLike: string
  endLineLike: string
  enabled: boolean
  lastUpdatedAt: string
  lastUpdatedBy: string
}

/** Confirm 提交体：新增 id=null，编辑 id=选中行 id（§4.3；enabled 不入参，新增默认值由后端定） */
export interface ServerHangConfigRo {
  id: string | null
  ruleName: string
  hangReason: string
  startLineLike: string
  endLineLike: string
}
