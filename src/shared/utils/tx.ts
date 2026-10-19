/**
 * 交易头工具（shared，2026-10-16）：security-management 等服务要求请求头带
 * txId / txName / userName / txTime。
 * - txId = 调用方法名的 16 位哈希 + '_' + 时间戳(yyyyMMDDHH24mmss) + '_' + 模块版本号
 * - txTime = 当前时间 yyyyMMDDHH24mmss
 */

/** FNV-1a 64bit → 16 位十六进制串 */
export function hash16(input: string): string {
  let h = 0xcbf2_9ce4_8422_2325n
  for (const ch of input) {
    h ^= BigInt(ch.codePointAt(0) ?? 0)
    h = (h * 0x0000_0100_0000_01b3n) & 0xffff_ffff_ffff_ffffn
  }
  return h.toString(16).padStart(16, '0')
}

/** 当前 UI 模块版本上下文（路由切换时由 app 层写入；服务层装 txId 时读取） */
let currentUiVersion = ''
export function setUiVersion(version: string): void {
  currentUiVersion = version
}
export function getUiVersion(): string {
  return currentUiVersion
}

const p2 = (n: number) => String(n).padStart(2, '0')

/** yyyyMMDDHH24mmss（服务端口径的时间串） */
export function formatTxTime(d: Date = new Date()): string {
  return `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`
}

/** txId = 方法名16位哈希_时间戳_模块版本号 */
export function makeTxId(methodName: string, version: string): string {
  return `${hash16(methodName)}_${formatTxTime()}_${version}`
}
