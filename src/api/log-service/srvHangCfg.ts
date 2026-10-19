import { createServiceRequest } from '@/shared/api/http'

import config from './config'

import type { PageDto, SrvHangCfgDto, SrvHangCfgRo } from './types'

/** 微服务绑定 request：URL = 服务 Host + /log-service + 后端给定接口路径 */
const request = createServiceRequest(config)

/** 1 · 分页取配置（GET，URL 参数仅 pageIndex / pageSize；默认 ruleName+hangReason 升序） */
export function fetchSrvHangCfgPage(pageIndex: number, pageSize = 20): Promise<PageDto<SrvHangCfgDto>> {
  return request<PageDto<SrvHangCfgDto>>('GET', '/api/v1/srv_hang_cfg/page', {
    params: { pageIndex, pageSize },
  })
}

/** 2 · 切换一条配置的 enabled（成功后局部更新该行，不重拉列表） */
export function toggleSrvHangCfgState(id: string, enabled: boolean): Promise<void> {
  return request('POST', '/api/v1/srv_hang_cfg/state', { body: { id, enabled } })
}

/** 3 · 新增（id 为空；成功后表格第一行插入出参内容） */
export function createSrvHangCfg(input: SrvHangCfgRo): Promise<SrvHangCfgDto> {
  return request<SrvHangCfgDto>('POST', '/api/v1/srv_hang_cfg', { body: input })
}

/** 4 · 编辑（id = 选中行；成功后用出参更新选中行每个单元格） */
export function updateSrvHangCfg(input: SrvHangCfgRo): Promise<SrvHangCfgDto> {
  return request<SrvHangCfgDto>('PUT', '/api/v1/srv_hang_cfg', { body: input })
}

/** 5 · 删除（仅 id；弹框确认后调用） */
export function deleteSrvHangCfg(id: string): Promise<void> {
  return request('DELETE', '/api/v1/srv_hang_cfg', { body: { id } })
}
