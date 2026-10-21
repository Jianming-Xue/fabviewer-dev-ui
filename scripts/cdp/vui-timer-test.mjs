/* FvTimer hint/气泡改造 + 图标右距对齐 验证（CreateUserDialog 现场） */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const BASE = 'http://127.0.0.1:9333'
async function newPageTarget() {
  for (let i = 0; i < 8; i++) {
    try { const r = await fetch(`${BASE}/json/new?about:blank`, { method: 'PUT' }); const j = await r.json(); if (j.webSocketDebuggerUrl) return j } catch {}
    await sleep(500)
  }
  throw new Error('no ws')
}
let ws, msgId = 0
const pending = new Map()
const send = (m, p = {}) => new Promise((res, rej) => { const id = ++msgId; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method: m, params: p })) })
const evalJs = async (e) => { const r = await send('Runtime.evaluate', { expression: `(${e})`, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error('page: ' + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value }
async function waitFor(expr, label, timeout = 12000) { const t0 = Date.now(); while (Date.now() - t0 < timeout) { try { if (await evalJs(expr)) return } catch {} await sleep(200) } throw new Error('timeout: ' + label) }
async function clickPos(x, y) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }) }
const results = []
const check = (n, ok, d = '') => { results.push(ok); console.log(`${ok ? '✅' : '❌'} ${n}${d ? ' — ' + d : ''}`) }

const target = await newPageTarget()
await new Promise((res, rej) => { ws = new WebSocket(target.webSocketDebuggerUrl); ws.onopen = res; ws.onerror = rej; ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const { res: r, rej: j } = pending.get(m.id); pending.delete(m.id); m.error ? j(new Error(m.error.message)) : r(m.result) } } })
await send('Runtime.enable'); await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

