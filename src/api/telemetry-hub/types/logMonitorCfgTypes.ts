/** MES 日志监控配置域对象（模块2 · 01，2026-11-10 实现；表 FabViewerLogMonitorCfg，行键 item+environment 唯一）：
 *  服务公共壳（PageDto/TelemetryReplyDto）留 ./types；嵌套通知配置见 ./alarmCfgTypes。
 *  审计出参按项目惯例 lastUpdatedAt/lastUpdatedBy（文档原名 lastUpdatedTime/lastUpdatedUser，
 *  2026-11-10 用户定稿随 srv_hang_cfg 2026-11-04 更名口径统一）。 */

import type { AlarmCfgDto, AlarmCfgRo } from './alarmCfgTypes'

/** 关键字监控规则条目（page 出参 data[] 条目 / detail / 增改出参整条回显；id、alarmCfgId 与四个审计原列不出参） */
export interface LogMonitorCfgDto {
  /** 规则标识名（≤30，^[A-Za-z0-9_-]{1,30}$；与 environment 组成唯一键，编辑不可改） */
  item: string
  environment: string
  /** 命中的单个关键字（≤30，字符集不限） */
  keyword: string
  description: string | null
  /** 词级黑名单：任一元素不得为 keyword 子串（大小写敏感），空=[] */
  excludeKeywords: string[]
  /** Rule 级白名单：设置后仅这些 Rule 触发告警；与 excludeRuleNames 不得相交，空=[]（不限制） */
  followRuleNames: string[]
  /** Rule 级黑名单，空=[] */
  excludeRuleNames: string[]
  /** 告警优先级（源 Misc system.global.priority，P1~P4） */
  priority: string
  /** 嵌套通知配置（无通知行时 null） */
  alarmCfg: AlarmCfgDto | null
  lastUpdatedAt: string
  lastUpdatedBy: string
}

/** 新增/编辑提交体（编辑时 item/environment 为定位键、后端不可改） */
export interface LogMonitorCfgRo {
  environment: string
  item: string
  keyword: string
  /** ≤255，可空 */
  description?: string
  excludeKeywords?: string[]
  followRuleNames?: string[]
  excludeRuleNames?: string[]
  priority: string
  alarmCfg: AlarmCfgRo
}
