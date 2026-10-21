/* 未活动登出 + 到期日期守卫 验证（2026-10-21） */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function tp() { for (let i = 0; i < 8; i++) { try { const r = await fetch('http://127.0.0.1:9333/json/new?about:blank', { method: 'PUT' }); const j = await r.json(); if (j.webSocketDebuggerUrl) return j } catch {} await sleep(500) } throw new Error('no') }
let ws, mid = 0; const pn = new Map()
const send = (m, p = {}) => new Promise((res, rej) => { const id = ++mid; pn.set(id, { res, rej }); ws.send(JSON.stringify({ id, method: m, params: p })) })
const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: `(${e})`, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error('page: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value }
async function waitFor(expr, label, timeout = 15000) { const t0 = Date.now(); while (Date.now() - t0 < timeout) { try { if (await ev(expr)) return } catch {} await sleep(300) } throw new Error('timeout: ' + label) }
async function clickPos(x, y) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }) }
async function setVal(selProps, val) {
  return ev(`(function(){var lbl=Array.from(document.querySelectorAll('.vui-base-dialog label')).find(function(l){return l.htmlFor&&l.textContent.replace(/[*\\s]/g,'')===${JSON.stringify(selProps)}});if(!lbl)return 'nolabel';var inp=document.getElementById(lbl.htmlFor);var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(inp,${JSON.stringify(val)});inp.dispatchEvent(new Event('input',{bubbles:true}));return 'ok'})()`)
}
const dlgVal = (label) => ev(`(function(){var lbl=Array.from(document.querySelectorAll('.vui-base-dialog label')).find(function(l){return l.htmlFor&&l.textContent.replace(/[*\\s]/g,'')===${JSON.stringify(label)}});return lbl?document.getElementById(lbl.htmlFor).value:null})()`)
async function clickBtn(title) {
  const p = await ev(`(function(){var d=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0}).pop();var b=Array.from(d.querySelectorAll('button')).find(function(x){return x.textContent.trim()===${JSON.stringify(title)}});if(!b)return null;var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
  if (!p) throw new Error('btn ' + title)
  await clickPos(p.x, p.y)
}
const results = []
const check = (n, ok, d = '') => { results.push(ok); console.log(`${ok ? '✅' : '❌'} ${n}${d ? ' — ' + d : ''}`) }

const t = await tp()
await new Promise((res, rej) => { ws = new WebSocket(t.webSocketDebuggerUrl); ws.onopen = res; ws.onerror = rej; ws.onmessage = e2 => { const m = JSON.parse(e2.data); if (m.id && pn.has(m.id)) { const { res: r, rej: j } = pn.get(m.id); pn.delete(m.id); m.error ? j(new Error(m.error.message)) : r(m.result) } } })
await send('Runtime.enable'); await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

async function login(user, pass) {
  await send('Page.navigate', { url: 'http://localhost:5173/login' })
  await waitFor(`location.host==='localhost:5173'`, 'origin')
  await ev(`(function(){localStorage.clear();return true})()`)
  await send('Page.navigate', { url: 'http://localhost:5173/login' })
  await waitFor(`Array.from(document.querySelectorAll('input')).filter(function(i){return i.type==='text'||i.type==='password'}).length>=2`, 'login inputs')
  await ev(`(function(){var inp=Array.from(document.querySelectorAll('input')).filter(function(i){return i.type==='text'||i.type==='password'});var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(inp[0],${JSON.stringify(user)});inp[0].dispatchEvent(new Event('input',{bubbles:true}));s.call(inp[1],${JSON.stringify(pass)});inp[1].dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
  await sleep(500)
  const lb = await ev(`(function(){var b=Array.from(document.querySelectorAll('button')).find(function(x){return x.type==='submit'});var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
  await clickPos(lb.x, lb.y)
}

await login('admin', 'passw0rd')
await waitFor(`location.pathname!=='/login'`, 'login ok')
await sleep(800)
const cfg = await ev(`(function(){try{return JSON.stringify((JSON.parse(localStorage.getItem('vui.auth')||'{}').idleLogoutMinutes))}catch(e){return 'err'}})()`)
check(`① 登录后 vui.auth.idleLogoutMinutes=30（P001 下发）`, cfg === '30', cfg)

// ② 策略编辑弹窗：新字段可配置
await send('Page.navigate', { url: 'http://localhost:5173/security/login-policy' })
await waitFor(`Array.from(document.querySelectorAll('tbody tr')).some(function(r){return r.innerText.indexOf('P002')>=0})`, 'policy rows')
await sleep(900)
const ep = await ev(`(function(){var tr=Array.from(document.querySelectorAll('tbody tr')).find(function(r){return r.innerText.indexOf('P002')>=0});var b=tr.querySelector('button');var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
await clickPos(ep.x, ep.y); await waitFor(`(function(){var d=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0}).pop();return d&&d.innerText.indexOf('编辑策略')>=0})()`, 'edit dialog'); await sleep(1100)
check('② P002 未活动登出（分钟）回显 15', (await dlgVal('未活动登出（分钟）')) === '15', String(await dlgVal('未活动登出（分钟）')))
await setVal('未活动登出（分钟）', '20'); await sleep(300); await clickBtn('确认')
await waitFor(`document.body.innerText.indexOf('策略已更新')>=0`, 'saved'); await sleep(700)
const ep2 = await ev(`(function(){var tr=Array.from(document.querySelectorAll('tbody tr')).find(function(r){return r.innerText.indexOf('P002')>=0});var b=tr.querySelector('button');var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
await clickPos(ep2.x, ep2.y); await sleep(1100)
check('② 配置 20 保存并回显', (await dlgVal('未活动登出（分钟）')) === '20', String(await dlgVal('未活动登出（分钟）')))
await setVal('未活动登出（分钟）', '15'); await sleep(300); await clickBtn('确认'); await waitFor(`document.body.innerText.indexOf('策略已更新')>=0`, 'restored'); await sleep(500)

// ③ 非法值拦截
const ep3 = await ev(`(function(){var tr=Array.from(document.querySelectorAll('tbody tr')).find(function(r){return r.innerText.indexOf('P001')>=0});var b=tr.querySelector('button');var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
await clickPos(ep3.x, ep3.y); await sleep(1100)
await setVal('未活动登出（分钟）', '0'); await sleep(200); await clickBtn('确认'); await sleep(800)
const badge = await ev(`(function(){var d=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0}).pop();var lbl=Array.from(d.querySelectorAll('label')).find(function(l){return l.textContent.indexOf('未活动登出')>=0&&l.htmlFor});return lbl.closest('.v-input').querySelectorAll('.fv-field__err-badge').length})()`)
check('③ 0 值非法拦截（-1 或 1~9999）', badge >= 1, 'badges=' + badge)
await clickBtn('取消'); await sleep(700)

// ④ 路由守卫日期卡点：wang 账户 2026-10-01 已过期 → 登录后即被登出回登录页
await login('wang.jianguo', 'passw0rd')
await waitFor(`location.pathname==='/login' && location.search.indexOf('reason=expired')>=0`, 'date-expired bounce', 20000).catch(() => {})
const bounced = await ev(`location.pathname==='/login' && location.search.indexOf('reason=expired')>=0`)
const cleared = await ev(`!localStorage.getItem('vui.auth')`)
check('④ 过期账户登录后被守卫登出（reason=expired，会话已清）', bounced && cleared, `bounced=${bounced} cleared=${cleared}`)

// ⑤ 未活动登出实测：阈值改为 1 分钟，静置等待自动登出（不动鼠标键盘）
await login('admin', 'passw0rd')
await waitFor(`location.pathname!=='/login'`, 'admin again')
await ev(`(function(){var a=JSON.parse(localStorage.getItem('vui.auth'));a.idleLogoutMinutes=1;localStorage.setItem('vui.auth',JSON.stringify(a));return true})()`)
await send('Page.navigate', { url: 'http://localhost:5173/security/users' })
await waitFor(`location.pathname==='/security/users'`, 'users after patch')
console.log('…静置等待 1 分钟无操作自动登出（不派发任何输入事件）')
let idleOut = false
for (let i = 0; i < 26; i++) {
  await sleep(4000)
  if (await ev(`location.pathname==='/login' && location.search.indexOf('reason=idle')>=0`)) { idleOut = true; break }
}
const alertShown = await ev(`document.body.innerText.indexOf('长时间未操作')>=0`)
check('⑤ 无操作达阈值自动登出（reason=idle + 提示条）', idleOut && alertShown, `idleOut=${idleOut} alert=${alertShown}`)

console.log(`\n通过 ${results.filter(Boolean).length}/${results.length}`)
process.exitCode = results.includes(false) ? 1 : 0
ws.close()
