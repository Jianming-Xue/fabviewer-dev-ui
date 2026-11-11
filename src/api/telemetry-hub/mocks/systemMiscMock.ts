import { registerMock } from '@/shared/api/mock'

import type { TelemetryReplyDto } from '../types/types'
import type {
  ChangeSystemMiscValueRo,
  SystemMiscDto,
  SystemMiscValue,
  SystemMiscValueType,
} from '../types/systemMiscTypes'

/**
 * System Misc Mock（telemetry-hub 服务，模块5 · 02，2026-11-09 新建）：
 * 出参统一壳 { code, success, errMsg, data, txId }（srvHangConfigMock 同口径，txId 一律空串回显）。
 * 内存态即 **wire 视角**：value/defaultValue 按 valueType 还原为原生类型（boolean/number/string/真数组或对象，
 * 文档 §5.3——库内文本化存储与 Boolean 大写 TRUE/FALSE 归后端，Mock 不扮演）；审计时间说 wire（YYYYMMDDHHmmss），
 * 入站解码归请求层。PUT 按 valueType 校验不符即拒（success:false + errMsg）；六个候选值接口实现 §6.1~6.3
 * 取数逻辑（value → defaultValue 降级 → []，去重+字典序；ipaddress 支持 environment 过滤/合并）。
 * 种子覆盖五种 valueType + §六全部六个源 item（业务命名真实、不用占位符）。
 */
const ok = <T>(data: T): TelemetryReplyDto<T> => ({ code: 'OK', success: true, errMsg: '', data, txId: '' })
const fail = (errMsg: string): TelemetryReplyDto<null> => ({ code: 'FAIL', success: false, errMsg, data: null, txId: '' })

/** 内存态配置集（行键即 item；类目三组 Global/Rule/Log 演练左侧类目过滤） */
const miscRows: SystemMiscDto[] = [
  {
    item: 'mes.global.environments',
    category: 'Global',
    description: '全局环境清单（env/list 候选源，List 形态）',
    valueType: 'Json',
    value: ['PROD', 'PIRUN'],
    defaultValue: [],
    createdAt: '20261013162011',
    createdBy: 'DBA',
    updatedAt: '20261101101530',
    updatedBy: 'MORRISLI',
  },
  {
    item: 'mes.global.ipaddresses',
    category: 'Global',
    description: '各环境 Host IP 清单（ipaddress/list 候选源，Map 形态）',
    valueType: 'Json',
    value: { PROD: ['10.18.100.1', '10.18.100.2'], PIRUN: '10.18.101.5' },
    defaultValue: {},
    createdAt: '20261013162011',
    createdBy: 'DBA',
    updatedAt: '20261102093000',
    updatedBy: 'TANYU',
  },
  {
    item: 'mes.global.servercategories',
    category: 'Global',
    description: 'Server Category 候选（server_category/list 源）',
    valueType: 'Json',
    value: ['FAB', 'TEST', 'ASSY'],
    defaultValue: [],
    createdAt: '20261013162011',
    createdBy: 'DBA',
    updatedAt: '20261013162011',
    updatedBy: 'DBA',
  },
  {
    item: 'mes.global.maintenancemode',
    category: 'Global',
    description: '平台维护模式总开关（Boolean 演练：卡片开关 + 二次确认）',
    valueType: 'Boolean',
    value: true,
    defaultValue: false,
    createdAt: '20261013162011',
    createdBy: 'DBA',
    updatedAt: '20261105141200',
    updatedBy: 'MORRISLI',
  },
  {
    item: 'mes.global.readonlymode',
    category: 'Global',
    description: '平台只读模式总开关（Boolean 假态演练：卡片开关关位）',
    valueType: 'Boolean',
    value: false,
    defaultValue: false,
    createdAt: '20261013162011',
    createdBy: 'DBA',
    updatedAt: '20261013162011',
    updatedBy: 'DBA',
  },
  {
    item: 'mes.global.supportcontact',
    category: 'Global',
    description: '平台支持联系方式（Text 演练：长文本 20 字截断 + tooltip）',
    valueType: 'Text',
    value: 'fab-support@example.com（内线 8000，7×24 值守）',
    defaultValue: 'fab-support@example.com',
    createdAt: '20261013162011',
    createdBy: 'DBA',
    updatedAt: '20261020110000',
    updatedBy: 'TANYU',
  },
  {
    item: 'mes.global.notice',
    category: 'Global',
    description: '平台公告文本（Text 空值演练：卡片显「（未设置）」占位，defaultValue 有值不回落到卡片）',
    valueType: 'Text',
    value: null,
    defaultValue: '计划维护窗口：周日 02:00-04:00',
    createdAt: '20261013162011',
    createdBy: 'DBA',
    updatedAt: '20261013162011',
    updatedBy: 'DBA',
  },
  {
    item: 'mes.global.serviceowners',
    category: 'Global',
    description: '各服务负责人映射（Json Map<string,string> 标量值形态演练：每 key 单值显示一行）',
    valueType: 'Json',
    value: { MES: 'ZhangWei', EAP: 'LiNa', SPC: 'WangFang' },
    defaultValue: {},
    createdAt: '20261013162011',
    createdBy: 'DBA',
    updatedAt: '20261031150000',
    updatedBy: 'MORRISLI',
  },
  {
    item: 'system.global.priority',
    category: 'Global',
    description: '告警优先级候选（priority/list 源，模块2 · 01/03 配置页 Priority 下拉，List 形态）',
    valueType: 'Json',
    value: ['P1', 'P2', 'P3', 'P4'],
    defaultValue: [],
    createdAt: '20261013162011',
    createdBy: 'DBA',
    updatedAt: '20261013162011',
    updatedBy: 'DBA',
  },
  {
    item: 'mes.rule.results',
    category: 'Rule',
    description: 'Rule Result 候选（rule_result/list 源）',
    valueType: 'Json',
    value: ['Pass', 'Fail', 'Abort'],
    defaultValue: ['Fail'],
    createdAt: '20261013162011',
    createdBy: 'DBA',
    updatedAt: '20261030164500',
    updatedBy: 'MORRISLI',
  },
  {
    item: 'mes.rule.lockedobjects',
    category: 'Rule',
    description: 'Lock Object 候选（lock_object/list 源）',
    valueType: 'Json',
    value: ['Lot', 'Wafer', 'Cassette'],
    defaultValue: [],
    createdAt: '20261013162011',
    createdBy: 'DBA',
    updatedAt: '20261013162011',
    updatedBy: 'DBA',
  },
  {
    item: 'mes.rule.calledsystems',
    category: 'Rule',
    description: 'Call Sys 候选（call_sys/list 源）',
    valueType: 'Json',
    value: ['EAP', 'MCS', 'SPC'],
    defaultValue: [],
    createdAt: '20261013162011',
    createdBy: 'DBA',
    updatedAt: '20261013162011',
    updatedBy: 'DBA',
  },
  {
    item: 'mes.rule.scorethreshold',
    category: 'Rule',
    description: 'Rule 评分阈值（Float 演练：浮点校验）',
    valueType: 'Float',
    value: 0.85,
    defaultValue: 0.5,
    createdAt: '20261013162011',
    createdBy: 'DBA',
    updatedAt: '20261103101010',
    updatedBy: 'TANYU',
  },
  {
    item: 'mes.log.retentiondays',
    category: 'Log',
    description: null, // description 可空演练（卡片左下省略区空态）
    valueType: 'Integer',
    value: 30,
    defaultValue: 7,
    createdAt: '20261013162011',
    createdBy: 'DBA',
    updatedAt: '20261013162011',
    updatedBy: 'DBA',
  },
]

