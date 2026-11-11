/** Config 模块词典（Server Hang Reason Config + System Misc + MES日志监控配置 + MES服务挂起监控配置） */
export default {
  config: {
    nav: {
      root: '系统配置',
      rootDesc: '系统管理配置',
      label: '服务挂起原因配置',
      labelDesc: '维护服务挂起原因判定配置：Rule × 原因 × 起止标志行',
    },
    misc: {
      nav: {
        label: '系统杂项配置',
        labelDesc: '维护平台级全局变量（环境/IP 清单等）：仅可编辑，不可增删',
      },
      control: {
        edit: '编辑配置值',
      },
      all: '全部',
      editable: '可编辑',
      searchPlaceholder: '搜索 项目 / 描述',
      on: '开',
      off: '关',
      value: '值',
      defaultValue: '默认值',
      // 查看态标题（2026-11-10：查看并入编辑弹窗 view 态，Json 查看弹窗退役）
      viewTitle: '配置值查看',
      editTitle: '编辑配置项',
      nullValue: '（未设置）',
      confirm: {
        title: '确认修改',
        toggleMsg: '确认将 {item} 切换为「{state}」？修改将立即写库生效。',
        discardTitle: '放弃修改？',
        discardMsg: '当前修改尚未提交，确认放弃并关闭？',
      },
      validation: {
        integer: '仅限整数',
        float: '仅限数字（可含小数）',
        jsonTooLong: 'Json 序列化超长（≤4000 字符）',
        jsonTooMany: '顶层条目超限（≤100）',
      },
    },
    warn: {
      // 5 分钟生效提醒（2026-11-05 用户定稿）：由弹窗底部静态文案改为提交时 Warning 确认框——确认才提交、取消不提交；新增编辑/启停/删除三场景
      effectTitle: '生效延迟提醒',
      effectMsg: '新增或编辑最长 5 分钟内在判定侧生效（消费端缓存）。确认提交？',
      toggleMsg: '启用状态切换最长 5 分钟内在判定侧生效（消费端缓存）。确认继续？',
      deleteMsg: '删除最长 5 分钟内在判定侧生效；已产出的历史 Hang 记录不受影响（不回算）。确认删除？',
    },
    control: {
      add: '新增配置',
      edit: '编辑',
      delete: '删除',
      toggleStatus: '启用/停用',
    },
    columns: {
      // Rule 领域词保留英文（用户定稿 2026-10-27）；Hang 原因列改「挂起原因」（用户定稿 2026-11-04），其余走中文
      ruleName: 'Rule 名称',
      startLineLike: '起始标志行',
      endLineLike: '结束标志行',
      hangReason: '挂起原因',
      enabled: '启用',
      lastUpdatedAt: '最后更新时间',
      lastUpdatedBy: '最后更新人',
    },
    form: {
      title: '新增配置',
      titleEditing: '编辑配置',
      // 四输入框 label 2026-11-05 起复用 columns 键（表格中英文翻译单一来源），form 下不再重复定义
      matchMode: '匹配方式',
      ruleNameHint: '仅限数字与大小写字母',
      hangReasonHint: '仅限数字、大小写字母与 , . _ -',
      lineLikeHint: '只填具体文本，% 不进输入框（匹配方式交给单选框）',
    },
    match: {
      leading: '只前模糊',
      trailing: '只后模糊',
      both: '前后模糊',
      exact: '精确匹配',
    },
    matchHint: {
      leading: '提交为 %＋文本：命中以该文本结尾的日志行',
      trailing: '提交为文本＋%：命中以该文本开头的日志行',
      both: '提交为 %＋文本＋%：命中包含该文本的日志行（通用场景推荐）',
      exact: '不加 %：须与 LOG_BODY 本体（剥行首时间戳 / Server ID 前缀）整串一字不差；超 4000 字的行永远无法命中',
    },
  },
}
