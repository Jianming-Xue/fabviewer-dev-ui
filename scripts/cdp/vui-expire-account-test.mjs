/* ChangeAccountDateDialog 账户延期验证（2026-10-21）：起点计算/永不过期/无策略禁用/菜单 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function tp() { for (let i = 0; i < 8; i++) { try { const r = await fetch('http://127.0.0.1:9333/json/new?about:blank', { method: 'PUT' }); const j = await r.json(); if (j.webSocketDebuggerUrl) return j } catch {} await sleep(500) } throw new Error('no') }
let ws, mid = 0; const pn = new Map()
const send = (m, p = {}) => new Promise((res, rej) => { const id = ++mid; pn.set(id, { res, rej }); ws.send(JSON.stringify({ id, method: m, params: p })) })
const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: `(${e})`, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error('page: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value }
async function waitFor(expr, label, timeout = 15000) { const t0 = Date.now(); while (Date.now() - t0 < timeout) { try { if (await ev(expr)) return } catch {} await sleep(200) } throw new Error('timeout: ' + label) }
async function clickPos(x, y) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }) }
const results = []
const check = (n, ok, d = '') => { results.push(ok); console.log(`${ok ? '✅' : '❌'} ${n}${d ? ' — ' + d : ''}`) }
const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const TODAY = fmt(new Date())
const addDays = (base, n) => { const [y, m, d] = base.split('-').map(Number); const dt = new Date(y, m - 1, d); dt.setDate(dt.getDate() + n); return fmt(dt) }
const DLG = `(function(){var ds=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0});return ds[ds.length-1]})()`
async function openMoreItem(userName, itemText) {
  const m = await ev(`(function(){var tr=Array.from(document.querySelectorAll('tbody tr')).find(function(r){return r.innerText.indexOf(${JSON.stringify(userName)})>=0});if(!tr)return null;var bs=Array.from(tr.querySelectorAll('td:last-child button'));var b=bs[bs.length-1];var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
  if (!m) throw new Error('row ' + userName)
  await clickPos(m.x, m.y); await sleep(1200)
  const it = await ev(`(function(){var els=Array.from(document.querySelectorAll('.v-list-item')).filter(function(x){return x.getClientRects().length>0&&x.textContent.trim()===${JSON.stringify(itemText)}});if(!els.length)return null;var r=els[0].getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
  if (!it) throw new Error('menu item ' + itemText)
  await clickPos(it.x, it.y)
  await waitFor(`(function(){var d=${DLG};return d&&d.innerText.indexOf('账户延期')>=0})()`, 'dialog ' + userName)
  await sleep(1200)
}
const dlgVal = (label) => ev(`(function(){var d=${DLG};var l=Array.from(d.querySelectorAll('label')).find(function(x){return x.textContent.replace(/[*\\s]/g,'')===${JSON.stringify(label)}&&x.htmlFor});return l?document.getElementById(l.htmlFor).value:null})()`)
const dlgNote = () => ev(`(function(){var d=${DLG};var n=d.querySelector('.vui-expire__note');return n?n.textContent:''})()`)
async function clickDlgBtn(title, expectDisabled) {
  const p = await ev(`(function(){var d=${DLG};var b=Array.from(d.querySelectorAll('button')).find(function(x){return x.textContent.trim()===${JSON.stringify(title)}});if(!b)return null;var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,dis:b.disabled}})()`)
  if (!p) throw new Error('btn ' + title)
  if (p.dis) { if (!expectDisabled) throw new Error('unexpected disabled'); return false }
  await clickPos(p.x, p.y); return true
}
async function closeDlg() { await clickDlgBtn('取消'); await waitFor(`Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0}).length===0`, 'closed') }
const rowText = (u) => ev(`(function(){var tr=Array.from(document.querySelectorAll('tbody tr')).find(function(r){return r.innerText.indexOf(${JSON.stringify(u)})>=0});return tr?tr.innerText:''})()`)

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

// ===== ① 未来到期：起点=当前到期（zhang 2027-06-02，P001 365 天）=====
await openMoreItem('zhang.xiaofeng', '账户延期')
check('①说明=「延期起点为 2027-06-02」', (await dlgNote()).indexOf('延期起点为 2027-06-02') >= 0, await dlgNote())
check('①三行值（当前 2027-06-02 / 365 天 / 新 2028-06-01）',
  (await dlgVal('当前到期日期')) === '2027-06-02' && (await dlgVal('账户有效天数')) === '365' && (await dlgVal('新的到期日期')) === addDays('2027-06-02', 365),
  await dlgVal('新的到期日期'))
await clickDlgBtn('确认')
await waitFor(`document.body.innerText.indexOf('账户已延期')>=0`, 'toast1')
await sleep(900)
check('①提交后到期列更新', (await rowText('zhang.xiaofeng')).indexOf(addDays('2027-06-02', 365)) >= 0)

// ===== ② 已过期：起点=今天（wang 2026-10-01 ≤ 今天）=====
await openMoreItem('wang.jianguo', '账户延期')
check('②说明=「延期起点为 今天」', (await dlgNote()).indexOf(`延期起点为 ${TODAY}`) >= 0, await dlgNote())
check('②新到期=今天+365', (await dlgVal('新的到期日期')) === addDays(TODAY, 365), await dlgVal('新的到期日期'))
await closeDlg()

// ===== ③ 无策略：不可延期，Confirm 禁用（li.na）=====
await openMoreItem('li.na', '账户延期')
check('③无策略说明 + 天数/新到期占位', (await dlgNote()).indexOf('无法延期') >= 0 && (await dlgVal('账户有效天数')) === '—')
const dis = await clickDlgBtn('确认', true)
check('③Confirm 禁用不可提交', dis === false)
await closeDlg()

// ===== ④ 策略 -1：永不到期（zhou → P003）=====
await openMoreItem('zhou.yajing', '账户延期')
check('④说明=「账户将设定为永不到期」+ 天数=不限 + 新=永不过期',
  (await dlgNote()).indexOf('永不到期') >= 0 && (await dlgVal('账户有效天数')) === '不限' && (await dlgVal('新的到期日期')) === '永不过期',
  await dlgNote())
await clickDlgBtn('确认')
await waitFor(`document.body.innerText.indexOf('账户已延期')>=0`, 'toast4')
await sleep(900)
check('④提交后到期列=永不过期', (await rowText('zhou.yajing')).indexOf('永不过期') >= 0)

console.log(`\n通过 ${results.filter(Boolean).length}/${results.length}`)
process.exitCode = results.includes(false) ? 1 : 0
ws.close()
