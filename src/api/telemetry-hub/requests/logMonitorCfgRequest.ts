import { fromWire } from '@/shared/utils/datetimeCodec'

import { telemetryRequest } from './request'

import type { PageDto } from '../types/types'
import type { LogMonitorCfgDto, LogMonitorCfgRo } from '../types/logMonitorCfgTypes'

/**
 * MES 日志监控配置接口（telemetry-hub 服务，前缀 /api/v1/log_monitor/cfg，文档：模块2 · 01 §四 六接口之五，
 * 第六个 priority/list 归 sys_misc 域见 systemMiscRequest）：统一走 telemetryRequest（交易头 +
 * 回复壳拆解，业务失败抛 ApiError(200, errMsg)，srvHangConfigRequest 同口径）；写操作 loading:true 锁页。
 * 行键 item+environment（Dto 不含 id）；DELETE 走 URL query（srv_hang_cfg 2026-11-04 真实后端实测口径）。
 * 审计出参 lastUpdatedAt 按 telemetry-hub wire 假定 YYYYMMDDHHmmss——入站解码收口本层
 * （fromWire 对不可识别串原样透传，文档写可读格式亦安全；后端未部署，联调以实测为准）。
 */

/** 入站行解码：lastUpdatedAt wire → UI 可读格式 */
function decodeRow(r: LogMonitorCfgDto): LogMonitorCfgDto {
  return { ...r, lastUpdatedAt: fromWire(r.lastUpdatedAt) }
}

/** 1 · 分页查询（GET；keyword 可选——大小写不敏感子串匹配 item/description/environment/keyword 四列，
 *  任一命中即返回；出参 env→item 升序归后端） */
export function fetchLogMonitorCfgPage(
  pageIndex: number,
  pageSize = 20,
  keyword?: string,
): Promise<PageDto<LogMonitorCfgDto>> {
  return telemetryRequest<PageDto<LogMonitorCfgDto>>('fetchLogMonitorCfgPage', 'GET', '/api/v1/log_monitor/cfg/page', {
    params: keyword ? { pageIndex, pageSize, keyword } : { pageIndex, pageSize },
  }).then((page) => ({ ...page, data: page.data.map(decodeRow) }))
}

/** 2 · 单条详情（编辑弹窗回填用；含嵌套 alarmCfg；未找到抛 LogMonitorCfgNotFound 口径 errMsg） */
export function fetchLogMonitorCfgDetail(item: string, environment: string): Promise<LogMonitorCfgDto> {
  return telemetryRequest<LogMonitorCfgDto>('fetchLogMonitorCfgDetail', 'GET', '/api/v1/log_monitor/cfg/detail', {
    params: { item, environment },
  }).then(decodeRow)
}

/** 3 · 新增（AlarmCfg 与规则行同事务插入；出参=落库后重查的整条 Dto） */
export function createLogMonitorCfg(input: LogMonitorCfgRo): Promise<LogMonitorCfgDto> {
  return telemetryRequest<LogMonitorCfgDto>('createLogMonitorCfg', 'POST', '/api/v1/log_monitor/cfg', {
    body: input,
    loading: true,
  }).then(decodeRow)
}

/** 4 · 编辑（定位键 item/environment 在 body 内、不可改；通知配置同事务就地更新） */
export function updateLogMonitorCfg(input: LogMonitorCfgRo): Promise<LogMonitorCfgDto> {
  return telemetryRequest<LogMonitorCfgDto>('updateLogMonitorCfg', 'PUT', '/api/v1/log_monitor/cfg', {
    body: input,
    loading: true,
  }).then(decodeRow)
}

/** 5 · 删除（行键写 URL query；连带删除关联 AlarmCfg 行，历史告警保留；弹框确认后调用） */
export function deleteLogMonitorCfg(item: string, environment: string): Promise<null> {
  return telemetryRequest<null>('deleteLogMonitorCfg', 'DELETE', '/api/v1/log_monitor/cfg', {
    params: { item, environment },
    loading: true,
  })
}
