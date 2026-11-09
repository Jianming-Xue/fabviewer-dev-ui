import { fromWire } from '@/shared/utils/datetimeCodec'

import { telemetryRequest } from './request'

import type { PageDto } from '../types/types'
import type { ServerHangConfigDto, ServerHangConfigRo } from '../types/srvHangConfigTypes'

/**
 * Server Hang Reason Config 接口（telemetry-hub 服务，前缀 /api/v1/srv_hang_cfg，文档：模块5 · 01 §4.4 五接口）：
 * 2026-11-04 对齐 security-management 口径——统一走 telemetryRequest（交易头 txId/txName/userName/txTime +
 * 回复壳 { code, success, errMsg, data, txId } 拆解，业务失败抛 ApiError(200, errMsg)）；
 * 分页出参 PageDto 与 security-management 同构（totalSize/totalPage 后端直发 + data 行数组）；
 * 变更类操作（启停/新增/编辑/删除）走全局 Loading 锁页（security-management 同口径）。
 * 同日按域拆文件（srvHangConfigRequest/srvHangConfigTypes/srvHangConfigMock 三族），Dto/Ro 统一 ServerHangConfig 前缀。
 * 真实后端联调（2026-11-04 晚）：lastUpdatedAt 响应为 wire 格式 YYYYMMDDHHmmss——入站解码收口本层
 * （shared/utils/datetimeCodec.fromWire，security-management 同口径），UI 与类型保持 'YYYY-MM-DD HH:mm:ss'；
 * 出站 Ro 无日期字段、无需编码。
 */

/** 入站行解码：lastUpdatedAt wire → UI 可读格式 */
function decodeRow(r: ServerHangConfigDto): ServerHangConfigDto {
  return { ...r, lastUpdatedAt: fromWire(r.lastUpdatedAt) }
}

/** 1 · 分页取配置（GET，URL 参数仅 pageIndex / pageSize；默认 ruleName+hangReason 升序） */
export function fetchSrvHangConfigPage(pageIndex: number, pageSize = 20): Promise<PageDto<ServerHangConfigDto>> {
  return telemetryRequest<PageDto<ServerHangConfigDto>>('fetchSrvHangConfigPage', 'GET', '/api/v1/srv_hang_cfg/page', {
    params: { pageIndex, pageSize },
  }).then((page) => ({ ...page, data: page.data.map(decodeRow) }))
}

/** 2 · 切换一条配置的 enabled（URL query 传参——2026-11-04 晚真实后端实测：body 形态报
 *  RequireParameterMissing，query 形态 OK，security-management setRoleEnabled 同款；成功后局部更新该行，不重拉列表） */
export function toggleSrvHangConfigState(id: string, enabled: boolean): Promise<null> {
  return telemetryRequest<null>('toggleSrvHangConfigState', 'POST', '/api/v1/srv_hang_cfg/state', {
    params: { id, enabled },
    loading: true,
  })
}

/** 3 · 新增（id 为空；成功后表格第一行插入出参内容） */
export function createSrvHangConfig(input: ServerHangConfigRo): Promise<ServerHangConfigDto> {
  return telemetryRequest<ServerHangConfigDto>('createSrvHangConfig', 'POST', '/api/v1/srv_hang_cfg', { body: input, loading: true })
    .then(decodeRow)
}

/** 4 · 编辑（id = 选中行；成功后用出参更新选中行每个单元格） */
export function updateSrvHangConfig(input: ServerHangConfigRo): Promise<ServerHangConfigDto> {
  return telemetryRequest<ServerHangConfigDto>('updateSrvHangConfig', 'PUT', '/api/v1/srv_hang_cfg', { body: input, loading: true })
    .then(decodeRow)
}

/** 5 · 删除（id 写 URL query——真实后端实测同 state 口径，body 形态报 RequireParameterMissing；弹框确认后调用） */
export function deleteSrvHangConfig(id: string): Promise<null> {
  return telemetryRequest<null>('deleteSrvHangConfig', 'DELETE', '/api/v1/srv_hang_cfg', { params: { id }, loading: true })
}

/** 6 · Hang Reason 候选字典（GET，srv_hang_cfg 加后缀 /hang_reason/list，2026-11-05 用户定稿接口口径；
 *  **后端已部署（2026-11-05 傍晚实测 200）**——实测 data 为裸字符串数组（如 ["Lock-Lot"]），
 *  非早前预留的 {hangReason:[...]} 对象形态，签名随实测对齐；编辑弹窗 FvTextSelect(allowCreate)
 *  消费；silent 抑制全局错误 Dialog，调用方失败自行降级纯手输 */
export function fetchHangReasonList(): Promise<string[]> {
  return telemetryRequest<string[]>('fetchHangReasonList', 'GET', '/api/v1/srv_hang_cfg/hang_reason/list', {
    silent: true,
  })
}
