/* Login Policy 页面 CDP 全链路验证（v2：真实鼠标事件、viewport 1440x900、清态登录、
   健壮 label 定位——Vuetify 每字段渲染两个 label，首个可能 for=""） */
import { writeFileSync } from 'node:fs'

const PORT = 9333
const BASE = `http://127.0.0.1:${PORT}`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function newPageTarget() {
  for (let i = 0; i < 8; i++) {
    try { const r = await fetch(`${BASE}/json/new?about:blank`, { method: 'PUT' }); const j = await r.json(); if (j.webSocketDebuggerUrl) return j } catch {}
    await sleep(500)
  }
  throw new Error('no webSocketDebuggerUrl')
}

let ws, msgId = 0
const pending = new Map()
const consoleMsgs = []
const send = (method, params = {}) =>
  new Promise((resolve, reject) => { const id = ++msgId; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })) })

const target = await newPageTarget()
await new Promise((resolve, reject) => {
  ws = new WebSocket(target.webSocketDebuggerUrl)
  ws.onopen = resolve
  ws.onerror = reject
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data)
    if (m.method === 'Runtime.consoleAPICalled') {
      consoleMsgs.push((m.params.args || []).map((a) => a.description || a.value || '').join(' '))
    }
    if (m.id && pending.has(m.id)) {
      const { resolve: r, reject: j } = pending.get(m.id)
      pending.delete(m.id)
      m.error ? j(new Error(m.error.message)) : r(m.result)
    }
  }
})
await send('Runtime.enable')
await send('Page.enable')

const evalJs = async (e) => {
  const r = await send('Runtime.evaluate', { expression: `(${e})`, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error('page: ' + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails.text))
  return r.result.value
}
async function waitFor(expr, label, timeout = 12000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    try { if (await evalJs(expr)) return } catch {}
    await sleep(200)
  }
  throw new Error(`waitFor timeout: ${label}`)
}
async function clickPos(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
}
/** 真实鼠标点选（含 elementFromPoint 命中断言）；sel+text 取首个匹配按钮 */
async function clickBtn(sel, text, scope) {
  const pos = await evalJs(`(function(){
    var root = ${scope ? `document.querySelector(${JSON.stringify(scope)})` : 'document'};
    var els = Array.from(root.querySelectorAll(${JSON.stringify(sel)}));
    var el = ${text ? `els.find(function(e){return e.textContent.trim()===${JSON.stringify(text)}})` : 'els[0]'};
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    var r = el.getBoundingClientRect();
    var x = r.x + r.width/2, y = r.y + r.height/2;
    var hit = document.elementFromPoint(x, y);
    if (!(el.contains(hit) || (hit && hit.contains(el)))) return { err: 'hit miss: ' + (hit ? hit.className : 'null') };
    return { x: x, y: y };
  })()`)
  if (!pos) throw new Error(`clickBtn not found: ${sel} [${text ?? ''}]`)
  if (pos.err) throw new Error(`clickBtn ${sel}: ${pos.err}`)
  await clickPos(pos.x, pos.y)
}
/** 健壮填值：匹配 label 文本、且 htmlFor 能解析到真实控件者 */
async function setByLabel(label, val) {
  const r = await evalJs(`(function(){
    var lbl = Array.from(document.querySelectorAll('.vui-base-dialog label'))
      .find(function(l){ return l.textContent.indexOf(${JSON.stringify(label)}) >= 0 && l.htmlFor && document.getElementById(l.htmlFor); });
    if (!lbl) return 'label not found';
    var inp = document.getElementById(lbl.htmlFor);
    var proto = inp.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    var s = Object.getOwnPropertyDescriptor(proto, 'value').set;
    s.call(inp, ${JSON.stringify(val)});
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    return 'ok';
  })()`)
  if (r !== 'ok') throw new Error(`setByLabel(${label}): ${r}`)
}
const inputVal = (label) => evalJs(`(function(){
  var lbl = Array.from(document.querySelectorAll('.vui-base-dialog label'))
    .find(function(l){ return l.textContent.indexOf(${JSON.stringify(label)}) >= 0 && l.htmlFor && document.getElementById(l.htmlFor); });
  return lbl ? document.getElementById(lbl.htmlFor).value : null;
})()`)
// FvTextInput 禁用态=readonly 模拟（原生 disabled 禁复制，组件定稿 2026-10-16）——断言 readonly/aria-disabled
const inputDisabled = (label) => evalJs(`(function(){
  var lbl = Array.from(document.querySelectorAll('.vui-base-dialog label'))
    .find(function(l){ return l.textContent.indexOf(${JSON.stringify(label)}) >= 0 && l.htmlFor && document.getElementById(l.htmlFor); });
  if (!lbl) return null;
  var inp = document.getElementById(lbl.htmlFor);
  return inp.readOnly === true && !!inp.closest('.fv-text-input--disabled');
})()`)
/** 点开关（行内 span 文本定位）并返回切换后的 checked */
async function toggleSwitchByText(txt) {
  const pos = await evalJs(`(function(){
    var span = Array.from(document.querySelectorAll('.vui-base-dialog span')).find(function(s){ return s.textContent.trim() === ${JSON.stringify(txt)}; });
    if (!span) return null;
    var row = span.closest('div');
    var sw = row.querySelector('.v-switch, input[type=checkbox]');
    var r = sw.getBoundingClientRect();
    var x = r.x + r.width/2, y = r.y + r.height/2;
    var hit = document.elementFromPoint(x,y);
    return { x: x, y: y, hitOk: !!(hit && (sw.contains(hit) || hit.contains(sw))) };
  })()`)
  if (!pos) throw new Error(`switch not found: ${txt}`)
  if (!pos.hitOk) throw new Error(`switch hit-test miss: ${txt}`)
  await clickPos(pos.x, pos.y)
  await sleep(350)
  return evalJs(`(function(){
    var span = Array.from(document.querySelectorAll('.vui-base-dialog span')).find(function(s){ return s.textContent.trim() === ${JSON.stringify(txt)}; });
    return span.closest('div').querySelector('input[type=checkbox]').checked;
  })()`)
}

