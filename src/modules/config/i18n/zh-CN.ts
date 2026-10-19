/** Config 模块词典（Server Hang Reason Config） */
export default {
  config: {
    nav: {
      root: '系统配置',
      rootDesc: '系统管理配置',
      label: 'Server Hang',
      labelDesc: '维护 Server Hang 判定配置：Rule × 原因 × 起止标志行',
    },
    title: 'Server Hang Reason Config',
    control: {
      add: '新增配置',
      edit: '编辑',
      delete: '删除',
      toggleStatus: '启用/停用',
    },
    columns: {
      ruleName: 'Rule Name',
      startLineLike: 'Start Line Like',
      endLineLike: 'End Line Like',
      hangReason: 'Hang Reason',
      enabled: 'Enabled',
      updatedAt: 'Last Updated Time',
      updatedBy: 'Last Updated User',
    },
    form: {
      title: '新增配置',
      titleEditing: '编辑配置',
      editingTag: '正在编辑',
      ruleName: 'Rule Name',
      hangReason: 'Hang Reason',
      startLine: 'Start Line Like',
      endLine: 'End Line Like',
      matchMode: '匹配方式',
      ruleNameHint: '仅限数字与大小写字母',
      hangReasonHint: '仅限数字、大小写字母与 , . _ -',
      lineLikeHint: '只填具体文本，% 不进输入框（匹配方式交给单选框）',
      exactHint: '「精确匹配」= 与日志行本体整串一字不差，通常优先用「前后模糊」',
    },
    match: {
      leading: '只前模糊',
      trailing: '只后模糊',
      both: '前后模糊',
      exact: '精确匹配',
    },
  },
}
