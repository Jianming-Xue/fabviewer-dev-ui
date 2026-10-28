/** Config module dictionary (Server Hang Reason Config) */
export default {
  config: {
    nav: {
      root: 'Config',
      rootDesc: 'System administration configurations',
      label: 'Server Hang Reason Config',
      labelDesc: 'Maintain Server Hang Reason Config: Rule × reason × start/end marker lines',
    },
    delayHint: 'Enable toggles, adds and edits take effect on the judging side within 5 minutes (consumer-side cache)',
    control: {
      add: 'Add configuration',
      edit: 'Edit',
      delete: 'Delete',
      toggleStatus: 'Enable/Disable',
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
      title: 'New configuration',
      titleEditing: 'Edit configuration',
      ruleName: 'Rule Name',
      hangReason: 'Hang Reason',
      startLine: 'Start Line Like',
      endLine: 'End Line Like',
      matchMode: 'Match mode',
      ruleNameHint: 'Digits and letters only',
      hangReasonHint: 'Digits, letters and , . _ - only',
      lineLikeHint: 'Enter the literal text only; % is added by the match mode',
      exactWarn1: 'Exact match compares against the whole log line verbatim: a full line carrying the timestamp / Server ID prefix cannot be pasted as-is',
      exactWarn2: 'Log lines whose LOG_BODY exceeds 4000 chars can never hit an exact match (input cap 4000)',
      exactWarn3: 'Prefer the "{chars}" contains mode (front-and-back fuzzy) in general',
    },
    match: {
      leading: 'Starts fuzzy',
      trailing: 'Ends fuzzy',
      both: 'Contains',
      exact: 'Exact',
    },
  },
}
