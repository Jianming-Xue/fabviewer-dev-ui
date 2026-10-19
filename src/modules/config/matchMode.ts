/**
 * 匹配方式四式（模块 5 · 01 §三）：% 只在库里出现，页面用单选框表达；
 * 提交按单选拼回首尾，编辑回显时拆开。
 */
export type MatchMode = 'leadingFuzzy' | 'trailingFuzzy' | 'bothFuzzy' | 'exact'

/** 输入框文本 + 单选框 → 入参完整形态（带 %） */
export function applyMatchMode(text: string, mode: MatchMode): string {
  const prefix = mode === 'leadingFuzzy' || mode === 'bothFuzzy' ? '%' : ''
  const suffix = mode === 'trailingFuzzy' || mode === 'bothFuzzy' ? '%' : ''
  return `${prefix}${text}${suffix}`
}

/** 库中带 % 的完整值 → { 去掉首尾 % 的文本, 单选框态 }（执行只看首尾是否含 %） */
export function splitMatchMode(stored: string): { text: string; mode: MatchMode } {
  const leading = stored.startsWith('%')
  const trailing = stored.endsWith('%')
  let text = stored
  if (leading) text = text.slice(1)
  if (trailing) text = text.slice(0, -1)
  const mode: MatchMode =
    leading && trailing ? 'bothFuzzy' : leading ? 'leadingFuzzy' : trailing ? 'trailingFuzzy' : 'exact'
  return { text, mode }
}
