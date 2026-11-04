import { telemetryRequest } from './request'

import type { PageDto, SrvHangCfgDto, SrvHangCfgRo } from '../types/types'

/**
 * Server Hang Reason Config 接口（telemetry-hub 服务，前缀 /api/v1/srv_hang_cfg）：
 * 2026-11-04 对齐 security-management 口径——统一走 telemetryRequest（交易头 txId/txName/userName/txTime +
 * 回复壳 { code, success, errMsg, data, txId } 拆解，业务失败抛 ApiError(200, errMsg)）；
 * 分页出参 PageDto 与 security-management 同构（totalSize/totalPage 后端直发 + data 行数组）；
 * 变更类操作（启停/新增/编辑/删除）走全局 Loading 锁页（security-management 同口径）。
 */

/** 1 · 分页取配置（GET，URL 参数仅 pageIndex / pageSize；默认 ruleName+hangReason 升序） */
export function fetchSrvHangCfgPage(pageIndex: number, pageSize = 20): Promise<PageDto<SrvHangCfgDto>> {
  return telemetryRequest<PageDto<SrvHangCfgDto>>('fetchSrvHangCfgPage', 'GET', '/api/v1/srv_hang_cfg/page', {
    params: { pageIndex, pageSize },
  })
}

/** 2 · 切换一条配置的 enabled（成功后局部更新该行，不重拉列表） */
export function toggleSrvHangCfgState(id: string, enabled: boolean): Promise<null> {
  return telemetryRequest<null>('toggleSrvHangCfgState', 'POST', '/api/v1/srv_hang_cfg/state', {
    body: { id, enabled },
    loading: true,
  })
}

/** 3 · 新增（id 为空；成功后表格第一行插入出参内容） */
export function createSrvHangCfg(input: SrvHangCfgRo): Promise<SrvHangCfgDto> {
  return telemetryRequest<SrvHangCfgDto>('createSrvHangCfg', 'POST', '/api/v1/srv_hang_cfg', { body: input, loading: true })
}

/** 4 · 编辑（id = 选中行；成功后用出参更新选中行每个单元格） */
export function updateSrvHangCfg(input: SrvHangCfgRo): Promise<SrvHangCfgDto> {
  return telemetryRequest<SrvHangCfgDto>('updateSrvHangCfg', 'PUT', '/api/v1/srv_hang_cfg', { body: input, loading: true })
}

/** 5 · 删除（仅 id；弹框确认后调用） */
export function deleteSrvHangCfg(id: string): Promise<null> {
  return telemetryRequest<null>('deleteSrvHangCfg', 'DELETE', '/api/v1/srv_hang_cfg', { body: { id }, loading: true })
}
