/* UserProfileDialog → EditUserAttributeDialog 层叠编辑验证（替代行内编辑套件） */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function tp() { for (let i = 0; i < 8; i++) { try { const r = await fetch('http://127.0.0.1:9333/json/new?about:blank', { method: 'PUT' }); const j = await r.json(); if (j.webSocketDebuggerUrl) return j } catch {} await sleep(500) } throw new Error('no') }
let ws, mid = 0; const pn = new Map()
const send = (m, p = {}) => new Promise((res, rej) => { const id = ++mid; pn.set(id, { res, rej }); ws.send(JSON.stringify({ id, method: m, params: p })) })
const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: `(${e})`, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error('page: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value }
async function waitFor(expr, label, timeout = 15000) { const t0 = Date.now(); while (Date.now() - t0 < timeout) { try { if (await ev(expr)) return } catch {} await sleep(200) } throw new Error('timeout: ' + label) }
async function clickPos(x, y) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }) }
const results = []
const check = (n, ok, d = '') => { results.push(ok); console.log(`${ok ? '✅' : '❌'} ${n}${d ? ' — ' + d : ''}`) }

const visibleDlgCount = () => ev(`Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0}).length`)
const topDlgText = () => ev(`(function(){var ds=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0});var d=ds[ds.length-1];return d?d.innerText.slice(0,300):''})()`)
async function clickDlgBtn(title) {
  const pos = await ev(`(function(){var ds=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0});var d=ds[ds.length-1];if(!d)return null;var b=Array.from(d.querySelectorAll('button')).find(function(x){return x.textContent.trim()===${JSON.stringify(title)}});if(!b)return null;var r=b.getBoundingClientRect();var x=r.x+r.width/2,y=r.y+r.height/2;var h=document.elementFromPoint(x,y);return (b.contains(h)||(h&&h.contains(b)))?{x:x,y:y}:{err:'hit'}})()`)
  if (!pos || pos.err) throw new Error('clickDlgBtn ' + title + ' ' + JSON.stringify(pos))
  await clickPos(pos.x, pos.y)
}
async function setTopInput(val) {
  const r = await ev(`(function(){var ds=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0});var d=ds[ds.length-1];var inp=d.querySelector('input');if(!inp)return 'no input';var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(inp,${JSON.stringify(val)});inp.dispatchEvent(new Event('input',{bubbles:true}));return 'ok'})()`)
  if (r !== 'ok') throw new Error('setTopInput: ' + r)
}
const topInputVal = () => ev(`(function(){var ds=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0});var d=ds[ds.length-1];return d?d.querySelector('input').value:null})()`)
const topBadgeCount = () => ev(`(function(){var ds=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0});var d=ds[ds.length-1];return d.querySelectorAll('.fv-field__err-badge').length})()`)
async function openPenByLabel(rowLabel) {
  const pos = await ev(`(function(){var ds=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0});var d=ds[ds.length-1];
  var row=Array.from(d.querySelectorAll('.vui-profile__row')).find(function(r){return r.textContent.indexOf(${JSON.stringify(rowLabel)})>=0});
  var b=Array.from(row.querySelectorAll('button')).find(function(x){return (x.getAttribute('title')||'')==='编辑'});
  var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
  await clickPos(pos.x, pos.y)
  await waitFor(`(function(){var ds=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0});return ds.length===2})()`, rowLabel + ' dialog')
  await sleep(900)
}

const t = await tp()
await new Promise((res, rej) => { ws = new WebSocket(t.webSocketDebuggerUrl); ws.onopen = res; ws.onerror = rej; ws.onmessage = e2 => { const m = JSON.parse(e2.data); if (m.id && pn.has(m.id)) { const { res: r, rej: j } = pn.get(m.id); pn.delete(m.id); m.error ? j(new Error(m.error.message)) : r(m.result) } } })
await send('Runtime.enable'); await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

await send('Page.navigate', { url: 'http://localhost:5173/login' })
await waitFor(`location.host === 'localhost:5173'`, 'app origin')
await ev(`(function(){localStorage.clear();return true})()`)
await send('Page.navigate', { url: 'http://localhost:5173/login' })
await waitFor(`Array.from(document.querySelectorAll('input')).filter(function(i){return i.type==='text'||i.type==='password'}).length>=2`, 'login inputs')
await ev(`(function(){var inp=Array.from(document.querySelectorAll('input')).filter(function(i){return i.type==='text'||i.type==='password'});var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(inp[0],'admin');inp[0].dispatchEvent(new Event('input',{bubbles:true}));s.call(inp[1],'passw0rd');inp[1].dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
await sleep(500)
const lb = await ev(`(function(){var b=Array.from(document.querySelectorAll('button')).find(function(x){return x.type==='submit'});var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
await clickPos(lb.x, lb.y)
await waitFor(`location.pathname!=='/login'`, 'redirect')
await sleep(1000)

// 打开用户信息弹窗
const av = await ev(`(function(){var b=Array.from(document.querySelectorAll('header button, .vui-topbar button')).find(function(x){return x.querySelector('.v-avatar')});var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
await clickPos(av.x, av.y)
await sleep(900)
const mi = await ev(`(function(){var el=Array.from(document.querySelectorAll('.v-overlay--active .v-list-item, .v-overlay .v-list-item')).find(function(x){return x.textContent.indexOf('用户信息')>=0});if(!el)return null;var r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
await clickPos(mi.x, mi.y)
await waitFor(`Array.from(document.querySelectorAll('.vui-base-dialog')).some(function(d){return d.innerText.indexOf('用户信息')>=0})`, 'profile dialog')
await sleep(1000)
check('用户信息弹窗打开', (await visibleDlgCount()) === 1)

// 昵称 pen → 子弹窗层叠
await openPenByLabel('昵称')
const info = await topDlgText()
check('子弹窗层叠打开（两层并存）标题=昵称+回显', (await visibleDlgCount()) === 2 && info.indexOf('昵称') >= 0 && (await topInputVal()) === '系统管理员', info.split('\n')[0])

// 改昵称 → 确认 → 出栈回显 + Toast
await setTopInput('系统管理员Pro')
await sleep(300)
await clickDlgBtn('确认')
await waitFor(`(function(){return Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0}).length===1})()`, 'attr closed')
await sleep(600)
const back = await ev(`(function(){var d=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0})[0];return JSON.stringify({shown:d.innerText.indexOf('系统管理员Pro')>=0, toast:document.body.innerText.indexOf('信息已更新')>=0})})()`)
const B = JSON.parse(back)
check('Confirm 结果回显原行 + 更新 Toast + 信息弹窗未关', B.shown && B.toast, back)

// 邮箱非法 → 拦截；修正 → 成功
await openPenByLabel('邮箱')
await setTopInput('abc')
await sleep(300)
await clickDlgBtn('确认')
await sleep(800)
const blocked = await ev(`JSON.stringify({twoLayer:(function(){return Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0}).length})(), badges:(function(){var ds=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0});var d=ds[ds.length-1];return d.querySelectorAll('.fv-field__err-badge').length})()})`)
const BL = JSON.parse(blocked)
check('邮箱格式规则（EditUserDialog 同款）拦截：不退栈+错误徽标', BL.twoLayer === 2 && BL.badges >= 1, blocked)
await setTopInput('admin.new@fabcorp.example')
await sleep(300)
await clickDlgBtn('确认')
await waitFor(`(function(){return Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0}).length===1})()`, 'email saved')
await sleep(500)
check('修正邮箱 Confirm 成功回显', await ev(`(function(){var d=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0})[0];return d.innerText.indexOf('admin.new@fabcorp.example')>=0})()`))

// 电话：字母拦截；Cancel 弃稿
await openPenByLabel('电话')
await setTopInput('12a4')
await sleep(300)
await clickDlgBtn('确认')
await sleep(800)
check('电话纯数字规则拦截', (await topBadgeCount()) >= 1)
await clickDlgBtn('取消')
await waitFor(`(function(){return Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0}).length===1})()`, 'phone cancelled')
await sleep(500)
const phoneKept = await ev(`(function(){var d=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0})[0];return d.innerText.indexOf('138-0000-0001')>=0})()`)
check('Cancel 弃改动，原值保留', phoneKept === true)

// 持久化
const stored = await ev(`(function(){try{var a=JSON.parse(localStorage.getItem('vui.auth')||'{}');return JSON.stringify({nick:a.user.nickName,email:a.user.email})}catch(e){return '{}'}})()`)
const ST = JSON.parse(stored)
check('auth 持久化同步（昵称+邮箱新值）', ST.nick === '系统管理员Pro' && ST.email === 'admin.new@fabcorp.example', stored)

console.log(`\n通过 ${results.filter(Boolean).length}/${results.length}`)
process.exitCode = results.includes(false) ? 1 : 0
ws.close()
