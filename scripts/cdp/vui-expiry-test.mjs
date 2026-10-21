const sleep=(ms)=>new Promise(r=>setTimeout(r,ms))
async function tp(){for(let i=0;i<8;i++){try{const r=await fetch('http://127.0.0.1:9333/json/new?about:blank',{method:'PUT'});const j=await r.json();if(j.webSocketDebuggerUrl)return j}catch{}await sleep(500)}throw new Error('no')}
let ws,mid=0;const pn=new Map()
const send=(m,p={})=>new Promise((res,rej)=>{const id=++mid;pn.set(id,{res,rej});ws.send(JSON.stringify({id,method:m,params:p}))})
const ev=async e=>{const r=await send('Runtime.evaluate',{expression:`(${e})`,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error('page: '+(r.exceptionDetails.exception?.description||r.exceptionDetails.text));return r.result.value}
async function waitFor(expr,label,timeout=15000){const t0=Date.now();while(Date.now()-t0<timeout){try{if(await ev(expr))return}catch{}await sleep(200)}throw new Error('timeout: '+label)}
async function clickPos(x,y){await send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1})}
const results=[]
const check=(n,ok,d='')=>{results.push(ok);console.log(`${ok?'✅':'❌'} ${n}${d?' — '+d:''}`)}
const dayjs=(()=>{const t=new Date();const p=n=>String(n).padStart(2,'0');const f=(d)=>`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;const add=(days)=>{const d=new Date(t);d.setDate(d.getDate()+days);return f(d)};return{today:f(t),add}})()
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
await send('Page.navigate',{url:'http://localhost:5173/security/users'})
await waitFor(`!!Array.from(document.querySelectorAll('button')).find(function(b){return (b.getAttribute('aria-label')||'').indexOf('新增')>=0})`,'users page')
await sleep(800)
const add=await ev(`(function(){var b=Array.from(document.querySelectorAll('button')).find(function(x){return (x.getAttribute('aria-label')||'').indexOf('新增')>=0});var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
await clickPos(add.x,add.y)
await waitFor(`(function(){var ds=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0});return ds.length===1&&ds[0].innerText.indexOf('新增用户')>=0})()`,'create dialog')
await sleep(1200)
const readTimers=()=>ev(`(function(){var d=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0}).pop();return JSON.stringify(Array.from(d.querySelectorAll('.fv-timer')).map(function(t){return Array.from(t.querySelectorAll('.fv-timer__seg')).map(function(s){return s.value}).join('-')}))})()`)
let T=JSON.parse(await readTimers())
check('初始：激活=今天、到期=今天+365（未选策略缺省）', T[0]===dayjs.today && T[1]===dayjs.add(365), JSON.stringify(T)+' today='+dayjs.today)
// 选强策略 P002（acct 180）
async function pickPolicy(name){
  const sp=await ev(`(function(){var d=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0}).pop();var lbl=Array.from(d.querySelectorAll('label')).find(function(l){return l.textContent.indexOf('登录策略')>=0&&l.htmlFor});var inp=document.getElementById(lbl.htmlFor);var r=inp.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
  await clickPos(sp.x,sp.y);await sleep(1300)
  const ip=await ev(`(function(){var c=Array.from(document.querySelectorAll('.v-select__content')).find(function(x){return x.getClientRects().length>0});if(!c)return null;var it=Array.from(c.querySelectorAll('.v-list-item')).find(function(x){return x.textContent.trim()==='${name}'});if(!it)return null;var r=it.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
  if(!ip)throw new Error('policy item '+name+' not found')
  await clickPos(ip.x,ip.y);await sleep(900)
}
await pickPolicy('强策略')
T=JSON.parse(await readTimers())
check('选强策略后到期=激活+180（detail 驱动重算）', T[1]===dayjs.add(180), JSON.stringify(T))
// 手动超上限：到期年份改 2099
await ev(`(function(){var d=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0}).pop();var timers=d.querySelectorAll('.fv-timer');var seg=timers[1].querySelector('.fv-timer__seg');var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;seg.focus();s.call(seg,'2099');seg.dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
await sleep(600)
const bub1=await ev(`(function(){var d=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0}).pop();var timers=d.querySelectorAll('.fv-timer');return timers[1].querySelectorAll('.fv-timer__bubble .fv-field__err-badge').length})()`)
check('手动到期>策略上限：FvTimer 错误徽标出现', bub1>=1, 'badges='+bub1)
const bp=await ev(`(function(){var d=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0}).pop();var b=d.querySelectorAll('.fv-timer')[1].querySelector('.fv-field__err-badge');if(!b)return null;var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
if(bp){await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:bp.x,y:bp.y});await sleep(900)}
const bt=await ev(`(function(){var t=Array.from(document.querySelectorAll('.vui-field-err-tip')).find(function(x){return x.getClientRects().length>0});return t?t.textContent:''})()`)
check('tooltip=超策略上限文案（含180天/上限日期）', bt.indexOf('策略有效期上限')>=0 && bt.indexOf('180')>=0, bt.slice(0,60))
// 改到期=激活日期同日 → 必须晚于激活 报错
await ev(`(function(){var d=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0}).pop();var segs=d.querySelectorAll('.fv-timer')[1].querySelectorAll('.fv-timer__seg');var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(segs[0],'${dayjs.today.slice(0,4)}');segs[0].dispatchEvent(new Event('input',{bubbles:true}));s.call(segs[1],'${dayjs.today.slice(5,7)}');segs[1].dispatchEvent(new Event('input',{bubbles:true}));s.call(segs[2],'${dayjs.today.slice(8,10)}');segs[2].dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
await sleep(700)
const bt2=await ev(`(function(){var t=Array.from(document.querySelectorAll('.vui-field-err-tip, .fv-timer__bubble')).map(function(x){return x.textContent});return document.body.innerText})()`)
const err2=await ev(`(function(){var d=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0}).pop();return d.querySelectorAll('.fv-timer')[1].querySelectorAll('.fv-field__err-badge').length})()`)
check('到期=激活同日：仍报错（须晚于激活）', err2>=1)
// 清空到期 → 无错（永不过期语义保留）
await ev(`(function(){var d=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0}).pop();var segs=d.querySelectorAll('.fv-timer')[1].querySelectorAll('.fv-timer__seg');var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;segs.forEach(function(el){s.call(el,'');el.dispatchEvent(new Event('input',{bubbles:true}))});return true})()`)
await sleep(600)
const err3=await ev(`(function(){var d=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0}).pop();return d.querySelectorAll('.fv-timer')[1].querySelectorAll('.fv-field__err-badge').length})()`)
check('清空到期（不限）不报错', err3===0)
// 换合规审计策略（P003 acct -1）→ 到期被清空且无错；再激活日期改 2027 → 到期跟随（P003=-1 清空保持）
await pickPolicy('合规审计策略')
T=JSON.parse(await readTimers())
check('选 P003（-1 永不过期）到期自动清空', T[1]==='---'||/^-*$/.test(T[1])||T[1].split('-').every(function(x){return x===''}), JSON.stringify(T))
await pickPolicy('强策略')
T=JSON.parse(await readTimers())
check('换回强策略到期重算=+180', T[1]===dayjs.add(180), JSON.stringify(T))

// ===== 策略联动 Hint（2026-10-21 定稿）=====
async function pwIcon(){return ev(`(function(){var d=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0}).pop();var lbl=Array.from(d.querySelectorAll('label')).find(function(l){return l.htmlFor&&l.textContent.replace(/[*\\s]/g,'')==='密码'});return lbl?(lbl.closest('.v-input').querySelectorAll('.fv-field__hint-icon').length):-1})()`)}
async function hoverTip(which){
  const p=await ev(`(function(){var d=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0}).pop();var ic;
   if(${JSON.stringify(which)}==='pwd'){var lbl=Array.from(d.querySelectorAll('label')).find(function(l){return l.htmlFor&&l.textContent.replace(/[*\\s]/g,'')==='密码'});ic=lbl.closest('.v-input').querySelector('.fv-field__hint-icon')}
   else{ic=d.querySelectorAll('.fv-timer')[1].querySelector('.fv-field__hint-icon')}
   if(!ic)return null;var r=ic.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
  if(!p) return 'NOICON'
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x,y:p.y});await sleep(1000)
  const txt=await ev(`(function(){var ts=Array.from(document.querySelectorAll('.vui-table-tip')).filter(function(x){return x.getClientRects().length>0});return ts.map(function(t){return t.textContent}).join('|')})()`)
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x,y:p.y-160});await sleep(500)
  return txt
}
check('选强策略后密码框出现问号 Hint 图标', (await pwIcon())>0, 'icons='+await pwIcon())  // >0：Vuetify label 双份（基础+浮动副本）各含一枚
const pt=await hoverTip('pwd'); check('密码 Hint=「密码有效天数 60 天」（P002）', pt.indexOf('密码有效天数 60 天')>=0, pt.slice(0,80))
const et=await hoverTip('expiry'); check('到期 Hint=「策略要求账户有效期天数为 180」', et.indexOf('策略要求账户有效期天数为 180')>=0, et.slice(0,80))
await pickPolicy('合规审计策略'); await sleep(600)
const et2=await hoverTip('expiry'); check('P003(-1) 到期 Hint=「策略要求账户永不过期」', et2.indexOf('策略要求账户永不过期')>=0, et2.slice(0,80))
const pt2=await hoverTip('pwd'); check('P003 密码 Hint=「密码有效天数 30 天」', pt2.indexOf('密码有效天数 30 天')>=0, pt2.slice(0,80))
async function clearPolicy(){const p=await ev(`(function(){var d=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0}).pop();var lbl=Array.from(d.querySelectorAll('label')).find(function(l){return l.textContent.replace(/[*\\s]/g,'').indexOf('登录策略')>=0&&l.htmlFor});var c=lbl.closest('.v-input').querySelector('.v-field__clearable');if(!c)return null;var r=c.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);if(!p)throw new Error('clear icon not found');await clickPos(p.x,p.y)}
await clearPolicy(); await sleep(800) // clearable × 清空策略
check('清空策略后密码 Hint 图标隐藏', (await pwIcon())===0, 'icons='+await pwIcon())
const et3=await hoverTip('expiry'); check('清空后到期 Hint 回退通用约束文案', et3.indexOf('须晚于激活日期')>=0, et3.slice(0,80))

console.log(`\n通过 ${results.filter(Boolean).length}/${results.length}`)
process.exitCode=results.includes(false)?1:0;ws.close()
