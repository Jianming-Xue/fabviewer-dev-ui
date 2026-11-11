import { fromWire } from '@/shared/utils/datetimeCodec'

import { telemetryRequest } from './request'

import type { ChangeSystemMiscValueRo, SystemMiscDto } from '../types/systemMiscTypes'

/**
 * System Misc 接口（telemetry-hub 服务，前缀 /api/v1/sys_misc，文档：模块5 · 02，2026-11-09 修订定稿）：
 * 统一走 telemetryRequest（交易头 + 回复壳 { code, success, errMsg, data, txId } 拆解，业务失败抛
 * ApiError(200, errMsg)，srvHangConfigRequest 同口径）；写操作（PUT）走全局 Loading 锁页。
 * 页面三接口：GET /list（category 可选等值过滤，空=全表；出参 item 升序、无分页）、
 * PUT /（体 ChangeSystemMiscValueRo，item 定位；出参更新后整条 Dto）、GET /category/list（去重排序字符串数组）。
 * §六 六个候选值接口（env/ipaddress/server_category/rule_result/lock_object/call_sys 的 /list）一并落本层：
 * 均回 string[]（后端做 value→defaultValue 降级+去重排序），供 Rule 管理等下拉消费——**当前仓库暂无 UI 消费方**，
 * silent:true 抑制全局错误 Dialog（hang_reason/list 同口径），调用方失败自行降级。
 * 审计字段入站 wire 解码收口本层（文档 §5.3 写 "2026-10-13 16:20:11" 可读格式，但 telemetry-hub 实测 wire 为
 * YYYYMMDDHHmmss——fromWire 对不可识别串原样透传，两形态皆安全；真实后端联调时核对）；出站 Ro 无日期字段。
 */

/** 入站行解码：createdAt/updatedAt wire → UI 可读格式 */
function decodeRow(r: SystemMiscDto): SystemMiscDto {
  return { ...r, createdAt: fromWire(r.createdAt), updatedAt: fromWire(r.updatedAt) }
}

/** 1 · 类目候选（§3.1 加载时序第一步：distinct(category) 去重排序；空数组 → 左侧只剩本地固定 "All"） */
export function fetchSystemMiscCategories(): Promise<string[]> {
  return telemetryRequest<string[]>('fetchSystemMiscCategories', 'GET', '/api/v1/sys_misc/category/list')
}

/** 2 · 按类目取配置清单（§5.1：category 可选等值过滤，不传 = 全表；出参 item 升序、无分页） */
export function fetchSystemMiscList(category?: string): Promise<SystemMiscDto[]> {
  return telemetryRequest<SystemMiscDto[]>('fetchSystemMiscList', 'GET', '/api/v1/sys_misc/list', {
    params: category ? { category } : undefined,
  }).then((rows) => rows.map(decodeRow))
}

/** 3 · 修改 value/defaultValue（§5.2 唯一写操作：item 定位，Boolean 型后端忽略 defaultValue；
 *  成功后出参整条 Dto 回显，调用方就地换行不重拉） */
export function updateSystemMiscValue(input: ChangeSystemMiscValueRo): Promise<SystemMiscDto> {
  return telemetryRequest<SystemMiscDto>('updateSystemMiscValue', 'PUT', '/api/v1/sys_misc', {
    body: input,
    loading: true,
  }).then(decodeRow)
}

/* ===== §六 候选值接口（六端点均源 Misc Json 型条目；取数=value→defaultValue 降级→[]，去重+字典序，归后端） ===== */

/** 环境候选（源 mes.global.environments，List 形态） */
export function fetchMiscEnvList(): Promise<string[]> {
  return telemetryRequest<string[]>('fetchMiscEnvList', 'GET', '/api/v1/sys_misc/env/list', { silent: true })
}

/** Host IP 候选（源 mes.global.ipaddresses，Map 形态；environment 传入只取该 key 的值、不传合并全部，§6.3） */
export function fetchMiscIpAddressList(environment?: string): Promise<string[]> {
  return telemetryRequest<string[]>('fetchMiscIpAddressList', 'GET', '/api/v1/sys_misc/ipaddress/list', {
    params: environment ? { environment } : undefined,
    silent: true,
  })
}

/** Server Category 候选（源 mes.global.servercategories，List 形态） */
export function fetchMiscServerCategoryList(): Promise<string[]> {
  return telemetryRequest<string[]>('fetchMiscServerCategoryList', 'GET', '/api/v1/sys_misc/server_category/list', {
    silent: true,
  })
}

/** Rule Result 候选（源 mes.rule.results，List 形态） */
export function fetchMiscRuleResultList(): Promise<string[]> {
  return telemetryRequest<string[]>('fetchMiscRuleResultList', 'GET', '/api/v1/sys_misc/rule_result/list', {
    silent: true,
  })
}

/** Lock Object 候选（源 mes.rule.lockedobjects，List 形态） */
export function fetchMiscLockObjectList(): Promise<string[]> {
  return telemetryRequest<string[]>('fetchMiscLockObjectList', 'GET', '/api/v1/sys_misc/lock_object/list', {
    silent: true,
  })
}

/** Call Sys 候选（源 mes.rule.calledsystems，List 形态） */
export function fetchMiscCallSysList(): Promise<string[]> {
  return telemetryRequest<string[]>('fetchMiscCallSysList', 'GET', '/api/v1/sys_misc/call_sys/list', {
    silent: true,
  })
}

/** Alarm Priority 候选（源 system.global.priority，模块2 · 01 §4.1-6：去重字典序如 ["P1","P2","P3","P4"]，
 *  value/defaultValue 均空回 [] 不报错；log_monitor / srv_hang_monitor 两配置页 Priority 下拉消费。
 *  silent 抑制全局错误 Dialog——**后端未部署（2026-11-10 文档定稿同日前端先行）**，失败调用方降级空候选） */
export function fetchPriorityList(): Promise<string[]> {
  return telemetryRequest<string[]>('fetchPriorityList', 'GET', '/api/v1/sys_misc/priority/list', {
    silent: true,
  })
}
