/** Config module dictionary (Server Hang Reason Config + System Misc + MES Log Monitor Config + MES Server Hang Monitor Config) */
export default {
  config: {
    nav: {
      root: 'Config',
      rootDesc: 'System administration configurations',
      label: 'Server Hang Reason Config',
      labelDesc: 'Maintain Server Hang Reason Config: Rule × reason × start/end marker lines',
    },
    misc: {
      nav: {
        label: 'System Misc',
        labelDesc: 'Maintain platform-wide global variables (environment/IP lists, etc.): edit only, no create/delete',
      },
      control: {
        edit: 'Edit values',
      },
      all: 'All',
      editable: 'Editable',
      searchPlaceholder: 'Search item / description',
      on: 'ON',
      off: 'OFF',
      value: 'Value',
      defaultValue: 'Default Value',
      // View-mode title (2026-11-10: viewing merged into the edit dialog's view mode; Json view dialog retired)
      viewTitle: 'View Values',
      editTitle: 'Edit Item',
      nullValue: '(not set)',
      confirm: {
        title: 'Confirm Change',
        toggleMsg: 'Switch {item} to "{state}"? The change is written immediately.',
        discardTitle: 'Discard changes?',
        discardMsg: 'Unsaved changes will be lost. Discard and close?',
      },
      validation: {
        integer: 'Integer only',
        float: 'Number only (decimals allowed)',
        jsonTooLong: 'Serialized Json exceeds 4000 characters',
        jsonTooMany: 'More than 100 top-level entries',
      },
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
