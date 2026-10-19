/**
 * 设备指纹与本机 IP（shared 工具，2026-10-17，登录等接口入参透传用）：
 * - deviceId：首启生成的 UUID 并持久化（localStorage），同浏览器 = 同设备指纹
 * - clientIp：WebRTC ICE 候选尽力读取本机内网 IP；浏览器开 mDNS 隐私保护
 *   或禁 WebRTC 时取不到（返回空串）——权威来源仍是后端从连接读到的地址，
 *   前端此值仅作展示/辅助定位，best-effort。
 */

const DEVICE_KEY = 'vui.deviceId'

/** 设备指纹（设备 ID）：首次调用生成并持久化，之后恒取同值 */
export function getDeviceId(): string {
  let id = ''
  try {
    id = localStorage.getItem(DEVICE_KEY) ?? ''
  } catch {
    /* 存储不可用（无痕/禁用）：退化为本次会话临时值 */
  }
  if (!id) {
    id = crypto.randomUUID
      ? crypto.randomUUID()
      : `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    try {
      localStorage.setItem(DEVICE_KEY, id)
    } catch {
      /* 无法持久化，仅临时 */
    }
  }
  return id
}

let cachedIp: string | null = null

/** 本机 IP（尽力获取，结果缓存；取不到返回空串，不阻塞调用方） */
export async function getClientIp(timeoutMs = 800): Promise<string> {
  if (cachedIp !== null) return cachedIp
  cachedIp = await probeLocalIp(timeoutMs)
  return cachedIp
}

function probeLocalIp(timeoutMs: number): Promise<string> {
  return new Promise((resolve) => {
    const RTC = window.RTCPeerConnection
    if (!RTC) {
      resolve('')
      return
    }
    let settled = false
    const pc = new RTC({ iceServers: [] })
    const finish = (ip: string) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      pc.close()
      resolve(ip)
    }
    const timer = window.setTimeout(() => finish(''), timeoutMs)
    pc.onicecandidate = (e) => {
      const cand = e.candidate?.candidate
      if (!cand) return
      const m = cand.match(/(\d{1,3}(?:\.\d{1,3}){3})/) // host 候选中的 IPv4 点分地址
      if (m?.[1]) finish(m[1])
    }
    try {
      pc.createDataChannel('ip-probe') // 触发 ICE 收集
      void pc
        .createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .catch(() => finish(''))
    } catch {
      finish('')
    }
  })
}
