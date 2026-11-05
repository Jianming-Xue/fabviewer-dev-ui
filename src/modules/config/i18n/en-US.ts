/** Config module dictionary (Server Hang Reason Config) */
export default {
  config: {
    nav: {
      root: 'Config',
      rootDesc: 'System administration configurations',
      label: 'Server Hang Reason Config',
      labelDesc: 'Maintain Server Hang Reason Config: Rule × reason × start/end marker lines',
    },
    warn: {
      // 5-minute effect reminder (2026-11-05): static caption replaced by a Warning confirm at submit time — confirm submits, cancel aborts; add-edit / toggle / delete
      effectTitle: 'Delayed Effect Reminder',
      effectMsg: 'Creates and edits take up to 5 minutes to reach the judging side (consumer cache). Submit anyway?',
      toggleMsg: 'Enable toggles take up to 5 minutes to reach the judging side (consumer cache). Continue?',
      deleteMsg: 'Deletions take up to 5 minutes to reach the judging side; existing Hang history is not recalculated. Delete anyway?',
    },
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
      lastUpdatedAt: 'Last Updated Time',
      lastUpdatedBy: 'Last Updated User',
    },
    form: {
      title: 'New configuration',
      titleEditing: 'Edit configuration',
      // The four input labels reuse the columns keys since 2026-11-05 (single source = table translations)
      matchMode: 'Match mode',
      ruleNameHint: 'Digits and letters only',
      hangReasonHint: 'Digits, letters and , . _ - only',
      lineLikeHint: 'Enter the literal text only; % is added by the match mode',
    },
    match: {
      leading: 'Starts fuzzy',
      trailing: 'Ends fuzzy',
      both: 'Contains',
      exact: 'Exact',
    },
    matchHint: {
      leading: 'Submitted as % + text: matches log lines ending with this text',
      trailing: 'Submitted as text + %: matches log lines starting with this text',
      both: 'Submitted as % + text + %: matches log lines containing this text (recommended default)',
      exact: 'No %: must equal the LOG_BODY (line body without the leading timestamp / Server ID prefix) character-for-character; lines over 4000 chars can never match',
    },
  },
}
