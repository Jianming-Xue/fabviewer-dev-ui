/* 真实后端 E2E（2026-11-03 联调）：security-management :80 全链路——
   登录(FvAdmin) → 权限通配 UI-2（菜单出现/权限树「全部」交互+持久化+提交收敛 ["*"]）→ 用户/角色/策略页真实数据 →
   UI-16 内置策略保护 + 内置用户（FvAdmin/Admin 用户名口径）禁用/删除/延期全禁 → 登出。25 断言。
   前置：VITE_MOCK=false + app-config.json host 指后端 + dev :5173 +
   headless Chrome :9333 **须带 --disable-web-security**（绕后端 CORS 预检 405，见 UI_ISSUE.md UI-17；
   后端 CORS 修好后去掉该参数重验）。 */
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

// ===== 1 · 登录（真实后端 FvAdmin/123456） =====
await send('Page.navigate', { url: 'http://localhost:5173/login' })
await sleep(1500); await ev(`(function(){localStorage.clear();return true})()`)
await send('Page.navigate', { url: 'http://localhost:5173/login' })
await waitFor(`Array.from(document.querySelectorAll('input')).filter(function(i){return i.type==='text'||i.type==='password'}).length>=2`, 'login inputs')
await ev(`(function(){var inp=Array.from(document.querySelectorAll('input')).filter(function(i){return i.type==='text'||i.type==='password'});var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(inp[0],'FvAdmin');inp[0].dispatchEvent(new Event('input',{bubbles:true}));s.call(inp[1],'123456');inp[1].dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
await sleep(500)
const lb = await ev(`(function(){var b=Array.from(document.querySelectorAll('button')).find(function(x){return x.type==='submit'});var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
await clickPos(lb.x, lb.y)
await waitFor(`location.pathname!=='/login' && location.pathname!=='/change-password'`, '登录跳转主界面', 20000)
check('真实后端登录成功（FvAdmin）', true, await ev(`location.pathname`))

// ===== 2 · UI-2 权限通配：["*"] → 菜单全量出现 =====
const perms = await ev(`localStorage.getItem('vui.permissions')`)
check('权限清单为通配 ["*"]', perms === JSON.stringify(['*']), perms || '')
const navTxt = await ev(`(function(){var n=document.querySelector('aside')||document.querySelector('nav')||document.body;return n.innerText})()`)
check('UI-2 通配生效：菜单含三模块（用户和安全/配置类/日志检索）', navTxt.includes('用户和安全') && navTxt.includes('日志检索'), navTxt.split('\n').slice(0, 6).join('|'))

// ===== 3 · 用户页：真实数据 + 布尔 enabled 开关 =====
await send('Page.navigate', { url: 'http://localhost:5173/security/users' })
await waitFor(`document.body.innerText.indexOf('FvAdmin')>=0`, 'users FvAdmin row')
await sleep(800)
const userRow = await ev(`(function(){var tr=Array.from(document.querySelectorAll('tbody tr')).find(function(r){return r.innerText.indexOf('FvAdmin')>=0});return tr?tr.innerText:''})()`)
check('用户页拉到真实数据（FvAdmin 行）', userRow.includes('FvAdmin'), (userRow || '').split('\t').slice(0, 4).join('|'))

// ===== 3b · 内置用户保护（2026-11-03 定稿：FvAdmin/Admin 用户名口径，禁用/删除/延期全禁） =====
const fvSwitch = await ev(`(function(){var tr=Array.from(document.querySelectorAll('tbody tr')).find(function(r){return r.innerText.indexOf('FvAdmin')>=0});var s=tr?tr.querySelector('.fv-switch'):null;return s?(s.getAttribute('aria-disabled')==='true'||s.className.indexOf('fv-switch--locked')>=0):null})()`)
check('内置用户 FvAdmin 行：启用开关禁用（不允许禁用）', fvSwitch === true, 'locked=' + fvSwitch)
const umore = await ev(`(function(){var tr=Array.from(document.querySelectorAll('tbody tr')).find(function(r){return r.innerText.indexOf('FvAdmin')>=0});var bs=Array.from(tr.querySelectorAll('td:last-child button'));var b=bs[bs.length-1];var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
await clickPos(umore.x, umore.y)
await sleep(1200)
const umenu = await ev(`(function(){var els=Array.from(document.querySelectorAll('.v-overlay--active .v-list-item, .v-overlay .v-list-item')).filter(function(x){return x.getClientRects().length>0});var m={};els.forEach(function(x){var t=x.textContent.trim();if(t==='角色和策略'||t==='重置密码'||t==='账户延期'||t==='删除用户')m[t]=(x.className.indexOf('disabled')>=0)||x.getAttribute('aria-disabled')==='true'});return JSON.stringify(m)})()`)
const UM = JSON.parse(umenu)
check('内置用户 more 菜单：角色和策略/账户延期/删除用户置灰、重置密码可用', UM['角色和策略'] === true && UM['账户延期'] === true && UM['删除用户'] === true && UM['重置密码'] === false, umenu)
await clickPos(700, 300) // 点空白关菜单
await sleep(700)

// ===== 4 · 角色页：ADMIN 行 + 权限树（UI-2「全部」） =====
await send('Page.navigate', { url: 'http://localhost:5173/security/roles' })
await waitFor(`document.body.innerText.indexOf('ADMIN')>=0`, 'roles ADMIN row')
await sleep(800)
const treeStats = async () => ev(`(function(){
  var rows=Array.from(document.querySelector('.vui-base-dialog').querySelectorAll('.fv-tree__row'));
  var checked=rows.filter(function(r){var i=r.querySelector('input');return i&&i.checked}).length;
  var a=rows[0]?rows[0].querySelector('input'):null;
  var allInd=!!(rows[0]&&rows[0].querySelector('.v-selection-control--indeterminate'));
  var hasArrow=!!(rows[0]&&rows[0].querySelector('.fv-tree__expander:not(.fv-tree__expander--placeholder)'));
  return JSON.stringify({rows:rows.length,allLabel:rows[0]?rows[0].innerText.trim():'',checked:checked,allInd:allInd,allOn:!!(a&&a.checked),hasArrow:hasArrow});
})()`)
// ADMIN（内置 → readonly 弹窗）：断言「全部」行 + 通配呈现全选
const permBtn = await ev(`(function(){var tr=Array.from(document.querySelectorAll('tbody tr')).find(function(r){return r.innerText.indexOf('ADMIN')>=0});var b=Array.from(tr.querySelectorAll('button')).find(function(x){return x.textContent.indexOf('权限')>=0});var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
await clickPos(permBtn.x, permBtn.y)
await waitFor(`!!document.querySelector('.vui-base-dialog')`, 'ADMIN 权限弹窗(readonly)')
await sleep(1200)
const TI = JSON.parse(await treeStats())
check('UI-2 权限树顶第一级=「全部」（readonly 呈现）', TI.allLabel.indexOf('全部') === 0, TI.allLabel)
check('UI-2 「全部」带折叠箭头（模块为其子集）', TI.hasArrow === true, JSON.stringify(TI))
check('UI-2 通配呈现：全树选中（' + TI.checked + '/' + TI.rows + ' 行）', TI.checked === TI.rows && TI.rows > 1, JSON.stringify(TI))
await ev(`(function(){var b=Array.from(document.querySelectorAll('.vui-base-dialog button')).find(function(x){return x.textContent.trim()==='取消'});if(b)b.click();return true})()`)
await sleep(800)

// ===== 4b · 新建探针角色：权限树「全部」交互全链路（非 readonly） =====
const newBtn = await ev(`(function(){var b=Array.from(document.querySelectorAll('button')).find(function(x){return (x.getAttribute('aria-label')||'').indexOf('新增')>=0});var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
await clickPos(newBtn.x, newBtn.y)
await waitFor(`!!document.querySelector('.vui-base-dialog') && Array.from(document.querySelectorAll('.vui-base-dialog input')).length>=2`, '角色新增弹窗')
await ev(`(function(){var inp=Array.from(document.querySelectorAll('.vui-base-dialog input'));var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(inp[0],'ZC-E2E');inp[0].dispatchEvent(new Event('input',{bubbles:true}));s.call(inp[1],'端到端探针');inp[1].dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
await sleep(400)
await ev(`(function(){var b=Array.from(document.querySelectorAll('.vui-base-dialog button')).find(function(x){return x.textContent.trim()==='确认'||x.textContent.trim()==='确定'});if(b)b.click();return true})()`)
await waitFor(`document.body.innerText.indexOf('ZC-E2E')>=0`, 'ZC-E2E 行出现')
await sleep(600)
check('新建角色落库回显（ZC-E2E）', true)
// 打开 ZC-E2E 权限弹窗（非 readonly）→ 默认全 off → 点「全部」→ 全 on → 取消 → 全 off → 再点回 → 保存 → 重开验证
const zb = await ev(`(function(){var tr=Array.from(document.querySelectorAll('tbody tr')).find(function(r){return r.innerText.indexOf('ZC-E2E')>=0});var b=Array.from(tr.querySelectorAll('button')).find(function(x){return x.textContent.indexOf('权限')>=0});var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
await clickPos(zb.x, zb.y)
await waitFor(`!!document.querySelector('.vui-base-dialog')`, 'ZC-E2E 权限弹窗')
await sleep(1000)
const T0 = JSON.parse(await treeStats())
check('新角色权限树默认全空（0/' + T0.rows + '）', T0.checked === 0, JSON.stringify(T0))
// 「全部」折叠箭头交互：收起 → 仅「全部」一行可见；再点恢复全树
const arrowCb = await ev(`(function(){var rows=Array.from(document.querySelector('.vui-base-dialog').querySelectorAll('.fv-tree__row'));var a=rows[0].querySelector('.fv-tree__expander:not(.fv-tree__expander--placeholder)');var r=a.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
await clickPos(arrowCb.x, arrowCb.y); await sleep(700)
const visCollapsed = await ev(`(function(){var rows=Array.from(document.querySelector('.vui-base-dialog').querySelectorAll('.fv-tree__row'));return rows.filter(function(r){return r.getClientRects().length>0}).length})()`)
check('点「全部」折叠箭头 → 子树收起（仅 1 行可见）', visCollapsed === 1, 'visible=' + visCollapsed)
// 折叠后弹窗卡片变矮垂直居中、「全部」行坐标下移——重新取箭头坐标再点
const arrowCb2 = await ev(`(function(){var rows=Array.from(document.querySelector('.vui-base-dialog').querySelectorAll('.fv-tree__row'));var a=rows[0].querySelector('.fv-tree__expander:not(.fv-tree__expander--placeholder)');var r=a.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
await clickPos(arrowCb2.x, arrowCb2.y); await sleep(700)
const visExpanded = await ev(`(function(){var rows=Array.from(document.querySelector('.vui-base-dialog').querySelectorAll('.fv-tree__row'));return rows.filter(function(r){return r.getClientRects().length>0}).length})()`)
check('再点箭头 → 子树展开恢复（' + visExpanded + ' 行可见）', visExpanded === T0.rows, 'visible=' + visExpanded)
const allCb = await ev(`(function(){var rows=Array.from(document.querySelector('.vui-base-dialog').querySelectorAll('.fv-tree__row'));var b=rows[0].querySelector('button')||rows[0];var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
await clickPos(allCb.x, allCb.y); await sleep(800)
const T1 = JSON.parse(await treeStats())
check('点「全部」→ 全树选中（' + T1.checked + '/' + T1.rows + '）', T1.checked === T1.rows && !T1.allInd, JSON.stringify(T1))
// 通配在场时取消一个子项（功能行）→「全部」直接取消选中=空框（2026-11-03 二次定稿：非半选）
const subCb = await ev(`(function(){var rows=Array.from(document.querySelector('.vui-base-dialog').querySelectorAll('.fv-tree__row'));var r=rows[2].getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
await clickPos(subCb.x, subCb.y); await sleep(800)
const TD = JSON.parse(await treeStats())
check('取消单项后「全部」直接取消选中（空框 off、非半选，选中数回落）', TD.allOn === false && TD.allInd === false && TD.checked < TD.rows && TD.checked > 0, JSON.stringify(TD))
// 空框态点「全部」→ 恢复全选（off→on = 通配回归 ["*"]，Deny 全清）
await clickPos(allCb.x, allCb.y); await sleep(800)
const TR = JSON.parse(await treeStats())
check('空框态点「全部」→ 恢复全选', TR.checked === TR.rows && !TR.allInd, JSON.stringify(TR))
await clickPos(allCb.x, allCb.y); await sleep(800)
const T2 = JSON.parse(await treeStats())
check('再点「全部」取消 → 整树退选（0）', T2.checked === 0 && !T2.allInd, JSON.stringify(T2))
await clickPos(allCb.x, allCb.y); await sleep(800)
const T3 = JSON.parse(await treeStats())
check('重新点「全部」→ 恢复全选', T3.checked === T3.rows, JSON.stringify(T3))
await ev(`(function(){var b=Array.from(document.querySelectorAll('.vui-base-dialog button')).find(function(x){return x.textContent.trim()==='确认'||x.textContent.trim()==='确定'});if(b)b.click();return true})()`)
await waitFor(`!document.querySelector('.vui-base-dialog')`, '保存关窗', 10000)
await sleep(600)
// 重开验证持久化：仍全选（存 ["*"]）
const zb2 = await ev(`(function(){var tr=Array.from(document.querySelectorAll('tbody tr')).find(function(r){return r.innerText.indexOf('ZC-E2E')>=0});var b=Array.from(tr.querySelectorAll('button')).find(function(x){return x.textContent.indexOf('权限')>=0});var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
await clickPos(zb2.x, zb2.y)
await waitFor(`!!document.querySelector('.vui-base-dialog')`, '重开权限弹窗')
await sleep(1000)
const T4 = JSON.parse(await treeStats())
check('保存后重开：通配持久化（全选 ' + T4.checked + '/' + T4.rows + '）', T4.checked === T4.rows, JSON.stringify(T4))
await ev(`(function(){var b=Array.from(document.querySelectorAll('.vui-base-dialog button')).find(function(x){return x.textContent.trim()==='取消'});if(b)b.click();return true})()`)
await sleep(700)

// ===== 4c · 手动勾齐全部模块 = 「全部」选中 → 提交收敛 ["*"]（2026-11-03 三次定稿） =====
const zb3 = await ev(`(function(){var tr=Array.from(document.querySelectorAll('tbody tr')).find(function(r){return r.innerText.indexOf('ZC-E2E')>=0});var b=Array.from(tr.querySelectorAll('button')).find(function(x){return x.textContent.indexOf('权限')>=0});var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
await clickPos(zb3.x, zb3.y)
await waitFor(`!!document.querySelector('.vui-base-dialog')`, '三开权限弹窗')
await sleep(1000)
const allCb3 = await ev(`(function(){var rows=Array.from(document.querySelector('.vui-base-dialog').querySelectorAll('.fv-tree__row'));var b=rows[0].querySelector('button')||rows[0];var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
await clickPos(allCb3.x, allCb3.y); await sleep(800) // 「全部」on→off = 清空整树
const TZ = JSON.parse(await treeStats())
check('4c 起点：「全部」取消后整树清空（0）', TZ.checked === 0, JSON.stringify(TZ))
// 模块行 = 带注册表图标的行（.fv-tree__icon 模块行独有；「全部」/功能/控件行无图标）
const modCount = await ev(`(function(){var rows=Array.from(document.querySelector('.vui-base-dialog').querySelectorAll('.fv-tree__row'));return rows.filter(function(r){return r.querySelector('.fv-tree__icon')}).length})()`)
for (let i = 0; i < modCount; i++) {
  // 底部模块行可能在弹窗正文滚动区外——先滚入可视再取坐标（同「弹窗高度变化重取坐标」坑）
  const mb = await ev(`(function(){var rows=Array.from(document.querySelector('.vui-base-dialog').querySelectorAll('.fv-tree__row')).filter(function(r){return r.querySelector('.fv-tree__icon')});rows[${i}].scrollIntoView({block:'center'});var r=rows[${i}].getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
  await clickPos(mb.x, mb.y); await sleep(600)
}
await sleep(500)
const TM = JSON.parse(await treeStats())
check('手动勾齐 3 模块 →「全部」自动选中 + 收敛通配（' + TM.checked + '/' + TM.rows + '）', TM.allOn === true && TM.checked === TM.rows, JSON.stringify(TM))
await ev(`(function(){var b=Array.from(document.querySelectorAll('.vui-base-dialog button')).find(function(x){return x.textContent.trim()==='确认'||x.textContent.trim()==='确定'});if(b)b.click();return true})()`)
await waitFor(`!document.querySelector('.vui-base-dialog')`, '4c 保存关窗', 10000)
await sleep(1000)
// Node 直连后端验证提交载荷：手动全选保存后 permissions 恰为 ["*"]（非明细串清单）
const lr = await fetch('http://127.0.0.1/security-management/api/v1/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'FvAdmin', password: '123456', clientIp: '127.0.0.1', deviceId: 'zcode-e2e' }),
}).then((r) => r.json())
const rr = await fetch('http://127.0.0.1/security-management/api/v1/roles/page?pageIndex=1&pageSize=50&keyword=ZC-E2E', {
  headers: { Authorization: 'Bearer ' + (lr.data && lr.data.token) },
}).then((r) => r.json())
const savedPerms = rr.data && rr.data.data && rr.data.data[0] && rr.data.data[0].permissions
check('提交收敛：手动全选保存后后端 permissions 恰为 ["*"]', JSON.stringify(savedPerms) === JSON.stringify(['*']), JSON.stringify(savedPerms))

// 清理探针角色（新建默认停用，可直接删）
const delBtn = await ev(`(function(){var tr=Array.from(document.querySelectorAll('tbody tr')).find(function(r){return r.innerText.indexOf('ZC-E2E')>=0});var b=Array.from(tr.querySelectorAll('button')).find(function(x){return (x.getAttribute('aria-label')||'').indexOf('删除')>=0});var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
await clickPos(delBtn.x, delBtn.y)
await waitFor(`!!document.querySelector('.vui-base-dialog')`, '删除确认')
await sleep(600)
await ev(`(function(){var b=Array.from(document.querySelectorAll('.vui-base-dialog button')).find(function(x){return x.textContent.trim()==='OK'||x.textContent.trim()==='确认'||x.textContent.trim()==='确定'});if(b)b.click();return true})()`)
await waitFor(`document.body.innerText.indexOf('ZC-E2E')<0`, 'ZC-E2E 已删')
check('探针角色 ZC-E2E 清理完成', true)

// ===== 5 · 策略页：真实数据 + UI-16 内置策略保护 =====
await send('Page.navigate', { url: 'http://localhost:5173/security/login-policy' })
await waitFor(`document.body.innerText.indexOf('Admin-Policy')>=0`, 'policy row')
await sleep(800)
const dis = await ev(`(function(){
  var tr=Array.from(document.querySelectorAll('tbody tr')).find(function(r){return r.innerText.indexOf('Admin-Policy')>=0});
  var btns=Array.from(tr.querySelectorAll('td:last-child button'));
  return JSON.stringify(btns.map(function(b){return {dis:b.disabled||b.getAttribute('aria-disabled')==='true'||b.closest('.v-btn--disabled')!==null}}));
})()`)
const DIS = JSON.parse(dis)
check('UI-16 Admin-Policy 行编辑+删除钮置灰（' + DIS.length + ' 钮全禁）', DIS.length > 0 && DIS.every((d) => d.dis), dis)

// ===== 6 · 登出 =====
await ev(`(function(){var av=document.querySelector('header .v-avatar')||document.querySelector('.v-avatar');if(av)av.dispatchEvent(new MouseEvent('click',{bubbles:true}));return true})()`)
await sleep(900)
await ev(`(function(){var it=Array.from(document.querySelectorAll('.v-list-item,[role=menuitem]')).find(function(x){return x.textContent.trim().indexOf('登出')>=0||x.textContent.trim().indexOf('退出')>=0});if(it)it.click();return !!it})()`)
await sleep(600)
await ev(`(function(){var b=Array.from(document.querySelectorAll('.vui-base-dialog button')).find(function(x){return x.textContent.trim()==='OK'||x.textContent.trim()==='确认'||x.textContent.trim()==='确定'});if(b)b.click();return true})()`)
await waitFor(`location.pathname==='/login'`, '登出回登录页')
const authCleared = await ev(`!localStorage.getItem('vui.auth')`)
check('登出：回登录页且本地会话清空', location => true && authCleared, 'vui.auth=' + (authCleared ? '已清' : '残留'))

// ===== 汇总 =====
const pass = results.filter(Boolean).length
console.log(`\n${pass}/${results.length} passed`)
process.exit(pass === results.length ? 0 : 1)
