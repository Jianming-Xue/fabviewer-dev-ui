/** Config 模块词典（Server Hang Reason Config） */
export default {
  config: {
    nav: {
      root: '系统配置',
      rootDesc: '系统管理配置',
      label: '服务挂起原因配置',
      labelDesc: '维护服务挂起原因判定配置：Rule × 原因 × 起止标志行',
    },
    delayHint: '启用切换、新增与编辑最长 5 分钟内在判定侧生效（消费端缓存）',
    control: {
      add: '新增配置',
      edit: '编辑',
      delete: '删除',
      toggleStatus: '启用/停用',
    },
    columns: {
      // 领域词保留英文（用户定稿 2026-10-27：Rule/Hang 等不强行中文化），其余走中文
      ruleName: 'Rule 名称',
      startLineLike: '起始标志行',
      endLineLike: '结束标志行',
      hangReason: 'Hang 原因',
      enabled: '启用',
      updatedAt: '最后更新时间',
      updatedBy: '最后更新人',
    },
    form: {
      title: '新增配置',
      titleEditing: '编辑配置',
      ruleName: 'Rule Name',
      hangReason: 'Hang Reason',
      startLine: 'Start Line Like',
      endLine: 'End Line Like',
      matchMode: '匹配方式',
      ruleNameHint: '仅限数字与大小写字母',
      hangReasonHint: '仅限数字、大小写字母与 , . _ -',
      lineLikeHint: '只填具体文本，% 不进输入框（匹配方式交给单选框）',
      exactWarn1: '精确匹配须与日志行本体整串一字不差：含时间戳 / Server ID 前缀的整行不能直接粘贴',
      exactWarn2: 'LOG_BODY 超过 4000 字的日志行永远无法命中精确匹配（输入上限 4000）',
      exactWarn3: '一般场景请优先用「{chars}」包含模式（前后模糊）',
    },
    match: {
      leading: '只前模糊',
      trailing: '只后模糊',
      both: '前后模糊',
      exact: '精确匹配',
    },
  },
}
