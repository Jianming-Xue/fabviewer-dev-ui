/** Monitor-Alarm 模块词典（2026-11-11 模块搬迁自 config 模块整段移入：logMonitor/srvHangMonitor/alarm
 *  三子树；键根 config.* → monitorAlarm.*；nav.label 改组名、新增 nav.config 叶子菜单键） */
export default {
  monitorAlarm: {
    nav: {
      root: 'Monitor & Alarm',
      rootDesc: 'MES log-keyword and server-hang monitoring alarms: config (now) / view & resolve (planned)',
    },
    logMonitor: {
      nav: {
        label: 'MES Log Keyword Monitor',
        // Leaf menus under the group (2026-11-11 module move): existing page renamed Config; view/resolve planned
        config: 'Config',
        labelDesc: 'Maintain keyword alarm rules and notification configs: Environment × Item × Keyword',
      },
      search: {
        placeholder: 'Search Item / Description / Environment / Keyword',
        // Search input label (2026-11-11 user-finalized, roles-page pattern: domain + fuzzy fields)
        searchKeyword: 'Monitor Config (fuzzy: Item / Description / Environment / Keyword)',
      },
      columns: {
        environment: 'Environment',
        item: 'Item',
        description: 'Description',
        keyword: 'Keyword',
        followRuleNames: 'Follow Rule Name',
        excludeKeywords: 'Exclude Keywords',
        excludeRuleNames: 'Exclude Rule Names',
        priority: 'Priority',
        lastUpdatedBy: 'Last Updated User',
        lastUpdatedAt: 'Last Updated Time',
      },
      states: {
        errorTitle: 'Failed to load rules',
      },
      form: {
        title: 'New Rule',
        titleEditing: 'Edit Rule',
        // View-mode title (2026-11-11: table view action opens the dialog fully disabled)
        titleViewing: 'View Rule',
        tabKeyword: 'Keyword Config',
        tabAlarm: 'Alarm Config',
        itemHint: '≤30 chars; locked after creation — delete and recreate to change',
        keywordHint: 'The single keyword to match (≤30 chars, any characters)',
        followHint: 'When set, only these Rule Names trigger alerts; empty = no restriction',
        excludeKeywordsHint: 'Lines containing an exclude term are suppressed; no term may be a substring of Keyword',
        excludeRuleNamesHint: 'These Rule Names never alert; must not intersect Follow Rule Name',
        discardTitle: 'Discard changes?',
        discardMsg: 'Unsaved changes will be lost. Discard and close?',
      },
      validation: {
        serializedTooLong: 'Serialized list exceeds 4000 characters',
        ruleNameConflict: 'Follow / Exclude Rule Names conflict: {list}',
        excludeSubstring: 'Exclude term "{list}" is a substring of Keyword — the rule would never fire',
      },
      warn: {
        deleteMsg:
          'Deletion stops the alarm service from scanning this rule, but is not effective immediately — it applies on the next config reload (typically within one scan cycle). Generated alarms are kept permanently. Delete anyway?',
      },
      toast: {
        saved: 'Saved. The alarm service applies it on the next config reload (typically within one scan cycle)',
      },
    },
    // ===== MES Server Hang Monitor Config (Module 2 · 03, doc finalized 2026-11-10, built same day) =====
    srvHangMonitor: {
      nav: {
        label: 'MES Server Hang Monitor',
        config: 'Config',
        labelDesc: 'Maintain per-environment Server Hang / Endless Rule alarm thresholds and notifications',
      },
      columns: {
        environment: 'Environment',
        maxDelay: 'Max Delay',
        maxRuleCost: 'Max Rule Cost',
        priority: 'Priority',
        lastUpdatedBy: 'Last Updated User',
        lastUpdatedAt: 'Last Updated Time',
      },
      states: {
        errorTitle: 'Failed to load configs',
      },
      form: {
        environmentHint: 'One row per environment; locked while editing — delete and recreate to change',
        maxDelayHint: 'Seconds (integer 1–65535): a Server Hang alarm fires when log silence exceeds it',
        maxRuleCostHint: 'Seconds (integer 1–65535): an Endless Rule alarm fires when a Rule keeps writing logs beyond it',
      },
      validation: {
        thresholdRange: 'Integer greater than 0 and ≤ 65535 only',
      },
      warn: {
        deleteMsg:
          'Deletion stops alarm scanning for this environment, but is not effective immediately — it applies on the next config reload (typically within one scan cycle). Generated alarms are kept permanently. Delete anyway?',
      },
    },
    // ===== Alarm notification config editor (Module 2 · 01 §3.4 shared component AlarmCfgEditor; used by both features) =====
    alarm: {
      interval: 'Notify Interval (min)',
      intervalHint: 'Aggregation window: alarms within the interval are notified together',
      mailSection: 'Email Notification',
      mailTo: 'To',
      mailCc: 'CC',
      feishuSection: 'Feishu Notification',
      // feishuGroups Key-Value (2026-11-12 backend merge): Key=group name / Value=open_ids to mention
      feishuGroupKey: 'Group Name',
      feishuGroupValue: 'Special Reminder Members (open_id)',
      feishuGroupValueHint: 'open_id format: ou_ prefix + alphanumerics (e.g. ou_7d3a91c2e4f6); mentioned users must be in the target group, otherwise the mention has no effect (the message is still sent)',
      feishuAtHint: 'Mentioned users must be in the target group, otherwise the mention has no effect (the message is still sent)',
      // Literal @ must be escaped as {'@'} — bare @ is vue-i18n linked-message syntax (compilation SyntaxError)
      // 2026-11-11 user-finalized rename: @ Users -> Special Reminder; former standing gray hint moved to this field's question-mark hint
      validation: {
        intervalRange: 'Integer between 1 and 99999 only',
        emailInvalid: 'Invalid email address: {list}',
        openIdRule: 'open_id must be ou_ prefix + alphanumerics (e.g. ou_7d3a91c2e4f6)',
        serializedTooLong: 'Serialized list exceeds 4000 characters',
      },
    },
  },
}
