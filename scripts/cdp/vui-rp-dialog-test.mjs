const sleep=(ms)=>new Promise(r=>setTimeout(r,ms))
async function tp(){for(let i=0;i<8;i++){try{const r=await fetch('http://127.0.0.1:9333/json/new?about:blank',{method:'PUT'});const j=await r.json();if(j.webSocketDebuggerUrl)return j}catch{}await sleep(500)}throw new Error('no')}
let ws,mid=0;const pn=new Map()
const send=(m,p={})=>new Promise((res,rej)=>{const id=++mid;pn.set(id,{res,rej});ws.send(JSON.stringify({id,method:m,params:p}))})
const ev=async e=>{const r=await send('Runtime.evaluate',{expression:`(${e})`,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error('page: '+(r.exceptionDetails.exception?.description||r.exceptionDetails.text));return r.result.value}
async function waitFor(expr,label,timeout=15000){const t0=Date.now();while(Date.now()-t0<timeout){try{if(await ev(expr))return}catch{}await sleep(200)}throw new Error('timeout: '+label)}
async function clickPos(x,y){await send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1})}
const results=[]
const check=(n,ok,d='')=>{results.push(ok);console.log(`${ok?'✅':'❌'} ${n}${d?' — '+d:''}`)}
const visDlgTop=()=>ev(`(function(){var ds=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0});return JSON.stringify(ds.map(function(d){return d.innerText.split('\\n')[0]}))})()`)
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
await waitFor(`Array.from(document.querySelectorAll('tbody tr')).some(function(r){return r.innerText.indexOf('zhang.xiaofeng')>=0})`,'users')
await sleep(1000)
// more 菜单
const more=await ev(`(function(){var tr=Array.from(document.querySelectorAll('tbody tr')).find(function(r){return r.innerText.indexOf('zhang.xiaofeng')>=0});var bs=Array.from(tr.querySelectorAll('td:last-child button'));var b=bs[bs.length-1];var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
await clickPos(more.x,more.y)
await sleep(1300)
const mi=await ev(`(function(){var els=Array.from(document.querySelectorAll('.v-list-item')).filter(function(x){return x.getClientRects().length>0&&x.textContent.trim()==='角色和策略'});if(!els.length)return null;var r=els[0].getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
if(!mi){console.log('menu dumps:', await ev(`JSON.stringify(Array.from(document.querySelectorAll('.v-list-item')).filter(function(x){return x.getClientRects().length>0}).map(function(x){return x.textContent.trim()}).slice(0,15)))`));throw new Error('menu item not found')}
await clickPos(mi.x,mi.y)
await waitFor(`(function(){var ds=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0});return ds.length>=1})()`,'rp dialog')
await sleep(1200)
console.log('dialogs now:', await visDlgTop())
const dinfo=await ev(`(function(){var d=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0}).pop();var out={title:d.innerText.split('\\n')[0],stars:{}};Array.from(d.querySelectorAll('label')).forEach(function(l){if(!l.htmlFor)return;var t=l.textContent.trim();var k=t.replace('*','').trim();out.stars[k]=t.startsWith('*')});return JSON.stringify(out)})()`)
const D=JSON.parse(dinfo)
check('角色和策略弹窗打开', D.title.indexOf('角色和策略')>=0, D.title)
check('角色、登录策略带红星（FvTextSelect required）', D.stars['角色']===true && (D.stars['登录策略']===true), JSON.stringify(D.stars))
async function setDays(label,val){const r=await ev(`(function(){var d=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0}).pop();var lbl=Array.from(d.querySelectorAll('label')).find(function(l){return l.htmlFor&&l.textContent.indexOf(${JSON.stringify(label)})>=0});if(!lbl)return 'nolabel';var inp=document.getElementById(lbl.htmlFor);var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(inp,${JSON.stringify(val)});inp.dispatchEvent(new Event('input',{bubbles:true}));return 'ok'})()`);if(r!=='ok')throw new Error(label+':'+r)}
async function badges(){return ev(`(function(){var d=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0}).pop();return d.querySelectorAll('.fv-field__err-badge').length})()`)}
async function confirmClick(){const p=await ev(`(function(){var d=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0}).pop();var b=Array.from(d.querySelectorAll('button')).find(function(x){return x.textContent.trim()==='确认'});var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await clickPos(p.x,p.y)}
await setDays('密码有效期天数','1000');await sleep(250);await confirmClick();await sleep(900)
check('天数 1000 拦截（1~999 对齐策略弹窗）', (await badges())>=1)
const tip=await ev(`(function(){var d=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0}).pop();var b=d.querySelector('.fv-field__err-badge');if(!b)return null;var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
if(tip){await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:tip.x,y:tip.y});await sleep(900)}
const tipTxt=await ev(`(function(){var t=Array.from(document.querySelectorAll('.vui-field-err-tip')).find(function(x){return x.getClientRects().length>0});return t?t.textContent:''})()`)
check('错误 tooltip 文案=1~999', tipTxt.indexOf('1~999')>=0, tipTxt)
await setDays('密码有效期天数','');await sleep(200)
// 关窗
const cx=await ev(`(function(){var d=Array.from(document.querySelectorAll('.vui-base-dialog')).filter(function(x){return x.getClientRects().length>0}).pop();var b=Array.from(d.querySelectorAll('button')).find(function(x){return x.textContent.trim()==='取消'});var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
await clickPos(cx.x,cx.y);await sleep(800)
console.log(`\n通过 ${results.filter(Boolean).length}/${results.length}`)
process.exitCode=results.includes(false)?1:0;ws.close()
