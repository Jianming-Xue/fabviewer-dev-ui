/** 浏览器端文件下载：Blob → 触发保存 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** 下载接口（zip / log 等二进制），不走统一响应包 */
export async function downloadByUrl(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<Blob> {
  const res = await fetch(path, {
    method: init.method ?? 'GET',
    headers: init.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
  if (!res.ok) throw new Error(`download failed: ${res.status}`)
  return res.blob()
}
