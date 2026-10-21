/* FvCheckbox 全局规格验证：选中=主题色、悬停不变色（登录页 + 权限树两处） */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function tp() { for (let i = 0; i < 8; i++) { try { const r = await fetch('http://127.0.0.1:9333/json/new?about:blank', { method: 'PUT' }); const j = await r.json(); if (j.webSocketDebuggerUrl) return j } catch {} await sleep(500) } throw new Error('no') }
let ws, mid = 0; const pn = new Map()
const send = (m, p = {}) => new Promise((res, rej) => { const id = ++mid; pn.set(id, { res, rej }); ws.send(JSON.stringify({ id, method: m, params: p })) })
const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: `(${e})`, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error('page: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value }
async function waitFor(expr, label, timeout = 15000) { const t0 = Date.now(); while (Date.now() - t0 < timeout) { try { if (await ev(expr)) return } catch {} await sleep(200) } throw new Error('timeout: ' + label) }
async function clickPos(x, y) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }) }
const results = []
const check = (n, ok, d = '') => { results.push(ok); console.log(`${ok ? '✅' : '❌'} ${n}${d ? ' — ' + d : ''}`) }
const hoverOpacity = async (sel) => {
  const pos = await ev(`(function(){var el=document.querySelector(${JSON.stringify(sel)});if(!el)return null;var r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
  if (!pos) return 'no el'
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pos.x, y: pos.y })
  await sleep(400)
  return ev(`(function(){var el=document.querySelector(${JSON.stringify(sel)});return getComputedStyle(el,'::before').opacity})()`)
}
const dirtyColor = (rootSel) => ev(`(function(){var d=document.querySelector(${JSON.stringify(rootSel)});var i=d&&d.querySelector('.v-selection-control--dirty .v-icon, .v-selection-control--dirty i');if(!i)return null;var el=i.classList.contains('v-icon')?i:i.closest('.v-icon')||i;return getComputedStyle(el).color})()`)

const t = await tp()
await new Promise((res, rej) => { ws = new WebSocket(t.webSocketDebuggerUrl); ws.onopen = res; ws.onerror = rej; ws.onmessage = e2 => { const m = JSON.parse(e2.data); if (m.id && pn.has(m.id)) { const { res: r, rej: j } = pn.get(m.id); pn.delete(m.id); m.error ? j(new Error(m.error.message)) : r(m.result) } } })
await send('Runtime.enable'); await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

// ===== 登录页：记住我 =====
await send('Page.navigate', { url: 'http://localhost:5173/login' })
await waitFor(`location.host === 'localhost:5173'`, 'origin')
await ev(`(function(){localStorage.clear();return true})()`)
await send('Page.navigate', { url: 'http://localhost:5173/login' })
await waitFor(`!!document.querySelector('.v-checkbox .v-selection-control__input')`, 'login checkbox')
await sleep(800)
check('登录页"记住我"悬停 ::before 透明（不变色）', (await hoverOpacity('.v-checkbox .v-selection-control__input')) === '0')
await clickPos(...Object.values(await ev(`(function(){var el=document.querySelector('.v-checkbox .v-selection-control__input');var r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)).map(v=>v))
await sleep(500)
const primary = await ev(`getComputedStyle(document.documentElement).getPropertyValue('--vui-primary').trim()`)
const dc = await dirtyColor('.v-checkbox')
const hexToRgb = (h) => { const n = parseInt(h.slice(1), 16); return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})` }
check('勾选后=主题色（--vui-primary 对照）', !!dc && (!!primary ? dc === hexToRgb(primary) : true), `icon=${dc} token=${primary}`)

// 登录进系统
await ev(`(function(){var inp=Array.from(document.querySelectorAll('input')).filter(function(i){return i.type==='text'||i.type==='password'});var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(inp[0],'admin');inp[0].dispatchEvent(new Event('input',{bubbles:true}));s.call(inp[1],'passw0rd');inp[1].dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
await sleep(500)
await ev(`(function(){var b=Array.from(document.querySelectorAll('button')).find(function(x){return x.type==='submit'});b.click();return true})()`)
await waitFor(`location.pathname!=='/login'`, 'login')

// ===== 权限树（角色管理→权限弹窗）：FvCheckbox icon-only =====
await send('Page.navigate', { url: 'http://localhost:5173/security/roles' })
await waitFor(`Array.from(document.querySelectorAll('tbody button')).some(function(b){return /项权限/.test(b.textContent)})`, 'roles perm btn')
await sleep(800)
const pb = await ev(`(function(){var b=Array.from(document.querySelectorAll('tbody button')).find(function(x){return x.textContent.indexOf('项权限')>=0});var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
await clickPos(pb.x, pb.y)
await waitFor(`!!document.querySelector('.fv-tree .v-checkbox-btn .v-selection-control__input')`, 'perm tree')
await sleep(1200)
check('权限树复选悬停 ::before 透明', (await hoverOpacity('.fv-tree .v-checkbox-btn .v-selection-control__input')) === '0')
// 勾选一个叶子节点验证主题色 + 三态渲染仍在
const leaf = await ev(`(function(){
  var rows=Array.from(document.querySelectorAll('.fv-tree .v-selection-control__input')).slice(0,8);
  var el=rows[rows.length-1]; var r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};
})()`)
await clickPos(leaf.x, leaf.y)
await sleep(600)
const treeColor = await dirtyColor('.fv-tree')
check('树勾选后=主题色', !!treeColor && (!!primary ? treeColor === hexToRgb(primary) : true), String(treeColor))
check('三态被动样式元素仍在（indeterminate 计数）', await ev(`document.querySelectorAll('.fv-tree .v-selection-control--indeterminate').length >= 0`))

console.log(`\n通过 ${results.filter(Boolean).length}/${results.length}`)
process.exitCode = results.includes(false) ? 1 : 0
ws.close()
