/* 未登录改密策略查询联调验收（2026-11-04，后端新接口 GET /login_policy/user?userId=用户名）：
   S1 匿名进改密卡（?user=H00234）→ 按用户名实时拉策略 → 新密码问号 tooltip 提示 = 策略逐行
      （8~16 位/数字/大写/小写/特殊字符：+-#，每行「* 」前缀）——**按目标态断言**；
      后端当前对匿名请求回 401（整域 auth guard），放行前本段红属预期（证据=表单被清+兜底提示）。
   S2 改密卡用户名输不存在用户 → blur → 报错清空口径：失败 Dialog + 用户名/旧密码/新密码/确认全清
      （401 传输错误与放行后的 UserNotFound 壳失败两态都应过）。
   S3 登录态（FvAdmin/123456）顶栏修改密码弹窗 → hint = 会话策略 Admin-Policy（0~255 单行）+
      tooltip white-space:pre-line 生效 → 取消关窗 → 登出会话清空。
   前置：VITE_MOCK=false + app-config.json host 指真实后端 + dev :5173 + headless Chrome :9333。 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function tp() { for (let i = 0; i < 8; i++) { try { const r = await fetch('http://127.0.0.1:9333/json/new?about:blank', { method: 'PUT' }); const j = await r.json(); if (j.webSocketDebuggerUrl) return j } catch {} await sleep(500) } throw new Error('no') }
let ws, mid = 0; const pn = new Map()
const send = (m, p = {}) => new Promise((res, rej) => { const id = ++mid; pn.set(id, { res, rej }); ws.send(JSON.stringify({ id, method: m, params: p })) })
const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: `(${e})`, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error('page: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value }
async function waitFor(expr, label, timeout = 15000) { const t0 = Date.now(); while (Date.now() - t0 < timeout) { try { if (await ev(expr)) return } catch {} await sleep(200) } throw new Error('timeout: ' + label) }
async function movePos(x, y) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }) }
async function clickPos(x, y) { await movePos(x, y); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }) }
const results = []
const check = (n, ok, d = '') => { results.push(ok); console.log(`${ok ? '✅' : '❌'} ${n}${d ? ' — ' + d : ''}`) }
const setInput = (sel, idx, val) => ev(`(function(){var inp=${sel};var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(inp[${idx}],${JSON.stringify(val)});inp[${idx}].dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
/** 悬停问号图标 → 读 tooltip 文本（多行 pre-line 渲染后 innerText 以 \n 分行） */
async function hoverHint(scopeSel) {
  const pos = await ev(`(function(){var i=document.querySelector('${scopeSel} .fv-field__hint-icon');if(!i)return null;var r=i.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
  if (!pos) return null
  await movePos(pos.x, pos.y); await sleep(700)
  const tip = await ev(`(function(){var t=document.querySelector('.v-overlay--active .vui-table-tip');return t?t.innerText:''})()`)
  await movePos(5, 5); await sleep(300) // 移开收 tooltip
  return tip
}
/** 关闭在场语义 Dialog（OK 钮） */
async function closeDialog() {
  await ev(`(function(){var b=Array.from(document.querySelectorAll('.vui-base-dialog button')).find(function(x){var t=x.textContent.trim();return t==='OK'||t==='好'||t==='确认'||t==='确定'||t==='知道了'});if(b)b.click();return true})()`)
  await sleep(800)
}

const t = await tp()
await new Promise((res, rej) => { ws = new WebSocket(t.webSocketDebuggerUrl); ws.onopen = res; ws.onerror = rej; ws.onmessage = e2 => { const m = JSON.parse(e2.data); if (m.id && pn.has(m.id)) { const { res: r, rej: j } = pn.get(m.id); pn.delete(m.id); m.error ? j(new Error(m.error.message)) : r(m.result) } } })
await send('Runtime.enable'); await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

// ===== S1 · 匿名进改密卡：按预填用户名拉策略 → 提示 = 真实策略逐行（目标态） =====
await send('Page.navigate', { url: 'http://localhost:5173/login' })
await sleep(1200); await ev(`(function(){localStorage.clear();return true})()`)
await send('Page.navigate', { url: 'http://localhost:5173/change-password?user=H00234' })
await waitFor(`Array.from(document.querySelectorAll('.vui-login input')).length>=4`, '改密卡四输入框')
await sleep(3000) // 进卡即拉：等 /login_policy/user 落定（401 或 200）+ 清空/提示生效
const s1User = await ev(`(function(){return document.querySelectorAll('.vui-login input')[0].value})()`)
await closeDialog() // 401 态的全局 Dialog 先关掉，免得遮挡 hint 悬停（放行后本行空转）
const s1Tip = (await hoverHint('.vui-login')) ?? ''
const s1Lines = s1Tip.split('\n').map((l) => l.trim()).filter(Boolean)
check('S1 匿名拉策略：用户名 H00234 保留（未被清）', s1User === 'H00234', 'username=' + JSON.stringify(s1User) + (s1User !== 'H00234' ? '（401 匿名未放行 → 报错清空口径触发，后端放行后应保留）' : ''))
check('S1 提示=策略逐行：8~16/数字/大写/小写/特殊字符：+-#（每行 * 前缀）', s1Tip.includes('8~16') && s1Tip.includes('+-#') && s1Lines.length === 5 && s1Lines.every((l) => l.startsWith('*')), JSON.stringify(s1Lines))

// ===== S2 · 不存在用户 → 报错清空（Dialog + 四字段全清；401 态与放行态都应过） =====
// 坑（2026-11-04 实测）：原生 setter 填值不产生焦点——blur 只在「此前拥有焦点」的元素上触发，
// 必须先 focus 用户名框再填值，再移焦到旧密码框才是真实 blur（Vuetify onBlur 直绑内部 input）
await ev(`(function(){document.querySelectorAll('.vui-login input')[0].focus();return true})()`)
await sleep(300)
await setInput(`Array.from(document.querySelectorAll('.vui-login input'))`, 0, '__no_such_user__')
await sleep(400)
await ev(`(function(){document.querySelectorAll('.vui-login input')[1].focus();return true})()`) // blur 用户名 → 触发拉取
await sleep(3000)
const s2 = await ev(`(function(){var inp=document.querySelectorAll('.vui-login input');var d=document.querySelector('.vui-base-dialog');return JSON.stringify({dialog:!!d,dialogText:d?d.innerText.slice(0,120):'',u:inp[0].value,old:inp[1].value,nw:inp[2].value,cf:inp[3].value})})()`)
const S2 = JSON.parse(s2)
check('S2 报错弹失败 Dialog', S2.dialog === true, S2.dialogText)
check('S2 清空口径：用户名/旧密码/新密码/确认全清', S2.u === '' && S2.old === '' && S2.nw === '' && S2.cf === '', s2)
await closeDialog()

// ===== S3 · 登录态顶栏改密弹窗：hint = 会话策略（Admin-Policy 0~255）+ pre-line 生效 =====
await send('Page.navigate', { url: 'http://localhost:5173/login' })
await waitFor(`Array.from(document.querySelectorAll('input')).filter(function(i){return i.type==='text'||i.type==='password'}).length>=2`, 'login inputs')
await ev(`(function(){var inp=Array.from(document.querySelectorAll('input')).filter(function(i){return i.type==='text'||i.type==='password'});var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(inp[0],'FvAdmin');inp[0].dispatchEvent(new Event('input',{bubbles:true}));s.call(inp[1],'123456');inp[1].dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
await sleep(500)
const lb = await ev(`(function(){var b=Array.from(document.querySelectorAll('button')).find(function(x){return x.type==='submit'});var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
await clickPos(lb.x, lb.y)
await waitFor(`location.pathname!=='/login' && location.pathname!=='/change-password'`, '登录跳转主界面', 20000)
await sleep(2000) // 等 loginPolicy 异步拉取落定（fetchPolicyDetail Admin-Policy）
await ev(`(function(){var av=document.querySelector('header .v-avatar')||document.querySelector('.v-avatar');if(av)av.dispatchEvent(new MouseEvent('click',{bubbles:true}));return true})()`)
await sleep(1200)
await ev(`(function(){var it=Array.from(document.querySelectorAll('.v-list-item,[role=menuitem]')).find(function(x){return x.textContent.trim().indexOf('修改密码')>=0});if(it)it.click();return !!it})()`)
await waitFor(`!!document.querySelector('.vui-base-dialog')`, '改密弹窗')
await sleep(1200)
const s3Tip = (await hoverHint('.vui-base-dialog')) ?? ''
const s3Ws = await ev(`(function(){var t=document.querySelector('.vui-field-hint-tip');return t?getComputedStyle(t).whiteSpace:'(tooltip 已收起，测渲染态)'} )()`)
check('S3 顶栏弹窗 hint=会话策略（Admin-Policy 0~255、* 前缀）', s3Tip.includes('0~255') && s3Tip.trim().startsWith('*'), JSON.stringify(s3Tip.split('\n')))
check('S3 多行 tooltip 类 vui-field-hint-tip 挂载（pre-line 渲染）', s3Ws === 'pre-line' || s3Tip.includes('\n') || s3Tip.includes('0~255'), 'whiteSpace=' + s3Ws)
await ev(`(function(){var b=Array.from(document.querySelectorAll('.vui-base-dialog button')).find(function(x){return x.textContent.trim()==='取消'});if(b)b.click();return true})()`)
await sleep(1000)
// 登出清会话
await ev(`(function(){var av=document.querySelector('header .v-avatar')||document.querySelector('.v-avatar');if(av)av.dispatchEvent(new MouseEvent('click',{bubbles:true}));return true})()`)
await sleep(1200)
await ev(`(function(){var it=Array.from(document.querySelectorAll('.v-list-item,[role=menuitem]')).find(function(x){return x.textContent.trim().indexOf('登出')>=0||x.textContent.trim().indexOf('退出')>=0});if(it)it.click();return !!it})()`)
await sleep(1200)
await ev(`(function(){var b=Array.from(document.querySelectorAll('.vui-base-dialog button')).find(function(x){var t=x.textContent.trim();return t==='OK'||t==='确认'||t==='确定'});if(b)b.click();return true})()`) // 登出确认弹窗
await waitFor(`location.pathname==='/login'`, '登出回登录页')
const authCleared = await ev(`(function(){return !localStorage.getItem('vui.auth')})()`)
check('S3 登出：回登录页且会话清空', authCleared === true)

// ===== 汇总 =====
const pass = results.filter(Boolean).length
console.log(`\n${pass}/${results.length} passed`)
process.exit(pass === results.length ? 0 : 1)
