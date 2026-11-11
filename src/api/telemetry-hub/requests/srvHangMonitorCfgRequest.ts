import { fromWire } from '@/shared/utils/datetimeCodec'

import { telemetryRequest } from './request'

import type { ServerHangMonitorCfgDto, ServerHangMonitorCfgRo } from '../types/srvHangMonitorCfgTypes'

/**
 * MES 服务挂起监控配置接口（telemetry-hub 服务，前缀 /api/v1/srv_hang_monitor/cfg，文档：模块2 · 03 §四 四接口，
 *  2026-11-10 配置侧定稿）：list 全量无分页无过滤（编辑回填直接用行数据，无 detail 接口）；
 *  environment 唯一键（一行一环境），POST/PUT body 形态、DELETE 走 URL query（srv_hang_cfg 实测口径）。
 *  统一 telemetryRequest（交易头 + 回复壳拆解）、写操作 loading:true 锁页。
 *  审计出参 lastUpdatedAt 入站解码收口本层（wire 假定 YYYYMMDDHHmmss，fromWire 不可识别串原样透传；
 *  后端未部署，联调以实测为准）。
 */

/** 入站行解码：lastUpdatedAt wire → UI 可读格式 */
function decodeRow(r: ServerHangMonitorCfgDto): ServerHangMonitorCfgDto {
  return { ...r, lastUpdatedAt: fromWire(r.lastUpdatedAt) }
}

/** 1 · 全量清单（GET 无参；含嵌套 alarmCfg；出参 env 升序归后端） */
export function fetchSrvHangMonitorCfgList(): Promise<ServerHangMonitorCfgDto[]> {
  return telemetryRequest<ServerHangMonitorCfgDto[]>('fetchSrvHangMonitorCfgList', 'GET', '/api/v1/srv_hang_monitor/cfg/list')
    .then((rows) => rows.map(decodeRow))
}

/** 2 · 新增（environment 已存在即拒 SrvHangMonitorCfgExists 口径；通知配置同事务插入） */
export function createSrvHangMonitorCfg(input: ServerHangMonitorCfgRo): Promise<ServerHangMonitorCfgDto> {
  return telemetryRequest<ServerHangMonitorCfgDto>('createSrvHangMonitorCfg', 'POST', '/api/v1/srv_hang_monitor/cfg', {
    body: input,
    loading: true,
  }).then(decodeRow)
}

/** 3 · 编辑（environment 为定位键、锁定不可改；不存在抛 SrvHangMonitorCfgNotFound 口径） */
export function updateSrvHangMonitorCfg(input: ServerHangMonitorCfgRo): Promise<ServerHangMonitorCfgDto> {
  return telemetryRequest<ServerHangMonitorCfgDto>('updateSrvHangMonitorCfg', 'PUT', '/api/v1/srv_hang_monitor/cfg', {
    body: input,
    loading: true,
  }).then(decodeRow)
}

/** 4 · 删除（environment 写 URL query；连带通知配置，历史告警保留；弹框确认后调用） */
export function deleteSrvHangMonitorCfg(environment: string): Promise<null> {
  return telemetryRequest<null>('deleteSrvHangMonitorCfg', 'DELETE', '/api/v1/srv_hang_monitor/cfg', {
    params: { environment },
    loading: true,
  })
}
