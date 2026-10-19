import type { RuleInfoDto } from '@/api/log-service/types'
import type { ColumnSettings } from '../stores/search'
import { msToSeconds } from '@/shared/utils/time'

/** 结果列种类：决定单元格渲染方式与导出取值 */
export type ColumnKind =
  | 'plain'
  | 'mono'
  | 'multi'
  | 'result'
  | 'seconds'
  | 'breakdown-lock'
  | 'breakdown-call'

export interface ResultColumn {
  key: string
  title: string
  kind: ColumnKind
  /** 动态耗时列的 item / group 名（§3.3：从 costBreakDown 按 item+group 筛 summary） */
  breakdownName?: string
  width?: number
}

type Translate = (key: string) => string

/** 列顺序固定五段：恒显示 14 → 可隐藏 3 → 可选 1 → 动态耗时 N → Server Hang 末列（§3.2） */
export function buildResultColumns(
  settings: ColumnSettings,
  dynamic: { kind: 'lock' | 'call'; name: string }[],
  t: Translate,
): ResultColumn[] {
  const cols: ResultColumn[] = [
    { key: 'env', kind: 'mono', title: t('ruleSearch.columns.env') },
    { key: 'ipaddress', kind: 'mono', title: t('ruleSearch.columns.ipaddress') },
    { key: 'serverId', kind: 'mono', title: t('ruleSearch.columns.serverId') },
    { key: 'ruleName', kind: 'mono', title: t('ruleSearch.columns.ruleName'), width: 210 },
    { key: 'requestType', kind: 'plain', title: t('ruleSearch.columns.requestType') },
    { key: 'startTime', kind: 'mono', title: t('ruleSearch.columns.startTime'), width: 190 },
    { key: 'endTime', kind: 'mono', title: t('ruleSearch.columns.endTime'), width: 190 },
    { key: 'ruleResult', kind: 'result', title: t('ruleSearch.columns.ruleResult') },
    { key: 'errorCode', kind: 'multi', title: t('ruleSearch.columns.errorCode') },
    { key: 'eqpId', kind: 'multi', title: t('ruleSearch.columns.eqpId') },
    { key: 'lotId', kind: 'multi', title: t('ruleSearch.columns.lotId') },
    { key: 'carrierId', kind: 'multi', title: t('ruleSearch.columns.carrierId') },
    { key: 'userId', kind: 'multi', title: t('ruleSearch.columns.userId') },
    { key: 'tid', kind: 'multi', title: t('ruleSearch.columns.tid'), width: 170 },
  ]

  if (settings.showTotalCost) {
    cols.push({ key: 'totalCostTime', kind: 'seconds', title: t('ruleSearch.columns.totalCostTime') })
  }
  if (settings.showCostSummary) {
    cols.push({ key: 'costSummary', kind: 'seconds', title: t('ruleSearch.columns.costSummary') })
  }
  if (settings.showUnaccounted) {
    cols.push({
      key: 'unaccountedCost',
      kind: 'seconds',
      title: t('ruleSearch.columns.unaccountedCost'),
    })
  }
  if (settings.showExecStatus) {
    cols.push({ key: 'execStatus', kind: 'plain', title: t('ruleSearch.columns.execStatus') })
  }

  // 动态耗时列：Lock + 空格 + 对象名 / Call + 空格 + 系统名（§3.3）
  for (const d of dynamic) {
    cols.push({
      key: `breakdown:${d.kind}:${d.name}`,
      title: `${d.kind === 'lock' ? 'Lock' : 'Call'} ${d.name}`,
      kind: d.kind === 'lock' ? 'breakdown-lock' : 'breakdown-call',
      breakdownName: d.name,
    })
  }
  return cols
}

/** 单元格文本（Export 取值用：多值逗号拼接、耗时转秒、动态列筛 breakdown） */
export function cellText(row: RuleInfoDto, col: ResultColumn): string {
  switch (col.kind) {
    case 'multi': {
      const v = row[col.key as keyof RuleInfoDto]
      return Array.isArray(v) ? v.join(', ') : String(v ?? '')
    }
    case 'seconds': {
      const v = Number(row[col.key as keyof RuleInfoDto])
      return msToSeconds(v)
    }
    case 'breakdown-lock':
    case 'breakdown-call': {
      const group = col.kind === 'breakdown-lock' ? 'LOCK' : 'CALL'
      const hit = row.costBreakDown.find((b) => b.group === group && b.item === col.breakdownName)
      return hit ? msToSeconds(hit.summary) : '' // 缺该项耗时显示空（§3.3）
    }
    default:
      return String(row[col.key as keyof RuleInfoDto] ?? '')
  }
}
