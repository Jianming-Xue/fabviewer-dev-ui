#!/usr/bin/env node
// ZCode PreToolUse 守卫（2026-10-27 自 .claude/hooks/vui-guard.mjs 迁入，经 .zcode/config.json 注册）。
// 契约=退出码：0 放行/不表态，2 拦截（deny），拦截原因写 stderr。
// （Claude 时代的 JSON allow 决策输出已删——审批一律交还 ZCode 权限流程，本守卫只拦危险命令。）
// 2026-10-19 改造（沿用）：DENY 不对整条命令做子串匹配，改为按段检查——
//   1. 先遮蔽引号内容（grep "sudo" 这类字面量不再误杀），命令替换 $(…) / `…` 单独递归检查；
//   2. 按 ; & | 换行 切段，只拦每段首动词命中危险模式的段；
//   3. sh/bash/zsh 作为管道目标出现时按危险处理（拦 echo … | sh、curl … | sh）。
//   已知妥协：中段内嵌的 sudo（如 find -exec sudo）按首动词策略会漏过，仅 rm -rf /~ 保留段内匹配。
import { readFileSync } from 'node:fs'

const DANGEROUS = [
  /^(?:sudo|doas|mkfs|diskutil|shutdown|reboot)\b/,
  /^dd\b.*\sif=/,
  /^git\b.*\bpush\b.*--force/,
  /^npm\s+(?:un)?publish\b/,
]
const RM_RF = /\brm\s+-\w*(?:[rR]\w*[fF]|[fF]\w*[rR])\s+[/~]/   // rm 强制递归删根/家目录，段内匹配
const SHELL = /^(?:ba|z)?sh\b/

const deny = (reason) => {
  process.stderr.write(`vui-guard: ${reason}\n`)
  process.exit(2)
}

const mask = (t) => t
  .replace(/"(?:[^"\\]|\\.)*"/g, '""')
  .replace(/'[^']*'/g, "''")

const stripRedir = (s) => s.trim().replace(/^(?:2?>+|&)\S*\s*/, '')

// 遮蔽引号、摘出命令替换后按分隔符切段；返回命中的危险段文本，无则 null
function findDanger(text, depth) {
  const subs = []
  let main = text
    .replace(/\$\([^)]*\)/g, (m) => { subs.push(m.slice(2, -1)); return ' SUB ' })
    .replace(/`[^`]*`/g, (m) => { subs.push(m.slice(1, -1)); return ' SUB ' })
  if (depth < 3) for (const inner of subs) { const d = findDanger(inner, depth + 1); if (d) return d }
  main = mask(main)
  const toks = main.match(/[^;&|\n]+|[;&|\n]+/g) ?? []
  for (let i = 0; i < toks.length; i += 2) {
    const seg = stripRedir(toks[i])
    if (!seg) continue
    if (DANGEROUS.some((re) => re.test(seg)) || RM_RF.test(seg)) return seg
    if (SHELL.test(seg) && i > 0 && /\|/.test(toks[i - 1])) return seg   // 管道喂 shell
  }
  return null
}

let cmd = ''
try {
  const input = JSON.parse(readFileSync(0, 'utf8'))
  cmd = input?.tool_input?.command ?? input?.command ?? ''
} catch { process.exit(0) }
if (!cmd.trim()) process.exit(0)

const hit = findDanger(cmd, 0)
if (hit) deny(`危险段「${hit.slice(0, 60)}」，已本地拦截`)
process.exit(0)
