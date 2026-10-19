/** Config module dictionary (Server Hang Reason Config) */
export default {
  config: {
    nav: {
      root: 'Config',
      rootDesc: 'System administration configurations',
      label: 'Server Hang',
      labelDesc: 'Maintain Server Hang rules: Rule × reason × start/end marker lines',
    },
    title: 'Server Hang Reason Config',
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
      editingTag: 'Editing',
      ruleName: 'Rule Name',
      hangReason: 'Hang Reason',
      startLine: 'Start Line Like',
      endLine: 'End Line Like',
      matchMode: 'Match mode',
      ruleNameHint: 'Digits and letters only',
      hangReasonHint: 'Digits, letters and , . _ - only',
      lineLikeHint: 'Enter the literal text only; % is added by the match mode',
      exactHint: 'Exact match requires the full log body line; prefer "contains" in most cases',
    },
    match: {
      leading: 'Starts fuzzy',
      trailing: 'Ends fuzzy',
      both: 'Contains',
      exact: 'Exact',
    },
  },
}
