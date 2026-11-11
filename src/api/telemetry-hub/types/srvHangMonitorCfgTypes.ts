/** MES 服务挂起监控配置域对象（模块2 · 03，文档 2026-11-10 配置侧定稿；表 FabViewerSrvHangMonitorCfg，
 *  environment 唯一键、一行一环境；无 Enabled 字段——「配置即启用」）：
 *  MaxDelay=日志断流超过该秒数报 Server Hang；MaxRuleCost=单 Rule 写日志超过该秒数报 Endless Rule。
 *  审计出参按项目惯例 lastUpdatedAt/lastUpdatedBy（文档原名 lastUpdatedTime/lastUpdatedUser，用户定稿统一）。 */

import type { AlarmCfgDto, AlarmCfgRo } from './alarmCfgTypes'

/** 环境级阈值配置条目（list 出参 data[] 条目；无 detail 接口，编辑回填直接用行数据） */
export interface ServerHangMonitorCfgDto {
  /** 环境名（唯一键，编辑不可改；候选源 Misc mes.global.environments） */
  environment: string
  /** Server Hang 告警阈值（秒，整数 1~65535） */
  maxDelay: number
  /** Endless Rule 告警阈值（秒，整数 1~65535） */
  maxRuleCost: number
  /** 告警优先级（源 Misc system.global.priority，P1~P4） */
  priority: string
  /** 嵌套通知配置（1:1 随主配置同事务写入） */
  alarmCfg: AlarmCfgDto | null
  lastUpdatedAt: string
  lastUpdatedBy: string
}

/** 新增/编辑提交体（编辑时 environment 为定位键、锁定不可改） */
export interface ServerHangMonitorCfgRo {
  environment: string
  maxDelay: number
  maxRuleCost: number
  priority: string
  alarmCfg: AlarmCfgRo
}