/** 错误徽标验证：定位字段徽标→悬停→读 tooltip 文本与颜色；返回徽标几何信息 */
async function errTipAt(labelName, expectText, mark) {
  const loc = await evalJs(`(function(){
    var lbl=Array.from(document.querySelectorAll('.vui-base-dialog label')).find(function(l){return l.htmlFor && document.getElementById(l.htmlFor) && l.textContent.indexOf(${JSON.stringify(labelName)})>=0});
    if(!lbl) return null;
    var vin=lbl.closest('.v-input');
    var det=vin.querySelector('.v-input__details');
    var badge=det.querySelector('.fv-field__err-badge');
    if(!badge) return { noBadge: true, detDisplay: getComputedStyle(det).display };
    var r=badge.getBoundingClientRect();
    var fld=vin.querySelector('.v-field').getBoundingClientRect();
    var cs=getComputedStyle(badge);
    return { x:r.x+r.width/2, y:r.y+r.height/2, detDisplay:getComputedStyle(det).display,
      n:det.querySelectorAll('.fv-field__err-badge').length,
      size:[Math.round(r.width),Math.round(r.height)], radius:cs.borderRadius, bg:cs.backgroundColor,
      corner: { bubbleBottom: Math.round(r.bottom), fieldTop: Math.round(fld.top), bubbleRight: Math.round(r.right), fieldRight: Math.round(fld.right) },
      fieldH: Math.round(fld.height) };
  })()`)
  if (!loc || loc.noBadge) { check(mark, false, 'no badge ' + JSON.stringify(loc)); return loc }
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: loc.x, y: loc.y })
  await sleep(900)
  const tip = await evalJs(`(function(){
    var t=Array.from(document.querySelectorAll('.vui-field-err-tip')).find(function(x){return x.getClientRects().length>0});
    return t ? JSON.stringify({ txt: t.textContent, color: getComputedStyle(t).color }) : null;
  })()`)
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: loc.x, y: loc.y - 150 })
  await sleep(400)
  const TP = tip ? JSON.parse(tip) : null
  check(mark, !!TP && TP.txt.includes(expectText), TP ? TP.txt.slice(0, 30) : 'no tooltip')
  return { loc, TP }
}