await send('Page.navigate', { url: 'http://localhost:5173/login' })
await sleep(1500)
await evalJs(`(function(){localStorage.clear();return true})()`)
await send('Page.navigate', { url: 'http://localhost:5173/login' })
await waitFor(`Array.from(document.querySelectorAll('input')).filter(function(i){return i.type==='text'||i.type==='password'}).length>=2`, 'login inputs')
await evalJs(`(function(){var inp=Array.from(document.querySelectorAll('input')).filter(function(i){return i.type==='text'||i.type==='password'});var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(inp[0],'admin');inp[0].dispatchEvent(new Event('input',{bubbles:true}));s.call(inp[1],'passw0rd');inp[1].dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
await sleep(500)
const lb = await evalJs(`(function(){var b=Array.from(document.querySelectorAll('button')).find(function(x){return x.type==='submit'});var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
await clickPos(lb.x, lb.y)
await waitFor(`location.pathname!=='/login'`, 'redirect')
await send('Page.navigate', { url: 'http://localhost:5173/security/users' })
await waitFor(`!!Array.from(document.querySelectorAll('button')).find(function(b){return (b.getAttribute('aria-label')||'').indexOf('新增')>=0})`, 'users add btn')
await sleep(700)
const add = await evalJs(`(function(){var b=Array.from(document.querySelectorAll('button')).find(function(x){return (x.getAttribute('aria-label')||'').indexOf('新增')>=0});var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
await clickPos(add.x, add.y)
await waitFor(`!!document.querySelector('.fv-timer__box')`, 'create-user dialog')
await sleep(1300)

// ===== 结构：msg 行已废、hint 问号进 label、气泡就位（初始无错不显示） =====
check('底部 msg 行已移除', await evalJs(`!document.querySelector('.fv-timer__msg')`))
check('FvTimer label 带问号图标（激活/到期）', await evalJs(`document.querySelectorAll('.fv-timer__label .fv-field__hint-icon').length >= 2`))
check('初始无错误气泡', await evalJs(`!document.querySelector('.fv-timer__bubble')`))

// ===== 图标右距比对：FvTextInput 眼睛图标 vs FvTimer 时钟图标 =====
const gaps = await evalJs(`(function(){
  var eye = document.querySelector('.fv-text-input .v-field__append-inner .v-icon');
  var eyeGap = null;
  if (eye) { var ef = eye.closest('.v-field'); eyeGap = Math.round((ef.getBoundingClientRect().right - eye.getBoundingClientRect().right) * 10) / 10; }
  var clock = document.querySelector('.fv-timer__btn .v-icon');
  var clockGap = null;
  if (clock) { var box = clock.closest('.fv-timer__box'); clockGap = Math.round((box.getBoundingClientRect().right - clock.getBoundingClientRect().right) * 10) / 10; }
  var ai = eye.closest('.v-field__append-inner'); var acs = getComputedStyle(ai); var ics = getComputedStyle(eye);
  var efs=ics.fontSize, ew=ics.width, eh=ics.height, ffi=getComputedStyle(eye.closest('.v-field__field')||f0(eye));
  function f0(x){return x}
  var fldRight=eye.closest('.v-field').getBoundingClientRect().right, iconRight=eye.getBoundingClientRect().right;
  var fcs=getComputedStyle(eye.closest('.v-field')); var aiR=ai.getBoundingClientRect();
  var inner=document.querySelector('.fv-text-input .v-field__inner'); var innerTxt=inner?inner.textContent.slice(0,40):null;
  return JSON.stringify({ eyeGap: eyeGap, clockGap: clockGap, aiPadStart: acs.paddingInlineStart, aiPadEnd: acs.paddingInlineEnd, iconW: ics.width, iconH: ics.height, iconFs: ics.fontSize, gridFs: getComputedStyle(eye.closest('.v-field')).fontSize, inner: innerTxt, fieldRightMinusIconRight: Math.round((fldRight-iconRight)*10)/10, aiRightGap: Math.round((fldRight-aiR.right)*10)/10, aiW: Math.round(aiR.width), fPadEnd: fcs.paddingInlineEnd, fPadStart: fcs.paddingInlineStart, vPadEnd: fcs.getPropertyValue('--v-field-padding-end') });
})()`)
console.log('gaps:', gaps)
// eyeGap = field右缘-图标右缘；aiPadStart=--v-field-padding-after 现值
const G = JSON.parse(gaps)
check(`时钟图标右距(${G.clockGap}px)=FvTextInput 右图标右距(${G.eyeGap}px)`, G.eyeGap !== null && G.clockGap === G.eyeGap)

// ===== 悬停问号出 tooltip（激活日期 hint） =====
const q = await evalJs(`(function(){var ic=document.querySelector('.fv-timer__label .fv-field__hint-icon');var r=ic.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: q.x, y: q.y })
await sleep(1000)
check('FvTimer 问号 tooltip 出激活日期提示词', await evalJs(`document.body.innerText.indexOf('晚于今天')>=0 || document.body.innerText.indexOf('停用')>=0`))
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: q.x, y: q.y - 150 })
await sleep(500)

// ===== 内部错误 → 气泡：mode=date 三全段齐且非法（2026-13-01）才提交报错 =====
await evalJs(`(async function(){
  var segs = document.querySelectorAll('.fv-timer__seg');
  var s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  var vals = ['2026', '13', '01'];
  for (var i = 0; i < 3; i++) {
    segs[i].focus();
    s.call(segs[i], vals[i]);
    segs[i].dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(function(r){ setTimeout(r, 150) });
  }
  return true;
})()`)
await sleep(800)
const bub = await evalJs(`(function(){
  var b = document.querySelector('.fv-timer__bubble .fv-field__err-badge');
  if (!b) return null;
  var box = document.querySelectorAll('.fv-timer__box')[0].getBoundingClientRect();
  var r = b.getBoundingClientRect();
  var cs = getComputedStyle(b);
  return JSON.stringify({ bottom: Math.round(r.bottom), boxTop: Math.round(box.top), right: Math.round(r.right), boxRight: Math.round(box.right),
    size: Math.round(r.width) + 'x' + Math.round(r.height), radius: cs.borderRadius });
})()`)
const B = bub ? JSON.parse(bub) : null
check('内部错误→气球徽标（贴盒右上角/20×20 圆）', !!B && Math.abs(B.bottom - B.boxTop) <= 2 && Math.abs(B.right - B.boxRight) <= 2 && B.size === '20x20' && B.radius === '50%', bub ?? 'no badge')
if (B) {
  const bp = await evalJs(`(function(){var b=document.querySelector('.fv-timer__bubble .fv-field__err-badge');var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:bp.x,y:bp.y}); await sleep(900)
  const tip = await evalJs(`(function(){var t=Array.from(document.querySelectorAll('.vui-field-err-tip')).find(function(x){return x.getClientRects().length>0});return t?JSON.stringify({txt:t.textContent,color:getComputedStyle(t).color}):null})()`)
  const TP = tip ? JSON.parse(tip) : null
  check('FvTimer 徽标 tooltip 显错误文案（红色系）', !!TP && TP.txt.indexOf('日期格式')>=0 && (()=>{const n=(TP.color.match(/\d+/g)||[]).map(Number);return n.length>=3&&n[0]>150&&n[0]-n[1]>60})(), TP?TP.txt.slice(0,24)+' '+TP.color:'no tip')
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:bp.x,y:bp.y-150}); await sleep(300)
}

const { writeFileSync } = await import('node:fs')
const sh = await send('Page.captureScreenshot', { format: 'png' })
writeFileSync('/tmp/vui-timer-dialog.png', Buffer.from(sh.data, 'base64'))

console.log(`\n通过 ${results.filter(Boolean).length}/${results.length}`)
process.exitCode = results.includes(false) ? 1 : 0
ws.close()
