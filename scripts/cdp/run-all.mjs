#!/usr/bin/env node
/* CDP 验证全量跑批：依序执行本目录九套脚本，任一失败退出码非 0。
   前置见 README（dev :5173 + headless Chrome :9333）。 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const dir = dirname(fileURLToPath(import.meta.url))
const suites = [
  'vui-policy-test.mjs',
  'vui-names-test.mjs',
  'vui-timer-test.mjs',
  'vui-policy-link-test.mjs',
  'vui-profile-edit-test.mjs',
  'vui-checkbox-test.mjs',
  'vui-expiry-test.mjs',
  'vui-rp-dialog-test.mjs',
  'vui-search-align.mjs',
  'vui-expire-account-test.mjs',
]

let failed = []
for (const s of suites) {
  console.log(`\n===== ${s} =====`)
  const code = await new Promise((resolve) => {
    const child = spawn(process.execPath, [join(dir, s)], { stdio: 'inherit' })
    child.on('exit', (c) => resolve(c ?? 1))
  })
  if (code !== 0) failed.push(s)
  // 套件间隙：让上一套的 Toast/动效落定（背靠背跑批偶发抖动，单跑稳定——2026-10-21 实测注记）
  await new Promise((r) => setTimeout(r, 2500))
}
console.log(`\n===== 总结 =====`)
console.log(failed.length ? `失败 ${failed.length}/${suites.length}：${failed.join(', ')}` : `全部通过 ${suites.length}/${suites.length}`)
process.exit(failed.length ? 1 : 0)
