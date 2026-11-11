/** Monitor-Alarm 模块词典（2026-11-11 模块搬迁自 config 模块整段移入：logMonitor/srvHangMonitor/alarm
 *  三子树；键根 config.* → monitorAlarm.*；nav.label 改组名、新增 nav.config 叶子菜单键） */
export default {
  monitorAlarm: {
    nav: {
      root: '监控告警',
      rootDesc: 'MES 日志关键字与服务挂起的监控告警：配置（本期）/ 查看与解决（规划）',
    },
    logMonitor: {
      nav: {
        label: 'MES日志关键字监控',
        // 二级组下叶子菜单（2026-11-11 模块搬迁用户定稿：现有页改名「配置」，查看/解决规划中）
        config: '配置',
        labelDesc: '维护关键字告警规则与通知配置：环境 × 项目 × 关键字',
      },
      search: {
        placeholder: '搜索 项目 / 描述 / 环境 / 关键字',
        // 搜索框 label（2026-11-11 用户定稿，角色页同款式：域词+匹配字段+模糊匹配）
        searchKeyword: 'Monitor Config（项目 / 描述 / 环境 / 关键字 模糊匹配）',
      },
      columns: {
        environment: '环境',
        item: '项目',
        description: '描述',
        keyword: '关键字',
        followRuleNames: '关注 Rule 名称',
        excludeKeywords: '排除关键字',
        excludeRuleNames: '排除 Rule 名称',
        priority: '优先级',
        lastUpdatedBy: '最后更新人',
        lastUpdatedAt: '最后更新时间',
      },
      states: {
        errorTitle: '规则列表加载失败',
      },
      form: {
        title: '新增规则',
        titleEditing: '编辑规则',
        // 查看态标题（2026-11-11 用户定稿：操作列查看钮开弹窗全禁用）
        titleViewing: '查看规则',
        tabKeyword: '关键字配置',
        tabAlarm: '通知配置',
        itemHint: '≤30 字符；创建后不可改，需删除重建',
        keywordHint: '命中的单个关键字（≤30 字符，字符集不限）',
        followHint: '设置后仅这些 Rule 触发告警；留空 = 不限制',
        excludeKeywordsHint: '命中关键字但含排除词的日志不告警；排除词不得为关键字子串',
        excludeRuleNamesHint: '这些 Rule 命中也不告警；不得与关注 Rule 名称相交',
        discardTitle: '放弃修改？',
        discardMsg: '当前修改尚未提交，确认放弃并关闭？',
      },
      validation: {
        serializedTooLong: '列表序列化超长（≤4000 字符）',
        ruleNameConflict: '关注与排除 Rule 名称冲突：{list}',
        excludeSubstring: '排除词「{list}」是关键字的子串，规则将永不触发',
      },
      warn: {
        deleteMsg:
          '删除后告警服务停止扫描该规则，但不是立即生效——待其下次配置加载（通常一个扫描周期内）；已产生的告警永久保留。确认删除？',
      },
      toast: {
        saved: '配置已保存，告警服务将在下次配置加载（通常一个扫描周期内）后生效',
      },
    },
    // ===== MES 服务挂起监控配置（模块2 · 03，文档 2026-11-10 配置侧定稿、同日前端实现） =====
    srvHangMonitor: {
      nav: {
        label: 'MES服务挂起监控',
        config: '配置',
        labelDesc: '维护环境级 Server Hang / Endless Rule 告警阈值与通知配置',
      },
      columns: {
        environment: '环境',
        maxDelay: '最大延迟耗时',
        maxRuleCost: '最大Rule执行耗时',
        priority: '优先级',
        lastUpdatedBy: '最后更新人',
        lastUpdatedAt: '最后更新时间',
      },
      states: {
        errorTitle: '配置列表加载失败',
      },
      form: {
        environmentHint: '一个环境仅一行配置；编辑时不可改，需删除重建',
        maxDelayHint: '单位秒（1~65535 整数）：Rule 日志断流超过该时长 → 报 Server Hang 告警',
        maxRuleCostHint: '单位秒（1~65535 整数）：单 Rule 写日志超过该时长 → 报 Endless Rule 告警',
      },
      validation: {
        thresholdRange: '仅限大于 0 且不超过 65535 的整数',
      },
      warn: {
        deleteMsg:
          '删除后该环境停止告警扫描，但不是立即生效——待告警服务下次配置加载（通常一个扫描周期内）；已产生的告警永久保留。确认删除？',
      },
    },
    // ===== 告警通知配置编辑器（模块2 · 01 §3.4 公共组件 AlarmCfgEditor 文案，两功能页共用） =====
    alarm: {
      interval: '通知间隔（分）',
      intervalHint: '告警聚合通知间隔：间隔内多条告警合并通知一次',
      mailSection: '邮件通知',
      mailTo: '收件人',
      mailCc: '抄送',
      feishuSection: '飞书通知',
      // feishuGroups Key-Value（2026-11-12 后端合并契约）：Key=组名 / Value=@ 的人 open_id
      feishuGroupKey: '组名',
      feishuGroupValue: '特别提醒人（open_id）',
      // 字面 @ 须转义为 {'@'}——vue-i18n 的 @ 是链接消息语法，裸 @ 会致消息编译 SyntaxError（2026-11-10 实测坑）
      feishuGroupValueHint: "open_id 格式：ou_ 前缀 + 字母数字（如 ou_7d3a91c2e4f6）；{'@'} 的人必须在对应群里，否则 {'@'} 不生效（消息照发）",
      feishuAtHint: "{'@'} 的人必须在对应群里，否则 {'@'} 不生效（消息照发）",
      // 2026-11-11 用户定稿更名：@ 人 → 特别提醒（飞书官方术语）；原常驻灰提示转本字段问号 Hint
      validation: {
        intervalRange: '仅限 1 ~ 99999 的整数',
        emailInvalid: '邮箱格式不合法：{list}',
        serializedTooLong: '列表序列化超长（≤4000 字符）',
        openIdRule: 'open_id 须为 ou_ 前缀 + 字母数字（如 ou_7d3a91c2e4f6）',
      },
    },
  },
}
