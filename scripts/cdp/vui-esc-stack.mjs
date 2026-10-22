/* Esc 层叠让位回归（2026-10-22 修复配套）：旧「active overlay 总数>1 即让位」在栈式层叠下
   致二级/三级弹窗 Esc 全灭。验证：单层可关；两层=栈顶先关、下层存活再关；弹窗+下拉浮层=
   先关浮层不关弹窗。选择器复用 profile/policy 套件口径。 */
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms))
async function tp(){for(let i=0;i<8;i++){try{const r=await fetch('http://127.0.0.1:9333/json/new?about:blank',{method:'PUT'});const j=await r.json();if(j.webSocketDebuggerUrl)return j}catch{}await sleep(500)}throw new Error('no')}
let ws,mid=0;const pn=new Map()
const send=(m,p={})=>new Promise((res,rej)=>{const id=++mid;pn.set(id,{res,rej});ws.send(JSON.stringify({id,method:m,params:p}))})
const ev=async e=>{const r=await send('Runtime.evaluate',{expression:`(${e})`,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error('page: '+(r.exceptionDetails.exception?.description||r.exceptionDetails.text));return r.result.value}
async function waitFor(expr,label,timeout=15000){const t0=Date.now();while(Date.now()-t0<timeout){try{if(await ev(expr))return}catch{}await sleep(200)}throw new Error('timeout: '+label)}
async function clickPos(x,y){await send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1})}
async function pressEsc(){await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27})}
const results=[]
const check=(n,ok,d='')=>{results.push(ok);console.log(`${ok?'✅':'❌'} ${n}${d?' — '+d:''}`)}
// 在场可见业务弹窗数（关合动画留 rect，判定前 sleep≥600 已覆盖）
const dlgCount=()=>ev(`Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(d){return d.getClientRects().length>0}).length`)
const dlgText=()=>ev(`(function(){var ds=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(d){return d.getClientRects().length>0});return ds.map(function(d){return d.innerText.split('\\n')[0]}).join('|')})()`)
// 轮询等待可见弹窗数归 n（关合动画+卸载有延迟，固定 sleep 会误判）
async function waitDlg(n,ms=8000){const t0=Date.now();while(Date.now()-t0<ms){try{if((await dlgCount())===n)return true}catch{}await sleep(200)}return false}
async function waitForOk(expr,ms=8000){const t0=Date.now();while(Date.now()-t0<ms){try{if(await ev(expr))return true}catch{}await sleep(200)}return false}
async function openProfile(){
  await waitDlg(0)
  const av=await ev(`(function(){var b=Array.from(document.querySelectorAll('header button, .vui-topbar button')).find(function(x){return x.querySelector('.v-avatar')});var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
  await clickPos(av.x,av.y)
  await waitFor(`!!Array.from(document.querySelectorAll('.v-overlay--active .v-list-item')).find(function(x){return x.textContent.indexOf('用户信息')>=0&&x.getClientRects().length>0&&getComputedStyle(x.closest('.v-overlay__content')||x).visibility==='visible'})`,'avatar menu')
  await sleep(400)
  const mi=await ev(`(function(){var el=Array.from(document.querySelectorAll('.v-overlay--active .v-list-item')).find(function(x){return x.textContent.indexOf('用户信息')>=0&&x.getClientRects().length>0});if(!el)return null;var r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
  await clickPos(mi.x,mi.y)
  await waitFor(`Array.from(document.querySelectorAll('.vui-base-dialog')).some(function(d){return d.innerText.indexOf('用户信息')>=0&&d.getClientRects().length>0})`,'profile dialog')
  await sleep(1000)
}
async function openPenByLabel(label){
  const p=await ev(`(function(){var ds=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(d){return d.getClientRects().length>0});var d=ds[ds.length-1];
  var row=Array.from(d.querySelectorAll('.vui-profile__row')).find(function(r){return r.textContent.indexOf(${JSON.stringify(label)})>=0});
  var b=Array.from(row.querySelectorAll('button')).find(function(x){return (x.getAttribute('title')||'')==='编辑'});
  var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
  await clickPos(p.x,p.y)
  await waitFor(`(function(){var ds=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(d){return d.getClientRects().length>0});return ds.length===2})()`,label+' stacked')
  await sleep(900)
}
const t=await tp()
await new Promise((res,rej)=>{ws=new WebSocket(t.webSocketDebuggerUrl);ws.onopen=res;ws.onerror=rej;ws.onmessage=e2=>{const m=JSON.parse(e2.data);if(m.id&&pn.has(m.id)){const{res:r,rej:j}=pn.get(m.id);pn.delete(m.id);m.error?j(new Error(m.error.message)):r(m.result)}}})
await send('Runtime.enable');await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false})
await send('Page.navigate',{url:'http://localhost:5173/login'})
await waitFor(`location.host==='localhost:5173'`,'origin');await ev(`(function(){localStorage.clear();return true})()`)
await send('Page.navigate',{url:'http://localhost:5173/login'})
await waitFor(`Array.from(document.querySelectorAll('input')).filter(function(i){return i.type==='text'||i.type==='password'}).length>=2`,'login')
await ev(`(function(){var inp=Array.from(document.querySelectorAll('input')).filter(function(i){return i.type==='text'||i.type==='password'});var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(inp[0],'admin');inp[0].dispatchEvent(new Event('input',{bubbles:true}));s.call(inp[1],'passw0rd');inp[1].dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
await sleep(500)
const lb=await ev(`(function(){var b=Array.from(document.querySelectorAll('button')).find(function(x){return x.type==='submit'});var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
await clickPos(lb.x,lb.y);await waitFor(`location.pathname!=='/login'`,'redirect');await sleep(1000)

// ===== A. 单层：Esc 直关（历史行为不回归） =====
await openProfile()
await pressEsc()
check('A1 单层弹窗 Esc 可关（等卸载）', await waitDlg(0), 'count='+(await dlgCount()))

// ===== B. 两层：用户信息(L1)+昵称编辑(L2)——修复主场景 =====
await openProfile()
await openPenByLabel('昵称')
check('B1 层叠两层在场', (await dlgCount())===2, await dlgText())
await pressEsc()
const b2=await waitDlg(1)
const after1=await dlgText()
check('B2 Esc 先关栈顶二级（一级存活，旧 bug=全灭）', b2 && after1.indexOf('用户信息')>=0, after1)
await pressEsc()
check('B3 再 Esc 关一级', await waitDlg(0), 'count='+(await dlgCount()))

// ===== C. 弹窗+浮层三级栈：策略编辑弹窗(P002 特殊字符下拉打开)→Esc 关浮层不关弹窗→再 Esc 关弹窗 =====
await send('Page.navigate',{url:'http://localhost:5173/security/login-policy'})
await waitFor(`(function(){var tr=Array.from(document.querySelectorAll('tbody tr')).find(function(r){return r.innerText.indexOf('P002')>=0});return !!tr&&Array.from(tr.querySelectorAll('button')).some(function(b){return (b.getAttribute('aria-label')||b.getAttribute('title')||'')==='编辑'})})()`,'P002 edit btn')
await sleep(700)
const eb=await ev(`(function(){var tr=Array.from(document.querySelectorAll('tbody tr')).find(function(r){return r.innerText.indexOf('P002')>=0});var b=Array.from(tr.querySelectorAll('button')).find(function(x){return (x.getAttribute('aria-label')||x.getAttribute('title')||'')==='编辑'});var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
await clickPos(eb.x,eb.y)
await waitFor(`(function(){var ds=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(d){return d.getClientRects().length>0});return ds.length===1&&ds[0].innerText.indexOf('特殊字符集合')>=0})()`,'policy edit')
await sleep(900)
// 打开特殊字符下拉（可见弹窗内取字段，右缘点）
const sf=await ev(`(function(){var ds=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(d){return d.getClientRects().length>0});var dlg=ds[ds.length-1];var lbl=Array.from(dlg.querySelectorAll('label')).find(function(l){return l.textContent.indexOf('特殊字符集合')>=0&&l.htmlFor&&document.getElementById(l.htmlFor)});var inp=document.getElementById(lbl.htmlFor);var field=inp.closest('.v-field');var r=field.getBoundingClientRect();return{x:r.right-20,y:r.y+r.height/2}})()`)
await clickPos(sf.x,sf.y)
const opened=await waitForOk(`(function(){var c=Array.from(document.querySelectorAll('.v-select__content')).find(function(x){return x.getClientRects().length>0});return !!c})()`)
console.log('dropdown opened:',opened)
// 5修后 v-menu 的 Esc 交还 Vuetify（不再代理/不再掐断）：断言 Esc 不误伤——弹窗必存活
await pressEsc()
await sleep(900)
check('C1 Esc 后弹窗存活（多层判定不误伤）', (await dlgCount())===1, 'dlg='+(await dlgCount()))
// 点空白收菜单后 Esc 关弹窗
await clickPos(200,850)
await sleep(600)
await pressEsc()
check('C2 Esc 关弹窗', await waitDlg(0), 'count='+(await dlgCount()))

// ===== D. 用户四层链（个人信息→昵称/邮箱/电话子窗）：连按 Esc 逐层即时出栈、无闪烁残卡（2026-10-22 用户定稿） =====
await openProfile()
const jsPen=(label)=>ev(`(function(){var prof=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(d){return d.innerText.indexOf('用户信息')>=0})[0];var row=Array.from(prof.querySelectorAll('.vui-profile__row')).find(function(r){return r.textContent.indexOf('${label}')>=0});var b=Array.from(row.querySelectorAll('button')).find(function(x){return (x.getAttribute('title')||'')==='编辑'});b.click();return 1})()`)
await jsPen('昵称');await sleep(600)
await jsPen('邮箱');await sleep(600)
await jsPen('电话');await sleep(800)
check('D1 四层在场', (await dlgCount())===4, await dlgText())
await pressEsc();await sleep(500)
const inst=await ev(`(function(){var ds=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(d){return d.getClientRects().length>0});return JSON.stringify({n:ds.length,ops:ds.map(function(d){return getComputedStyle(d).opacity})})})()`)
const INST=JSON.parse(inst)
check('D2 Esc 只关最顶层一张、其余三层不透明无闪烁（关闭动画与按钮路径同源）', INST.n===3 && INST.ops.every((o)=>o==='1'), inst)
await pressEsc();await sleep(400)
await pressEsc();await sleep(400)
await pressEsc()
check('D3 连按四次全出栈（含最底层用户信息）', (await waitDlg(0,4000)), 'count='+(await dlgCount()))
console.log('D DBG:', await ev(`JSON.stringify({dbg:window.__escDbg||null,cards:Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(d){return d.getClientRects().length>0}).map(function(d){return d.innerText.split('\\n')[0].slice(0,4)})})`))
// D5（问题③回归）：弹窗开着 + 鼠标悬停在 Label 问号上（tooltip 激活且 z 高于弹窗）
// → Esc 必须直接关弹窗，不得因 tooltip 让位关不掉
await openProfile()
const tip = await ev(`(function(){var ic=Array.from(document.querySelectorAll('.vui-base-dialog .fa-circle-question, .vui-base-dialog .v-icon')).find(function(x){return x.getClientRects().length>0});if(!ic)return null;var r=ic.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
if(tip){await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:tip.x,y:tip.y});await sleep(700)}
const tipOn=await ev(`!!document.querySelector('.v-tooltip.v-overlay--active')`)
await pressEsc();await sleep(900)
check('D5 悬停 tooltip 时 Esc 仍关弹窗（不让位被动层）', (await waitDlg(0,3000))||(await dlgCount())===0, 'tooltipActive='+tipOn+' after='+await dlgCount())
await pressEsc();await sleep(600)
await openProfile()
check('D4 Esc 关窗后头像菜单复开正常（无 visibility 毒化）', (await dlgCount())===1, 'profile reopened')
await pressEsc();await sleep(600)

console.log(`\n通过 ${results.filter(Boolean).length}/${results.length}`)
process.exitCode=results.includes(false)?1:0
ws.close()
