const sleep=(ms)=>new Promise(r=>setTimeout(r,ms))
async function tp(){for(let i=0;i<8;i++){try{const r=await fetch('http://127.0.0.1:9333/json/new?about:blank',{method:'PUT'});const j=await r.json();if(j.webSocketDebuggerUrl)return j}catch{}await sleep(500)}throw new Error('no')}
let ws,mid=0;const pn=new Map()
const send=(m,p={})=>new Promise((res,rej)=>{const id=++mid;pn.set(id,{res,rej});ws.send(JSON.stringify({id,method:m,params:p}))})
const ev=async e=>{const r=await send('Runtime.evaluate',{expression:`(${e})`,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error('page: '+(r.exceptionDetails.exception?.description||r.exceptionDetails.text));return r.result.value}
async function waitFor(expr,label,timeout=15000){const t0=Date.now();while(Date.now()-t0<timeout){try{if(await ev(expr))return}catch{}await sleep(200)}throw new Error('timeout: '+label)}
async function clickPos(x,y){await send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1})}
const t=await tp()
await new Promise((res,rej)=>{ws=new WebSocket(t.webSocketDebuggerUrl);ws.onopen=res;ws.onerror=rej;ws.onmessage=e2=>{const m=JSON.parse(e2.data);if(m.id&&pn.has(m.id)){const{res:r,rej:j}=pn.get(m.id);pn.delete(m.id);m.error?j(new Error(m.error.message)):r(m.result)}}})
await send('Runtime.enable');await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false})
await send('Page.navigate',{url:'http://localhost:5173/login'})
await waitFor(`location.host==='localhost:5173'`,'origin');await ev(`(function(){localStorage.clear();return true})()`)
await send('Page.navigate',{url:'http://localhost:5173/login'})
await waitFor(`Array.from(document.querySelectorAll('input')).filter(function(i){return i.type==='text'||i.type==='password'}).length>=2`,'login inputs')
await ev(`(function(){var inp=Array.from(document.querySelectorAll('input')).filter(function(i){return i.type==='text'||i.type==='password'});var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(inp[0],'admin');inp[0].dispatchEvent(new Event('input',{bubbles:true}));s.call(inp[1],'passw0rd');inp[1].dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
await sleep(500)
const lb=await ev(`(function(){var b=Array.from(document.querySelectorAll('button')).find(function(x){return x.type==='submit'});var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
await clickPos(lb.x,lb.y);await waitFor(`location.pathname!=='/login'`,'redirect')
let fails=0
for(const [name, path, sel] of [['角色','/security/roles','.vui-roles-search'],['用户','/security/users','.vui-users-search'],['策略','/security/login-policy','.vui-policy-search']]){
  await send('Page.navigate',{url:'http://localhost:5173'+path})
  await waitFor(`!!document.querySelector('${sel} .v-field') && !!document.querySelector('${sel} button')`,name+' ready')
  await sleep(900)
  const g=await ev(`(function(){var s=document.querySelector('${sel}');var f=s.querySelector('.v-field').getBoundingClientRect();var b=s.querySelector('button').getBoundingClientRect();return JSON.stringify({fieldBottom:Math.round(f.bottom),btnBottom:Math.round(b.bottom),delta:Math.round(f.bottom-b.bottom),margin:getComputedStyle(s.querySelector('.fv-text-input')).margin})})()`)
  const G=JSON.parse(g); const ok=Math.abs(G.delta)<=1
  if(!ok)fails++
  console.log(`${ok?'✅':'❌'} ${name}页搜索框底边对齐 btn=${G.btnBottom} field=${G.fieldBottom} Δ=${G.delta} margin=${G.margin}`)
}
process.exitCode=fails?1:0; ws.close()
