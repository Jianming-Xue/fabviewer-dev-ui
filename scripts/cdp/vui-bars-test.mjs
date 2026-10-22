const sleep=(ms)=>new Promise(r=>setTimeout(r,ms))
async function tp(){for(let i=0;i<8;i++){try{const r=await fetch('http://127.0.0.1:9333/json/new?about:blank',{method:'PUT'});const j=await r.json();if(j.webSocketDebuggerUrl)return j}catch{}await sleep(500)}throw new Error('no')}
let ws,mid=0;const pn=new Map()
const send=(m,p={})=>new Promise((res,rej)=>{const id=++mid;pn.set(id,{res,rej});ws.send(JSON.stringify({id,method:m,params:p}))})
const ev=async e=>{const r=await send('Runtime.evaluate',{expression:`(${e})`,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error('page: '+(r.exceptionDetails.exception?.description||r.exceptionDetails.text));return r.result.value}
async function waitFor(expr,label,timeout=15000){const t0=Date.now();while(Date.now()-t0<timeout){try{if(await ev(expr))return}catch{}await sleep(200)}throw new Error('timeout: '+label)}
async function clickPos(x,y){await send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1})}
const results=[]
const check=(n,ok,d='')=>{results.push(ok);console.log(`${ok?'✅':'❌'} ${n}${d?' — '+d:''}`)}
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
await clickPos(lb.x,lb.y);await waitFor(`location.pathname!=='/login'`,'redirect')

// ===== 策略页：横轨浮动 =====
await send('Page.navigate',{url:'http://localhost:5173/security/login-policy'})
await waitFor(`!!document.querySelector('.fv-table__xbar')&&document.querySelector('.fv-table__xbar').getClientRects().length>0`,'xbar visible')
await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:680,y:120}) // 移开轨区，防登录页残位误判悬浮加宽
await sleep(1200)
const xb=await ev(`(function(){
  var w=document.querySelector('.v-table__wrapper');var bar=document.querySelector('.fv-table__xbar')
  var wr=w.getBoundingClientRect();var br=bar.getBoundingClientRect();
  var stickyEl=w.querySelector('tbody tr td:last-child');var sticky=stickyEl.getBoundingClientRect();
  return JSON.stringify({pos:getComputedStyle(bar).position,gapToWrapperBottom:Math.round(wr.bottom-br.bottom),barRightGapToActionCol:Math.round(sticky.left-br.right),barH:Math.round(br.height),lastRowBorderW:getComputedStyle(stickyEl).borderBottomWidth,lastTdBg:getComputedStyle(stickyEl).backgroundColor,thumbH0:getComputedStyle(document.querySelector('.fv-table__xbar-thumb')).height,
  scrollStillWorks:(w.scrollLeft=100,w.scrollLeft)})})()`)
