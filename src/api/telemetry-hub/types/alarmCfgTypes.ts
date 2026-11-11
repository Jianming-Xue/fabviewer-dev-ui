/** 告警通知配置域对象（模块2 · 01 §2.2 FabViewerAlarmCfg；log_monitor 与 srv_hang_monitor 两域共用的嵌套对象，
 *  2026-11-10 新建）：随主配置同事务写入，无独立接口；前端消费方为模块件 AlarmCfgEditor。 */

/** 通知配置提交体（嵌套于 LogMonitorCfgRo / ServerHangMonitorCfgRo）：
 *  四个列表字段均可空（空=该渠道不通知），notifyInterval 必填整数 1~99999（分钟，聚合通知间隔） */
export interface AlarmCfgRo {
  /** 邮件收件人（逐条 email 格式校验） */
  mailToUsers: string[]
  /** 邮件抄送（不替代收件人；逐条 email 格式校验） */
  mailCCUsers: string[]
  /** 飞书群机器人 webhook（逐条 https://open.feishu.cn/open-apis/bot/v2/hook/… 前缀校验） */
  feishuWebhooks: string[]
  /** 飞书 @ 人（open_id，ou_ 前缀；@ 的人须在对应群里否则不生效） */
  feishuAtUsers: string[]
  notifyInterval: number
}

/** 通知配置出参（文档01 §4.2：与 Ro 同形，列表空=[] 不回 null） */
export type AlarmCfgDto = AlarmCfgRo
