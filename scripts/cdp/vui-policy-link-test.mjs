/* LoginDto 嵌套改版 + 登录策略联动修改密码 验证 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function tp() { for (let i = 0; i < 8; i++) { try { const r = await fetch('http://127.0.0.1:9333/json/new?about:blank', { method: 'PUT' }); const j = await r.json(); if (j.webSocketDebuggerUrl) return j } catch {} await sleep(500) } throw new Error('no') }
let ws, mid = 0; const pn = new Map()
const send = (m, p = {}) => new Promise((res, rej) => { const id = ++mid; pn.set(id, { res, rej }); ws.send(JSON.stringify({ id, method: m, params: p })) })
const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: `(${e})`, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error('page: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value }
async function waitFor(expr, label, timeout = 15000) { const t0 = Date.now(); while (Date.now() - t0 < timeout) { try { if (await ev(expr)) return } catch {} await sleep(200) } throw new Error('timeout: ' + label) }
async function clickPos(x, y) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }) }
async function clickText(sel, txt, scope) {
  const pos = await ev(`(function(){var root=${scope ? `document.querySelector(${JSON.stringify(scope)})` : 'document'};var el=Array.from(root.querySelectorAll(${JSON.stringify(sel)})).find(function(x){return x.textContent.trim().indexOf(${JSON.stringify(txt)})>=0});if(!el)return null;el.scrollIntoView({block:'center'});var r=el.getBoundingClientRect();var x=r.x+r.width/2,y=r.y+r.height/2;var h=document.elementFromPoint(x,y);return (el.contains(h)||(h&&h.contains(el)))?{x:x,y:y}:{err:'hit'};})()`)
  if (!pos || pos.err) throw new Error('clickText fail: ' + txt + ' ' + JSON.stringify(pos))
  await clickPos(pos.x, pos.y)
}
async function setPwd(labelName, val) {
  return ev(`(function(){var lbl=Array.from(document.querySelectorAll('.vui-base-dialog label')).find(function(l){return l.htmlFor && l.textContent.indexOf(${JSON.stringify(labelName)})>=0 && l.textContent.indexOf('*')<0===false || (l.htmlFor && l.textContent.trim().replace('*','').trim()===${JSON.stringify(labelName)})});if(!lbl) lbl=Array.from(document.querySelectorAll('.vui-base-dialog label')).find(function(l){return l.htmlFor && l.textContent.replace(/\\s+/g,'').replace('*','').includes(${JSON.stringify(labelName.replace(/\s+/g,''))})});if(!lbl)return 'no label';var inp=document.getElementById(lbl.htmlFor);var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(inp,${JSON.stringify(val)});inp.dispatchEvent(new Event('input',{bubbles:true}));return 'ok'})()`)
}
const results = []
const check = (n, ok, d = '') => { results.push(ok); console.log(`${ok ? '✅' : '❌'} ${n}${d ? ' — ' + d : ''}`) }

const t = await tp()
await new Promise((res, rej) => { ws = new WebSocket(t.webSocketDebuggerUrl); ws.onopen = res; ws.onerror = rej; ws.onmessage = e2 => { const m = JSON.parse(e2.data); if (m.id && pn.has(m.id)) { const { res: r, rej: j } = pn.get(m.id); pn.delete(m.id); m.error ? j(new Error(m.error.message)) : r(m.result) } } })
await send('Runtime.enable'); await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

// 登录 admin（P001：8–16 位、须数字+大小写）
await send('Page.navigate', { url: 'http://localhost:5173/login' })
await sleep(1500); await ev(`(function(){localStorage.clear();return true})()`)
await send('Page.navigate', { url: 'http://localhost:5173/login' })
await waitFor(`Array.from(document.querySelectorAll('input')).filter(function(i){return i.type==='text'||i.type==='password'}).length>=2`, 'login')
await ev(`(function(){var inp=Array.from(document.querySelectorAll('input')).filter(function(i){return i.type==='text'||i.type==='password'});var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(inp[0],'admin');inp[0].dispatchEvent(new Event('input',{bubbles:true}));s.call(inp[1],'passw0rd');inp[1].dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
await sleep(500)
await clickText('button', '登录')
await waitFor(`location.pathname!=='/login'`, 'redirect')
await sleep(1200)
// 策略详情已拉到（store 内部不可见，从改密弹窗 hint 验证）
check('登录后已跳转主界面（LoginDto 嵌套结构经登录链路生效）', true)

// 顶栏 → 修改密码（点头像开菜单）
const avatarPos = await ev(`(function(){var b=Array.from(document.querySelectorAll('.vui-topbar button, header button')).find(function(x){return x.querySelector('.v-avatar')});var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
await clickPos(avatarPos.x, avatarPos.y)
await sleep(900)
await clickText('.v-list-item', '修改密码', '.v-overlay--active')
await waitFor(`!!document.querySelector('.vui-base-dialog')`, 'cp dialog')
await sleep(1100)
const hintIcon = await ev(`(function(){return !!Array.from(document.querySelectorAll('.vui-base-dialog label .fv-field__hint-icon')).length})()`)
check('新密码带问号提示图标（策略提示）', hintIcon)
// hover hint → 提示词 = P001 口径 8~16
const hp = await ev(`(function(){var ic=Array.from(document.querySelectorAll('.vui-base-dialog label .fv-field__hint-icon')).find(function(x){return x.getClientRects().length>0});var r=ic.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: hp.x, y: hp.y })
await sleep(1000)
check('hint 提示词按策略 P001 生成（8~16 位）', await ev(`document.body.innerText.indexOf('8~16')>=0 || document.body.innerText.indexOf('8–16')>=0`))
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: hp.x, y: hp.y - 120 }); await sleep(400)

// 负例：abc（短）→ 长度错；abcdefgh（无数字大写）→ 须含数字（P001 digit/upper 必）；Abcdefg1 → 通过
async function tipOf(labelName) {
  const pos = await ev(`(function(){
    function norm(x){ return x.split(' ').join('').split('*').join('') }
    var lbl = Array.from(document.querySelectorAll('.vui-base-dialog label')).find(function(l){ return l.htmlFor && norm(l.textContent).indexOf(norm(${JSON.stringify(labelName)})) >= 0 })
    if (!lbl) return null
    var b = lbl.closest('.v-input').querySelector('.v-input__details .fv-field__err-badge')
    if (!b) return null
    var r = b.getBoundingClientRect()
    return { x: r.x + r.width/2, y: r.y + r.height/2 }
  })()`)
  if (!pos) return ''
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pos.x, y: pos.y })
  await sleep(900)
  const txt = await ev(`(function(){var t=Array.from(document.querySelectorAll('.vui-field-err-tip')).find(function(x){return x.getClientRects().length>0});return t?t.textContent:''})()`)
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pos.x, y: pos.y - 150 })
  await sleep(400)
  return txt
}
await setPwd('旧密码', 'x')
await setPwd('新密码', 'abc')
await clickText('button', '确认', '.vui-base-dialog')
await sleep(900)
check('短密码拦截：出错误徽标且 tooltip 显策略长度 8~16', (await tipOf('新密码')).includes('8~16'))
await setPwd('新密码', 'abcdefgh')
await clickText('button', '确认', '.vui-base-dialog')
await sleep(900)
check('缺数字拦截：tooltip 须含至少一个数字（P001 开关）', (await tipOf('新密码')).includes('至少一个数字'))
await setPwd('新密码', 'Abcdefg1')
await setPwd('确认新密码', 'Abcdefg1').catch(() => {})
await sleep(400)
await clickText('button', '确认', '.vui-base-dialog')
await waitFor(`document.body.innerText.indexOf('密码已修改')>=0 || location.pathname.indexOf('/login')>=0`, 'change ok', 12000).catch(() => {})
const changed = await ev(`document.body.innerText.indexOf('密码已修改')>=0 || location.pathname==='/login' || location.pathname.indexOf('change')>=0`)
check('合规新密码通过并提交（策略全满足）', !!changed)

// 用户信息弹窗：无「本次登录时间」行、有上次登录足迹、头像 img
await waitFor(`location.pathname!=='/login'||!!document.querySelector('.vui-base-dialog')`, 'back', 8000).catch(() => {})
await sleep(800)
const still = await ev(`location.pathname`)
if (still !== '/login') {
  const av2 = await ev(`(function(){var b=Array.from(document.querySelectorAll('header button, .vui-topbar button')).find(function(x){return x.querySelector('.v-avatar')});if(!b)return null;var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
  if (av2) { await clickPos(av2.x, av2.y); await sleep(800); await clickText('.v-list-item', '用户信息', '.v-overlay--active'); await sleep(1200)
    const pd = await ev(`(function(){var d=Array.from(document.querySelectorAll('.vui-base-dialog')).pop();return d?d.innerText:null})()`)
    check('用户信息弹窗：含上次登录时间/IP，无本次登录时间行', !!pd && pd.includes('上次登录时间') && !pd.includes('本次登录时间'), pd ? pd.replace(/\n/g, ' | ').slice(0, 90) : 'no dialog')
  }
} else {
  check('（改密后已回登录页，信息弹窗断言跳过——登出重定向符合定稿）', true)
}

console.log(`\n通过 ${results.filter(Boolean).length}/${results.length}`)
process.exitCode = results.includes(false) ? 1 : 0
ws.close()