const results = []
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`) }
async function shot(path) { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(path, Buffer.from(r.data, 'base64')) }

// ===== 0. 视口 & 清态 =====
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: 'http://localhost:5173/login' })
await sleep(1600)
await evalJs(`(function(){localStorage.clear();return true})()`)
await send('Page.navigate', { url: 'http://localhost:5173/login' })
await waitFor(`Array.from(document.querySelectorAll('input')).filter(function(i){return i.type==='text'||i.type==='password'}).length>=2`, 'login inputs')

// ===== 1. 登录 admin =====
await evalJs(`(function(){
  var inp = Array.from(document.querySelectorAll('input')).filter(function(i){return i.type==='text'||i.type==='password'});
  var s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  s.call(inp[0], 'admin'); inp[0].dispatchEvent(new Event('input', { bubbles: true }));
  s.call(inp[1], 'passw0rd'); inp[1].dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`)
await sleep(500)
await clickBtn('button[type="submit"]', '登录')
await waitFor(`location.pathname!=='/login'`, 'login redirect')
check('登录 admin 成功', true)

// ===== 2. 策略页基础渲染 =====
await send('Page.navigate', { url: 'http://localhost:5173/security/login-policy' })
await waitFor(`Array.from(document.querySelectorAll('th')).some(function(t){return t.textContent.indexOf('策略 ID')>=0})`, 'policy headers')
await sleep(1200)
const headers = await evalJs(`Array.from(document.querySelectorAll('thead th')).map(function(t){return t.textContent.trim()}).filter(Boolean)`)
const expectCols = ['策略 ID','策略名称','描述','密码最小长度','密码最大长度','密码须含数字','密码须含小写字母','密码须含大写字母','密码须含特殊字符','密码有效天数','账户有效天数','操作']
check('11 数据列+操作列', expectCols.every((c) => headers.includes(c)), headers.join(' | '))
const tbody = () => evalJs(`document.querySelector('tbody').innerText`)
const tb1 = await tbody()
check('种子 3 行（P001/P002/P003）', ['P001','P002','P003'].every((id) => tb1.includes(id)))
check('P003 账户永不过期显示', tb1.includes('永不过期'))
check('布尔列是/否显示', tb1.includes('是') && tb1.includes('否'))
check('P002 特殊字符集合显示（连写 !@#$%&*~）', tb1.includes('!@#$%&*~'), tb1.split('\n').filter((l) => l.includes('!@')).join('').slice(0, 60))
check('P001 不要求特殊字符显示「否」', tb1.includes('否'))
check('New 按钮存在（控件通配授予 admin）', await evalJs(`!!Array.from(document.querySelectorAll('button')).find(function(b){return (b.getAttribute('aria-label')||'').indexOf('新增')>=0})`))
check('无「reactive object」警告（markRaw 生效）', !consoleMsgs.some((m) => m.includes('made a reactive object')))
await shot('/tmp/vui-policy-table.png')

// ===== 3. 搜索过滤（客户端） =====
await evalJs(`(function(){
  var inp = document.querySelector('.vui-policy-search input');
  var s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  s.call(inp, '强策略'); inp.dispatchEvent(new Event('input', { bubbles: true })); return true;
})()`)
await sleep(400)
await clickBtn('button[type="submit"]', null, '.vui-policy-search')
await sleep(500)
let tb = await tbody()
check('搜索「强策略」只剩 P002', tb.includes('P002') && !tb.includes('P001') && !tb.includes('P003'))
await evalJs(`(function(){
  var inp = document.querySelector('.vui-policy-search input');
  var s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  s.call(inp, ''); inp.dispatchEvent(new Event('input', { bubbles: true })); return true;
})()`)
await sleep(400)
await clickBtn('button[type="submit"]', null, '.vui-policy-search')
await sleep(500)

// ===== 3.5 单选选中行样式（2026-10-20 改版：淡主题色底、文字随主题、操作列底色不变） =====
const rowPos = await evalJs(`(function(){
  var tr = Array.from(document.querySelectorAll('tbody tr')).find(function(r){return r.innerText.indexOf('P001')>=0});
  var td = tr.querySelector('td'); var r = td.getBoundingClientRect();
  return { x: r.x + r.width/2, y: r.y + r.height/2 };
})()`)
await clickPos(rowPos.x, rowPos.y)
await sleep(400)
const sel = await evalJs(`(function(){
  var sel_tr = document.querySelector('tbody tr.fv-row--selected');
  if (!sel_tr) return null;
  var bg = getComputedStyle(sel_tr).backgroundColor;
  var c0 = getComputedStyle(sel_tr.querySelector('td')).color;
  var other = Array.from(document.querySelectorAll('tbody tr')).find(function(r){return !r.classList.contains('fv-row--selected') && r.innerText.indexOf('P002')>=0});
  var c1 = getComputedStyle(other.querySelector('td')).color;
  var lastTd = sel_tr.querySelector('td:last-child');
  return JSON.stringify({ bg: bg, selColor: c0, otherColor: c1, lastBg: getComputedStyle(lastTd).backgroundColor });
})()`)
const S = sel ? JSON.parse(sel) : null
// Chrome 155 computed 色值为 color(srgb r g b / a) 现代序列化——按 alpha 通道断言
check('选中行淡主题色底（primary 半透明叠加）', !!S && /\/ 0\.\d/.test(S.bg), S ? S.bg : 'no selected row')
check('选中行文字=主题联动常规色（与非选中行一致）', !!S && S.selColor === S.otherColor, S ? `${S.selColor} vs ${S.otherColor}` : '')
check('操作列底色不随选中变化（不透明微异底）', !!S && !S.lastBg.includes('/'), S ? S.lastBg : '')
await shot('/tmp/vui-policy-selected.png')
await clickPos(rowPos.x, rowPos.y) // 再点取消选中
await sleep(300)
check('再点同行取消选中', await evalJs(`!document.querySelector('tbody tr.fv-row--selected')`))

// ===== 4. 新增全链路（2026-10-20 晚校验口径：长度上下限/最小6/最大18/天数999/特殊字符白名单） =====
const addBtnPos = await evalJs(`(function(){
  var b = Array.from(document.querySelectorAll('button')).find(function(x){return (x.getAttribute('aria-label')||'').indexOf('新增')>=0});
  var r = b.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 };
})()`)
await clickPos(addBtnPos.x, addBtnPos.y)
await waitFor(`!!document.querySelector('.vui-base-dialog')`, 'add dialog')
await sleep(1200)
check('新增弹窗打开', (await evalJs(`document.querySelector('.vui-base-dialog').innerText`)).includes('新增策略'))

// 红星标注（required prop）：必填字段 label 前 *，非必填无
const stars = await evalJs(`(function(){
  var get = function(name){ var l = Array.from(document.querySelectorAll('.vui-base-dialog label')).find(function(x){ return x.htmlFor && document.getElementById(x.htmlFor) && x.textContent.indexOf(name)>=0 }); return l ? l.textContent.trim().startsWith('*') : null };
  return JSON.stringify({ id: get('策略 ID'), name: get('策略名称'), min: get('密码最小长度'), max: get('密码最大长度'), pdays: get('密码有效天数'), adays: get('账户有效天数'), desc: get('描述'), specials: get('特殊字符集合') });
})()`)
const ST = JSON.parse(stars)
check('红星=必填六字段（ID/名称/上下限/双天数）', ST.id && ST.name && ST.min && ST.max && ST.pdays && ST.adays)
check('红星豁免=描述与特殊字符集合（非必填）', ST.desc === false && ST.specials === false, JSON.stringify(ST))

await setByLabel('策略 ID', 'P-TEST')
await setByLabel('策略名称', '验证策略')
await setByLabel('密码最小长度', '6')
await setByLabel('密码最大长度', '12')
await setByLabel('密码有效天数', '-1')
await setByLabel('账户有效天数', '45')
await sleep(400)

// 负例①：max 不大于 min
await setByLabel('密码最大长度', '3')
await sleep(300)
await clickBtn('button', '确认', '.vui-base-dialog')
await sleep(700)
check('负例① 弹窗保留可重试', !!(await evalJs(`document.querySelector('.vui-base-dialog')`)))
const R1 = await errTipAt('密码最大长度', '最大长度须大于最小长度', '负例① 徽标 tooltip 显红色错误文案')
if (R1 && !R1.noBadge) {
  check('徽标=右上角圆形（20×20 border-radius 50%）', R1.loc.size[0] === 20 && R1.loc.size[1] === 20 && R1.loc.radius === '50%', JSON.stringify(R1.loc.size) + ' ' + R1.loc.radius)
  check('徽标右下角贴 field 右上角', Math.abs(R1.loc.corner.bubbleBottom - R1.loc.corner.fieldTop) <= 2 && Math.abs(R1.loc.corner.bubbleRight - R1.loc.corner.fieldRight) <= 2, JSON.stringify(R1.loc.corner))
  check('徽标底=错误色 10% 混配方（红主导）', (() => { const m = R1.loc.bg.match(/color\(srgb ([\d.]+) ([\d.]+)/); return !!m && Number(m[1]) - Number(m[2]) > 0.02 })(), R1.loc.bg)
  check('tooltip 文字为红色系（非白非灰）', !!R1.TP && (() => { const m = R1.TP.color.match(/(\d+)\.?\d*\)/g) || R1.TP.color.match(/rgb\((\d+), (\d+), (\d+)/); const nums = (R1.TP.color.match(/\d+/g) || []).map(Number); return nums.length >= 3 && nums[0] > 150 && nums[0] - nums[1] > 60 })(), R1.TP ? R1.TP.color : '')
  const gate = await evalJs(`(function(){ var lbl=Array.from(document.querySelectorAll('.vui-base-dialog label')).find(function(x){return x.htmlFor && x.textContent.indexOf('策略名称')>=0}); var d=lbl.closest('.v-input').querySelector('.v-input__details'); return getComputedStyle(d).display })()`)
  check('无错误字段不出徽标（策略名称 details 隐藏）', gate === 'none', gate)
  check('控件仍恒 36px 标准高', R1.loc.fieldH === 36, String(R1.loc.fieldH))
}
await setByLabel('密码最大长度', '12')
await sleep(300)

// 负例②：min < 6
await setByLabel('密码最小长度', '4')
await sleep(300)
await clickBtn('button', '确认', '.vui-base-dialog')
await sleep(700)
await errTipAt('密码最小长度', '须为不小于 6 的整数', '负例② min<6 拦截（徽标 tooltip）')
await setByLabel('密码最小长度', '6')
await sleep(300)

// 负例③：天数 > 999
await setByLabel('账户有效天数', '1000')
await sleep(300)
await clickBtn('button', '确认', '.vui-base-dialog')
await sleep(700)
await errTipAt('账户有效天数', '1–999', '负例③ 天数 1000 拦截（1–999）')
await setByLabel('账户有效天数', '45')
await sleep(300)

// 打开须含特殊字符开关 → 集合必填 + 白名单
const sw = await toggleSwitchByText('须含特殊字符')
check('开关「须含特殊字符」切为开', sw === true)
check('开关开后集合解除禁用', (await inputDisabled('特殊字符集合')) === false)
// 提示问号 tooltip：特殊字符集合 label 后图标存在，悬停出提示词（{chars} 插值含 @ 安全）
const qPos = await evalJs(`(function(){
  var lbl = Array.from(document.querySelectorAll('.vui-base-dialog label')).find(function(x){ return x.htmlFor && x.textContent.indexOf('特殊字符集合')>=0 });
  var ic = lbl && lbl.querySelector('.fv-field__hint-icon');
  if (!ic) return null; var r = ic.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 };
})()`)
check('问号图标存在（showHint 开）且占位 label 后', !!qPos)
if (qPos) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: qPos.x, y: qPos.y })
  await sleep(1000)
  const tipShown = await evalJs(`document.body.innerText.indexOf('-_+=!@#$%&*~?') >= 0`)
  check('悬停问号出 tooltip 提示词（含字符集插值）', tipShown)
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: qPos.x, y: qPos.y - 120 })
  await sleep(600)
}
await sleep(300)
await clickBtn('button', '确认', '.vui-base-dialog')
await sleep(700)
await errTipAt('特殊字符集合', '须至少填写一个特殊字符', '负例④ 集合空 → 必填拦截')
await setByLabel('特殊字符集合', '#,(')
await sleep(300)
await clickBtn('button', '确认', '.vui-base-dialog')
await sleep(700)
const R5 = await errTipAt('特殊字符集合', '仅可设定以下特殊字符', '负例⑤ 非白名单字符「(」拦截')
if (R5 && !R5.noBadge) check('⑤ tooltip 含完整白名单字符集', R5.TP && R5.TP.txt.includes('-_+=!@#$%&*~?'), R5.TP ? R5.TP.txt.slice(0, 40) : '')
await shot('/tmp/vui-policy-dialog.png')
await setByLabel('特殊字符集合', '#,%,&')
await sleep(400)
await clickBtn('button', '确认', '.vui-base-dialog')
await waitFor(`document.body.innerText.indexOf('策略已创建')>=0`, 'create toast')
await sleep(500)
tb = await tbody()
check('新增落库回显（P-TEST/验证策略/集合连写 #%&/永不过期）',
  tb.includes('P-TEST') && tb.includes('验证策略') && tb.includes('#%&') && tb.includes('永不过期'))
await waitFor(`!document.querySelector('.vui-base-dialog')`, 'dialog close')

// ===== 5. 编辑：回显 + ID 只读 + 关开关清空集合 =====
const editPos = await evalJs(`(function(){
  var tr = Array.from(document.querySelectorAll('tbody tr')).find(function(r){return r.innerText.indexOf('P-TEST')>=0});
  var b = tr.querySelector('button'); var r = b.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 };
})()`)
await clickPos(editPos.x, editPos.y)
await waitFor(`document.querySelector('.vui-base-dialog') && document.querySelector('.vui-base-dialog').innerText.indexOf('编辑策略')>=0`, 'edit dialog')
await sleep(1200)
check('编辑态 ID 只读', (await inputDisabled('策略 ID')) === true)
check('编辑回显（名称/天数/集合）',
  (await inputVal('策略名称')) === '验证策略' && (await inputVal('密码有效天数')) === '-1' && (await inputVal('特殊字符集合')) === '#,%,&')
await setByLabel('策略名称', '验证策略改名')
const sw2 = await toggleSwitchByText('须含特殊字符')
check('开关切回关', sw2 === false)
check('关开关后集合禁用', (await inputDisabled('特殊字符集合')) === true)
await clickBtn('button', '确认', '.vui-base-dialog')
await waitFor(`document.body.innerText.indexOf('策略已更新')>=0`, 'update toast')
await sleep(600)
tb = await tbody()
check('编辑落库（改名 + 特殊字符回归「否」）', tb.includes('验证策略改名') && !tb.includes('#%&'))

// ===== 6. 删除：确认 → 落库 =====
const delPos = await evalJs(`(function(){
  var tr = Array.from(document.querySelectorAll('tbody tr')).find(function(r){return r.innerText.indexOf('P-TEST')>=0});
  var bs = Array.from(tr.querySelectorAll('button')); var b = bs[bs.length-1];
  var r = b.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 };
})()`)
await clickPos(delPos.x, delPos.y)
await waitFor(`document.body.innerText.indexOf('确认删除登录策略「验证策略改名」')>=0`, 'confirm dialog with name')
await sleep(1200)
await clickBtn('button', 'OK', '.vui-base-dialog')
await waitFor(`document.body.innerText.indexOf('策略已删除')>=0`, 'delete toast')
await sleep(600)
tb = await tbody()
check('删除落库（P-TEST 消失、种子复原 3 行）', !tb.includes('P-TEST') && ['P001','P002','P003'].every((id) => tb.includes(id)))
await shot('/tmp/vui-policy-final.png')

// ===== 7. FvTimer 日期盒内边距同口径（5px 3px，用户定稿 2026-10-20） =====
await send('Page.navigate', { url: 'http://localhost:5173/security/users' })
await waitFor(`!!Array.from(document.querySelectorAll('button')).find(function(b){return (b.getAttribute('aria-label')||'').indexOf('新增')>=0})`, 'users page add btn')
await sleep(800)
const uAdd = await evalJs(`(function(){var b=Array.from(document.querySelectorAll('button')).find(function(x){return (x.getAttribute('aria-label')||'').indexOf('新增')>=0});var r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
await clickPos(uAdd.x, uAdd.y)
await waitFor(`!!document.querySelector('.fv-timer__box')`, 'create-user dialog timer')
await sleep(1000)
const timerCss = await evalJs(`(function(){var b=document.querySelector('.fv-timer__box');var root=document.querySelector('.fv-timer');
return JSON.stringify({pad:getComputedStyle(b).padding,rootMargin:getComputedStyle(root).margin,h:Math.round(b.getBoundingClientRect().height)})})()`)
const T = JSON.parse(timerCss)
check('FvTimer 盒内边距=0、根外边距=3px 3px 7px、盒高恒 36px', T.pad === '0px' && T.rootMargin === '3px 3px 7px' && T.h === 36, timerCss)
const fldCss = await evalJs(`(function(){var f=Array.from(document.querySelectorAll('.vui-base-dialog .fv-text-input')).find(function(x){return x.offsetHeight>0});var cs=getComputedStyle(f);
var inp=f.querySelector('.v-field__field'); var ics=inp?getComputedStyle(inp):null;
return JSON.stringify({margin:cs.margin, padStart: ics?ics.paddingInlineStart:null, h:Math.round(f.querySelector('.v-field').getBoundingClientRect().height)})})()`)
const F = JSON.parse(fldCss)
check('FvTextInput 外边距=3px 3px 7px、内容区左内衬=0、field 高 36px', F.margin === '3px 3px 7px' && F.padStart === '0px' && F.h === 36, fldCss)

console.log('\n===== 汇总 =====')
const fails = results.filter((r) => !r.ok)
console.log(`通过 ${results.length - fails.length}/${results.length}`)
if (fails.length) console.log(fails.map((f) => f.name).join('\n'))
process.exitCode = fails.length ? 1 : 0
ws.close()
