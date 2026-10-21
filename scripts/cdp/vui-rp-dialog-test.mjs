/* EditUserRolePolicyDialog 2026-10-21 改版验证：天数移除+激活只读+必填拦截+策略联动到期/Hint */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function tp() { for (let i = 0; i < 8; i++) { try { const r = await fetch('http://127.0.0.1:9333/json/new?about:blank', { method: 'PUT' }); const j = await r.json(); if (j.webSocketDebuggerUrl) return j } catch {} await sleep(500) } throw new Error('no') }
let ws, mid = 0; const pn = new Map()
const send = (m, p = {}) => new Promise((res, rej) => { const id = ++mid; pn.set(id, { res, rej }); ws.send(JSON.stringify({ id, method: m, params: p })) })
const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: `(${e})`, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error('page: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value }
async function waitFor(expr, label, timeout = 15000) { const t0 = Date.now(); while (Date.now() - t0 < timeout) { try { if (await ev(expr)) return } catch {} await sleep(200) } throw new Error('timeout: ' + label) }
async function clickPos(x, y) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }) }
const results = []
const check = (n, ok, d = '') => { results.push(ok); console.log(`${ok ? '✅' : '❌'} ${n}${d ? ' — ' + d : ''}`) }
const DLG = `(function(){var ds=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0});return ds[ds.length-1]})()`
async function clickBtn(title) {
  const p = await ev(`(function(){var d=${DLG};var b=Array.from(d.querySelectorAll('button')).find(function(x){return x.textContent.trim()===${JSON.stringify(title)}});if(!b)return null;var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
  if (!p) throw new Error('btn ' + title)
  await clickPos(p.x, p.y)
}
async function pickPolicy(name) {
  const sp = await ev(`(function(){var d=${DLG};var lbl=Array.from(d.querySelectorAll('label')).find(function(l){return l.textContent.indexOf('登录策略')>=0&&l.htmlFor});var inp=document.getElementById(lbl.htmlFor);var r=inp.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
  await clickPos(sp.x, sp.y); await sleep(1300)
  const ip = await ev(`(function(){var c=Array.from(document.querySelectorAll('.v-select__content')).find(function(x){return x.getClientRects().length>0});if(!c)return null;var it=Array.from(c.querySelectorAll('.v-list-item')).find(function(x){return x.textContent.trim()===${JSON.stringify(name)}});if(!it)return null;var r=it.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
  if (!ip) throw new Error('policy ' + name)
  await clickPos(ip.x, ip.y); await sleep(1000)
}
async function clearPolicy() {
  const p = await ev(`(function(){var d=${DLG};var lbl=Array.from(d.querySelectorAll('label')).find(function(l){return l.textContent.indexOf('登录策略')>=0&&l.htmlFor});var c=lbl.closest('.v-input').querySelector('.v-field__clearable');if(!c)return null;var r=c.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
  if (!p) throw new Error('clear icon')
  await clickPos(p.x, p.y); await sleep(700)
}
const timers = () => ev(`(function(){var d=${DLG};return JSON.stringify(Array.from(d.querySelectorAll('.fv-timer')).map(function(t){return Array.from(t.querySelectorAll('.fv-timer__seg')).map(function(s){return s.value}).join('-')}))})()`)
const dlgText = () => ev(`(function(){var d=${DLG};return d.innerText})()`)
async function hoverExpiryHint() {
  const p = await ev(`(function(){var d=${DLG};var ts=d.querySelectorAll('.fv-timer');var ic=ts[1].querySelector('.fv-field__hint-icon');if(!ic)return null;var r=ic.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
  if (!p) return 'NOICON'
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y }); await sleep(1000)
  const txt = await ev(`(function(){var ts=Array.from(document.querySelectorAll('.vui-table-tip')).find(function(x){return x.getClientRects().length>0});return ts?ts.textContent:''})()`)
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y - 150 }); await sleep(400)
  return txt
}
const policyBadges = () => ev(`(function(){var d=${DLG};var lbl=Array.from(d.querySelectorAll('label')).find(function(l){return l.textContent.indexOf('登录策略')>=0&&l.htmlFor});return lbl.closest('.v-input').querySelectorAll('.fv-field__err-badge').length})()`)

const t = await tp()
await new Promise((res, rej) => { ws = new WebSocket(t.webSocketDebuggerUrl); ws.onopen = res; ws.onerror = rej; ws.onmessage = e2 => { const m = JSON.parse(e2.data); if (m.id && pn.has(m.id)) { const { res: r, rej: j } = pn.get(m.id); pn.delete(m.id); m.error ? j(new Error(m.error.message)) : r(m.result) } } })
await send('Runtime.enable'); await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

await send('Page.navigate', { url: 'http://localhost:5173/login' })
await waitFor(`location.host==='localhost:5173'`, 'origin')
await ev(`(function(){localStorage.clear();return true})()`)
await send('Page.navigate', { url: 'http://localhost:5173/login' })
await waitFor(`Array.from(document.querySelectorAll('input')).filter(function(i){return i.type==='text'||i.type==='password'}).length>=2`, 'login inputs')
await ev(`(function(){var inp=Array.from(document.querySelectorAll('input')).filter(function(i){return i.type==='text'||i.type==='password'});var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(inp[0],'admin');inp[0].dispatchEvent(new Event('input',{bubbles:true}));s.call(inp[1],'passw0rd');inp[1].dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
await sleep(500)
const lb = await ev(`(function(){var b=Array.from(document.querySelectorAll('button')).find(function(x){return x.type==='submit'});var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
await clickPos(lb.x, lb.y)
await waitFor(`location.pathname!=='/login'`, 'redirect')
await send('Page.navigate', { url: 'http://localhost:5173/security/users' })
await waitFor(`Array.from(document.querySelectorAll('tbody tr')).some(function(r){return r.innerText.indexOf('zhang.xiaofeng')>=0})`, 'users')
await sleep(1000)
const more = await ev(`(function(){var tr=Array.from(document.querySelectorAll('tbody tr')).find(function(r){return r.innerText.indexOf('zhang.xiaofeng')>=0});var bs=Array.from(tr.querySelectorAll('td:last-child button'));var b=bs[bs.length-1];var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
await clickPos(more.x, more.y); await sleep(1300)
const mi = await ev(`(function(){var els=Array.from(document.querySelectorAll('.v-list-item')).filter(function(x){return x.getClientRects().length>0&&x.textContent.trim()==='角色和策略'});if(!els.length)return null;var r=els[0].getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
if (!mi) throw new Error('menu missing')
await clickPos(mi.x, mi.y)
await waitFor(`(function(){var d=${DLG};return d&&d.innerText.indexOf('角色和策略')>=0})()`, 'rp dialog')
await sleep(1400)

// 1) 布局改版
const txt = await dlgText()
check('两有效期天数字段已移除', txt.indexOf('密码有效期天数') < 0 && txt.indexOf('账户有效期天数') < 0)
check('激活日期只读在场', await ev(`(function(){var d=${DLG};var t0=d.querySelectorAll('.fv-timer')[0];return t0.classList.contains('fv-timer--disabled')&&t0.querySelector('input').disabled})()`))
let T = JSON.parse(await timers())
check('激活=createdAt 兜底(2025-06-03)，到期回显 2027-06-02', T[0] === '2025-06-03' && T[1] === '2027-06-02', JSON.stringify(T))
// 2) 进页携带策略 P001 → 到期 Hint=365（且不覆盖到期值——上面已验 2027-06-02 未动）
check('进页 Hint=「策略要求账户有效期天数为 365」', (await hoverExpiryHint()).indexOf('策略要求账户有效期天数为 365') >= 0)
// 3) 切换强策略 → 到期 = 2025-06-03+180 = 2025-11-30；Hint 更新 180
await pickPolicy('强策略')
T = JSON.parse(await timers())
check('切换强策略到期重算=激活+180', T[1] === '2025-11-30', JSON.stringify(T))
check('切换后 Hint=「策略要求账户有效期天数为 180」', (await hoverExpiryHint()).indexOf('180') >= 0)
// 4) P003(-1) → 到期清空 + Hint 永不过期
await pickPolicy('合规审计策略')
T = JSON.parse(await timers())
check('P003(-1) 到期清空、Hint=永不过期', T[1] === '--' && (await hoverExpiryHint()).indexOf('策略要求账户永不过期') >= 0, JSON.stringify(T))
// 5) 清空策略 → Confirm 被必填拦截（窗不退、策略徽标）
await clearPolicy()
await clickBtn('确认')
await sleep(900)
const stillOpen = await ev(`(function(){var d=${DLG};return d&&d.innerText.indexOf('角色和策略')>=0})()`)
check('策略清空后 Confirm 拦截（必填规则修复）', stillOpen === true && (await policyBadges()) >= 1, 'badges=' + await policyBadges())
// 6) 重选标准策略 → 到期 = 2025-06-03+365 = 2026-06-03；Cancel 关窗不提交
await pickPolicy('标准策略')
T = JSON.parse(await timers())
check('重选标准策略到期=激活+365', T[1] === '2026-06-03', JSON.stringify(T))
await clickBtn('取消')
await waitFor(`(function(){return Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0}).length===0})()`, 'closed')
check('取消关窗（不提交）', true)

console.log(`\n通过 ${results.filter(Boolean).length}/${results.length}`)
process.exitCode = results.includes(false) ? 1 : 0
ws.close()