const XB=JSON.parse(xb)
check('横轨=absolute 浮动贴滚动区底缘（间隙≤6px 且不再占行高）', XB.pos==='absolute' && Math.abs(XB.gapToWrapperBottom)<=6, xb)
check('横轨到操作列左缘即止（右缘间隙 0~20px）', XB.barRightGapToActionCol>=0 && XB.barRightGapToActionCol<=20, 'gap='+XB.barRightGapToActionCol)
check('末行下边框保留 1px（贴底振荡改静态保留，勿再恒去除）', XB.lastRowBorderW==='1px', 'w='+XB.lastRowBorderW)
check('横滚重叠在场→操作格染不透明遮挡底', !/rgba\(0, 0, 0, 0\)/.test(XB.lastTdBg||''), 'bg='+(XB.lastTdBg||'-'))
// 横轨厚度（用户定稿 2026-10-21）：默认 4px → 横滚中/悬浮 6px → 停滚 3s 回落（eval 尾部已置 scrollLeft=100）
check('横轨拇指默认厚 4px', XB.thumbH0==='4px', 'h='+XB.thumbH0)
await sleep(500)
const wh=await ev(`getComputedStyle(document.querySelector('.fv-table__xbar-thumb')).height`)
check('横滚进行中→拇指加宽 6px', wh==='6px', 'h='+wh)
await sleep(3400)
const dh=await ev(`getComputedStyle(document.querySelector('.fv-table__xbar-thumb')).height`)
check('停止横滚 3s 后回落默认 4px', dh==='4px', 'h='+dh)
const hpos=await ev(`(function(){var r=document.querySelector('.fv-table__xbar').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:hpos.x,y:hpos.y})
await sleep(400)
const hh=await ev(`getComputedStyle(document.querySelector('.fv-table__xbar-thumb')).height`)
check('鼠标悬浮横轨→加宽 6px', hh==='6px', 'h='+hh)
await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:hpos.x,y:Math.max(hpos.y-300,5)})
await sleep(400)
const { writeFileSync: wfs } = await import('node:fs')
let sh=await send('Page.captureScreenshot',{format:'png'}); wfs('/tmp/vui-bars-policy.png', Buffer.from(sh.data,'base64'))

// ===== 角色页 15 条：纵轨浮动 + 表头不占用 + 滚动同步 =====
await send('Emulation.setDeviceMetricsOverride',{width:1440,height:560,deviceScaleFactor:1,mobile:false})
await send('Page.navigate',{url:'http://localhost:5173/security/roles'})
await waitFor(`(function(){var w=document.querySelector('.v-table__wrapper');return w&&w.scrollHeight>w.clientHeight+1})()`,'vertical overflow rows')
await waitFor(`!!document.querySelector('.fv-table__ybar')&&document.querySelector('.fv-table__ybar').getClientRects().length>0`,'ybar visible')
await sleep(1200)
const yb=await ev(`(function(){
  var w=document.querySelector('.v-table__wrapper');var bar=document.querySelector('.fv-table__ybar');
  var wr=w.getBoundingClientRect();var br=bar.getBoundingClientRect();
  var thead=w.querySelector('thead').getBoundingClientRect();
  var atd=w.querySelector('tbody tr td:last-child');var xvis=document.querySelector('.fv-table__xbar').getClientRects().length>0;
  return JSON.stringify({pos:getComputedStyle(bar).position,topGapToTheadBottom:Math.round(br.top-thead.bottom),rightGapToWrapper:Math.round(wr.right-br.right),bottomGap:Math.round(wr.bottom-br.bottom),thumb:bar.querySelector('.fv-table__ybar-thumb').getBoundingClientRect().height,xbar:xvis,tdBg:getComputedStyle(atd).backgroundColor})})()`)
const YB=JSON.parse(yb)
check('纵轨=absolute 贴右缘', YB.pos==='absolute' && YB.rightGapToWrapper<=6, yb)
check('纵轨起于表头之下（不占表头区，间隙≤6px）', YB.topGapToTheadBottom>=0 && YB.topGapToTheadBottom<=6, 'gap='+YB.topGapToTheadBottom)
check('纵轨底缘恒贴容器底（横轨存在亦不让位，间隙≤4px）', YB.bottomGap>=0 && YB.bottomGap<=4, 'gap='+YB.bottomGap)
const TRANSPARENT=/rgba\(0, 0, 0, 0\)/
check('操作格底色随横滚重叠联动（有横轨=遮挡染底/无横轨=恒透明随行态）',
  (YB.xbar && !TRANSPARENT.test(YB.tdBg)) || (!YB.xbar && TRANSPARENT.test(YB.tdBg)), 'xbar='+YB.xbar+' bg='+YB.tdBg)
const thumb0=await ev(`(function(){var w=document.querySelector('.v-table__wrapper');w.scrollTop=0;var b=document.querySelector('.fv-table__ybar-thumb').getBoundingClientRect();return Math.round(b.top-w.getBoundingClientRect().top)})()`)
await sleep(500)
const sync=await ev(`(function(){var w=document.querySelector('.v-table__wrapper');w.scrollTop=120;return new Promise(function(r){setTimeout(function(){var bar=document.querySelector('.fv-table__ybar-thumb');r(JSON.stringify({scrollTop:w.scrollTop,thumbTop:Math.round(bar.getBoundingClientRect().top-w.getBoundingClientRect().top)}))},500)})})()`)
const SC=JSON.parse(sync)
check('滚动后纵轨拇指跟随下移', SC.scrollTop===120 && SC.thumbTop>thumb0+10, JSON.stringify({thumb0,SC}))
// 拇指拖拽回滚
const dpos=await ev(`(function(){var b=document.querySelector('.fv-table__ybar-thumb');var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:dpos.x,y:dpos.y})
await send('Input.dispatchMouseEvent',{type:'mousePressed',x:dpos.x,y:dpos.y,button:'left',clickCount:1})
await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:dpos.x,y:dpos.y-200})
await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:dpos.x,y:dpos.y-200,button:'left',clickCount:1})
await sleep(500)
check('拖拽拇指回滚到顶部附近', (await ev(`document.querySelector('.v-table__wrapper').scrollTop`)) < 40)
// 停滚 3s 纵轨自动淡出（pointer-events 关闭），再滚动即复显（用户定稿 2026-10-21）
await sleep(3600)
const fade=await ev(`(function(){var b=document.querySelector('.fv-table__ybar');var cs=getComputedStyle(b);return JSON.stringify({op:cs.opacity,pe:cs.pointerEvents})})()`)
const FD=JSON.parse(fade)
check('停滚 3s 后纵轨淡出（opacity=0 且 pointer-events:none）', FD.op==='0' && FD.pe==='none', fade)
await ev(`document.querySelector('.v-table__wrapper').scrollTop=80`)
await sleep(700)
const back=await ev(`getComputedStyle(document.querySelector('.fv-table__ybar')).opacity`)
check('再次滚动纵轨立即复显（opacity=1）', back==='1', 'op='+back)
// ===== 用户页双轨共存：横轨存在时纵轨底缘仍恒贴容器底（2026-10-21 用户报"差一点距离"——让位间隙回归防护） =====
await send('Page.navigate',{url:'http://localhost:5173/security/users'})
await waitFor(`(function(){var w=document.querySelector('.v-table__wrapper');return w&&w.scrollHeight>w.clientHeight+1&&document.querySelector('.fv-table__ybar')&&document.querySelector('.fv-table__ybar').getClientRects().length>0})()`,'users ybar')
await sleep(700)
const ub=await ev(`(function(){var w=document.querySelector('.v-table__wrapper');var bar=document.querySelector('.fv-table__ybar');return JSON.stringify({xbar:document.querySelector('.fv-table__xbar').getClientRects().length>0,bottomGap:Math.round(w.getBoundingClientRect().bottom-bar.getBoundingClientRect().bottom)})})()`)
const UB=JSON.parse(ub)
check('用户页横轨在、纵轨底缘贴容器底（≤4px 无让位缝）', UB.xbar && UB.bottomGap>=0 && UB.bottomGap<=4, ub)
sh=await send('Page.captureScreenshot',{format:'png'}); wfs('/tmp/vui-bars-roles.png', Buffer.from(sh.data,'base64'))
console.log(`\n通过 ${results.filter(Boolean).length}/${results.length}`)
process.exitCode=results.includes(false)?1:0
ws.close()