/** 审计时间：Mock 扮演后端直接说 wire（YYYYMMDDHHmmss，srvHangConfigMock 同口径） */
function now(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

/** 审计用户（演示口径）：取登录会话持久化的用户名，未登录回落 MOCK_USER */
function currentUser(): string {
  try {
    return JSON.parse(localStorage.getItem('vui.auth') ?? '').user?.userName ?? 'MOCK_USER'
  } catch {
    return 'MOCK_USER'
  }
}

/* ===== PUT 校验（§四：按 valueType 不符即拒；长度按字符数） ===== */

/** Json 三形态判定（§四）：List<string> / Map<string,string> / Map<string,List<string>>；不允许嵌套 Map */
function isJsonShape(v: unknown): v is string[] | Record<string, string | string[]> {
  if (Array.isArray(v)) return v.every((x) => typeof x === 'string')
  if (v && typeof v === 'object') {
    return Object.values(v as Record<string, unknown>).every(
      (x) => typeof x === 'string' || (Array.isArray(x) && x.every((y) => typeof y === 'string')),
    )
  }
  return false
}

/** 单值校验：返回错误文案，null = 通过。isDefault 用于 Boolean defaultValue 特例（不可空但页面不可编、PUT 忽略） */
function validateValue(type: SystemMiscValueType, v: SystemMiscValue | undefined, field: string): string | null {
  if (v === undefined || v === null) return null // 各型 value/defaultValue 均可空（Boolean defaultValue 除外，且 PUT 层已忽略）
  switch (type) {
    case 'Boolean':
      return typeof v === 'boolean' ? null : `${field} 须为布尔值（true/false）`
    case 'Text':
      return typeof v === 'string'
        ? v.length <= 4000
          ? null
          : `${field} 超长（≤4000 字符）`
        : `${field} 须为文本`
    case 'Integer':
      return typeof v === 'number' && Number.isInteger(v) ? null : `${field} 须为整数`
    case 'Float':
      return typeof v === 'number' && Number.isFinite(v) ? null : `${field} 须为浮点数`
    case 'Json': {
      if (!isJsonShape(v)) return `${field} 须为 Json 三形态之一（List<string> / Map<string,string> / Map<string,List<string>>）`
      const top = Array.isArray(v) ? v.length : Object.keys(v).length
      if (top > 100) return `${field} 顶层条目超限（≤100）`
      if (JSON.stringify(v).length > 4000) return `${field} 序列化超长（≤4000 字符）`
      return null
    }
  }
}

/** Json 空置 []（§5.2 逻辑第 3 步）；Boolean 大写存储归后端、Mock 内存态保持原生布尔 */
function normalize(type: SystemMiscValueType, v: SystemMiscValue | undefined): SystemMiscValue {
  if (type === 'Json' && (v === undefined || v === null)) return []
  return v === undefined ? null : v
}

/* ===== §六 候选值取数（6.1~6.3） ===== */

/** 按形态抽取字符串：List → 全元素；Map → environment 传入只取该 key、不传合并全部；非法结构视同空（§6.2） */
function extractCandidates(v: SystemMiscValue, environment?: string): string[] {
  if (Array.isArray(v)) return v
  if (v && typeof v === 'object') {
    const map = v as Record<string, string | string[]>
    if (environment) {
      const hit = map[environment]
      return typeof hit === 'string' ? [hit] : Array.isArray(hit) ? hit : []
    }
    return Object.values(map).flatMap((x) => (typeof x === 'string' ? [x] : x))
  }
  return []
}

/** 候选取数（§6.1）：value 解析 → 空则 defaultValue 同逻辑 → 仍空回 []；恒去重+字典序排序 */
function miscCandidates(item: string, environment?: string): string[] {
  const row = miscRows.find((r) => r.item === item)
  if (!row) return []
  let out = extractCandidates(row.value, environment)
  if (!out.length) out = extractCandidates(row.defaultValue, environment)
  return [...new Set(out)].sort()
}

/* ===== handlers ===== */

registerMock('GET', '/telemetry-hub/api/v1/sys_misc/category/list', () =>
  ok([...new Set(miscRows.map((r) => r.category))].sort()),
)

// §5.1：category 可选等值过滤（空=全表）；item 升序；无分页
registerMock('GET', '/telemetry-hub/api/v1/sys_misc/list', ({ params }) => {
  const category = params?.category === undefined ? '' : String(params.category)
  const rows = category ? miscRows.filter((r) => r.category === category) : miscRows
  return ok([...rows].sort((a, b) => a.item.localeCompare(b.item)))
})

// §5.2：item 定位、按 valueType 校验不符即拒；Boolean 忽略 defaultValue；只更新 value/defaultValue + 审计；回整条。
// Ro 两字段可选（§5.2 入参表）：未出现的字段保持原值不动，出现（含显式 null=置空）才校验并落库
registerMock('PUT', '/telemetry-hub/api/v1/sys_misc', ({ body }) => {
  const input = body as unknown as ChangeSystemMiscValueRo
  const row = miscRows.find((r) => r.item === input?.item)
  if (!row) return fail('配置项不存在')
  if ('value' in input) {
    const valueErr = validateValue(row.valueType, input.value, 'value')
    if (valueErr) return fail(valueErr)
    row.value = normalize(row.valueType, input.value)
  }
  // Boolean 型忽略 defaultValue（文档 §5.2：该型 defaultValue 不可空且页面不可编，入参直接丢弃）
  if (row.valueType !== 'Boolean' && 'defaultValue' in input) {
    const defaultErr = validateValue(row.valueType, input.defaultValue, 'defaultValue')
    if (defaultErr) return fail(defaultErr)
    row.defaultValue = normalize(row.valueType, input.defaultValue)
  }
  row.updatedAt = now()
  row.updatedBy = currentUser()
  return ok(row)
})

/* ===== §六 六个候选值端点（活引用 miscRows：页面改值即时反映到候选） ===== */

registerMock('GET', '/telemetry-hub/api/v1/sys_misc/env/list', () => ok(miscCandidates('mes.global.environments')))

registerMock('GET', '/telemetry-hub/api/v1/sys_misc/ipaddress/list', ({ params }) =>
  ok(miscCandidates('mes.global.ipaddresses', params?.environment === undefined ? undefined : String(params.environment))),
)

registerMock('GET', '/telemetry-hub/api/v1/sys_misc/server_category/list', () =>
  ok(miscCandidates('mes.global.servercategories')),
)

registerMock('GET', '/telemetry-hub/api/v1/sys_misc/rule_result/list', () => ok(miscCandidates('mes.rule.results')))

registerMock('GET', '/telemetry-hub/api/v1/sys_misc/lock_object/list', () => ok(miscCandidates('mes.rule.lockedobjects')))

registerMock('GET', '/telemetry-hub/api/v1/sys_misc/call_sys/list', () => ok(miscCandidates('mes.rule.calledsystems')))

// 告警优先级候选（模块2 · 01 §4.1-6，2026-11-10 新增）：value→defaultValue 降级→[]，去重+字典序同 §6.1
registerMock('GET', '/telemetry-hub/api/v1/sys_misc/priority/list', () => ok(miscCandidates('system.global.priority')))
