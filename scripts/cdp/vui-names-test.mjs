/* 名称字典制验证：用户表 ID→Name 展示、角色和策略弹窗回显/下拉刷新清理 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function tp() { for (let i = 0; i < 8; i++) { try { const r = await fetch('http://127.0.0.1:9333/json/new?about:blank', { method: 'PUT' }); const j = await r.json(); if (j.webSocketDebuggerUrl) return j } catch {} await sleep(500) } throw new Error('no') }
let ws, mid = 0; const pn = new Map()
const send = (m, p = {}) => new Promise((res, rej) => { const id = ++mid; pn.set(id, { res, rej }); ws.send(JSON.stringify({ id, method: m, params: p })) })
const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: `(${e})`, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error('page: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value }
async function waitFor(expr, label, timeout = 15000) { const t0 = Date.now(); while (Date.now() - t0 < timeout) { try { if (await ev(expr)) return } catch {} await sleep(200) } throw new Error('timeout: ' + label) }
async function clickPos(x, y) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }) }
const results = []
const check = (n, ok, d = '') => { results.push(ok); console.log(`${ok ? '✅' : '❌'} ${n}${d ? ' — ' + d : ''}`) }

const t = await tp()
await new Promise((res, rej) => { ws = new WebSocket(t.webSocketDebuggerUrl); ws.onopen = res; ws.onerror = rej; ws.onmessage = e2 => { const m = JSON.parse(e2.data); if (m.id && pn.has(m.id)) { const { res: r, rej: j } = pn.get(m.id); pn.delete(m.id); m.error ? j(new Error(m.error.message)) : r(m.result) } } })
await send('Runtime.enable'); await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

await send('Page.navigate', { url: 'http://localhost:5173/login' })
await sleep(1500); await ev(`(function(){localStorage.clear();return true})()`)
await send('Page.navigate', { url: 'http://localhost:5173/login' })
await waitFor(`Array.from(document.querySelectorAll('input')).filter(function(i){return i.type==='text'||i.type==='password'}).length>=2`, 'login inputs')
await ev(`(function(){var inp=Array.from(document.querySelectorAll('input')).filter(function(i){return i.type==='text'||i.type==='password'});var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(inp[0],'admin');inp[0].dispatchEvent(new Event('input',{bubbles:true}));s.call(inp[1],'passw0rd');inp[1].dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
await sleep(500)
const lb = await ev(`(function(){var b=Array.from(document.querySelectorAll('button')).find(function(x){return x.type==='submit'});var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
await clickPos(lb.x, lb.y)
await waitFor(`location.pathname!=='/login'`, 'redirect')

// ===== 用户表格：名称展示、无裸 ID =====
await send('Page.navigate', { url: 'http://localhost:5173/security/users' })
await waitFor(`document.body.innerText.indexOf('zhang.xiaofeng')>=0`, 'users rows')
await sleep(1200)
const tb = await ev(`document.querySelector('tbody').innerText`)
check('表内角色列显示名称（系统管理员/运维工程师）', tb.includes('系统管理员') && tb.includes('运维工程师'))
check('表内无裸角色 ID 泄漏（ADMIN/OPR-ENGINEER 不出现在行里）', !tb.includes('OPR-ENGINEER') && !/\bADMIN\b/.test(tb))
check('表内策略列显示名称（标准策略/强策略）', tb.includes('标准策略') && tb.includes('强策略'))
check('表内无裸策略 ID（P001/P002 不出现）', !tb.includes('P001') && !tb.includes('P002'))
check('有效期天数 -1 行显「不限」且无裸 -1 单元格', tb.includes('不限') && !/(^|[\t\n])-1([\t\n]|$)/.test(tb), tb.split('\n').find(function(r){return r.indexOf('admin')>=0})||'')

// ===== 内置 ADMIN 用户保护（2026-10-21）：more 菜单 角色和策略/删除用户 置灰 =====
const admMore = await ev(`(function(){var tr=Array.from(document.querySelectorAll('tbody tr')).find(function(r){return r.innerText.indexOf('admin')>=0});var bs=Array.from(tr.querySelectorAll('td:last-child button'));var b=bs[bs.length-1];var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
await clickPos(admMore.x, admMore.y)
await sleep(1200)
const disMap = await ev(`(function(){var els=Array.from(document.querySelectorAll('.v-overlay--active .v-list-item, .v-overlay .v-list-item')).filter(function(x){return x.getClientRects().length>0});var m={};els.forEach(function(x){var t=x.textContent.trim();if(t==='角色和策略'||t==='删除用户'||t==='重置密码')m[t]=(x.className.indexOf('disabled')>=0)||x.getAttribute('aria-disabled')==='true'});return JSON.stringify(m)})()`)
const DM = JSON.parse(disMap)
check('内置 ADMIN 用户行：角色和策略/删除用户置灰、重置密码可用', DM['角色和策略']===true && DM['删除用户']===true && DM['重置密码']===false, disMap)
await clickPos(700, 300) // 点空白关菜单
await sleep(700)

// ===== More→角色和策略：chips 按 ID 显名、点开下拉数据源= name/list =====
const morePos = await ev(`(function(){
  var tr=Array.from(document.querySelectorAll('tbody tr')).find(function(r){return r.innerText.indexOf('zhang.xiaofeng')>=0});
  var bs=Array.from(tr.querySelectorAll('td:last-child button')); var b=bs[bs.length-1];
  var r=b.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};
})()`)
await clickPos(morePos.x, morePos.y)
await waitFor(`document.body.innerText.indexOf('角色和策略')>=0`, 'more menu')
await sleep(300)
await ev(`(function(){var it=Array.from(document.querySelectorAll('.v-list-item,button, [role="menuitem"]')).find(function(x){return x.textContent.trim()==='角色和策略'});it.click();return true})()`)
await waitFor(`!!document.querySelector('.vui-base-dialog')`, 'rp dialog')
await sleep(1200)
const dlgTxt = await ev(`document.querySelector('.vui-base-dialog').innerText`)
check('弹窗角色 chips 显名称（运维工程师）', dlgTxt.includes('运维工程师'))
check('弹窗策略未开下拉即按 ID 显名（标准策略）', dlgTxt.includes('标准策略'))
check('弹窗内无裸 ID（OPR-ENGINEER/P001 不显示）', !dlgTxt.includes('OPR-ENGINEER') && !dlgTxt.includes('P001'))

// 注入 fetch 观测钩子（location 换页清页仍稳；vite 重启后 mock 内核模块身份不变）
await ev(`(function(){ if(!window.__np){ window.__np=[]; var f=window.fetch; window.fetch=function(u,o){ try{window.__np.push(String(u)+' '+(o&&o.method||'GET'))}catch(e){} return f.apply(this,arguments) } } return true })()`)
// 点开角色下拉→菜单项应为名称字典全量
const roleField = await ev(`(function(){
  var lbl=Array.from(document.querySelectorAll('.vui-base-dialog label')).find(function(l){return l.htmlFor && l.textContent.indexOf('角色')>=0 && document.getElementById(l.htmlFor)});
  var el=document.getElementById(lbl.htmlFor); var r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};
})()`)
await clickPos(roleField.x, roleField.y)
await sleep(1400)
const menuTxt = await ev(`(function(){var c=Array.from(document.querySelectorAll('.v-select__content')).find(function(x){return x.getClientRects().length>0});return c?c.innerText:null})()`)
check('角色下拉打开=名称字典（含 系统管理员/审计角色 等）', !!menuTxt && menuTxt.includes('系统管理员') && menuTxt.includes('审计角色'), menuTxt ? menuTxt.replace(/\n/g, '|').slice(0, 60) : 'no menu')
// 注：下拉条数不作断言——Vuetify 4 select 浮层虚拟化（DOM 行数≠已加载数，HANDOVER §三既定坑）。
// 字典制证据链=「未开下拉 chips 即按 ID 显名」（旧分页反查机制做不到）+ 上屏菜单内容含字典全集特征

// 关下拉再关弹窗（取消钮）
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: roleField.x, y: roleField.y, button: 'left', clickCount: 1 })
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: roleField.x, y: roleField.y, button: 'left', clickCount: 1 })
await sleep(500)
await ev(`(function(){var b=Array.from(document.querySelectorAll('.vui-base-dialog button')).find(function(x){return x.textContent.trim()==='取消'});b&&b.click();return true})()`)
await sleep(900)
check('弹窗已关闭', await ev(`!document.querySelector('.vui-base-dialog')`))

console.log(`\n通过 ${results.filter(Boolean).length}/${results.length}`)
process.exitCode = results.includes(false) ? 1 : 0
ws.close()
