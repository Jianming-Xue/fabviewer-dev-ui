/** System Misc 域对象（模块 5 · 02；2026-11-09 新建，Dto/Ro 命名随文档：SystemMiscDto / ChangeSystemMiscValueRo，
 *  与 srvHangConfigTypes 分域惯例一致）：服务公共壳（PageRo/PageDto/TelemetryReplyDto）留 ./types。
 *  行键即 item（出参无 id）；value/defaultValue 按 valueType **还原为原生类型**上送（文档 §5.3：
 *  Boolean=布尔、Integer=int、Float=number、Json=真数组/对象，非序列化字符串；库存文本由后端负责转换）。 */

/** 值类型枚举（库表 valueType 列，必填无默认） */
export type SystemMiscValueType = 'Boolean' | 'Text' | 'Integer' | 'Float' | 'Json'

/** Json 三形态（§四）：List<string> / Map<string,string> / Map<string,List<string>>；不允许嵌套 Map */
export type SystemMiscJsonList = string[]
export type SystemMiscJsonMap = Record<string, string | string[]>

/** wire 值联合：按 valueType 还原后的原生形态；null = 空值（Boolean 的 defaultValue 不可为空） */
export type SystemMiscValue = boolean | string | number | SystemMiscJsonList | SystemMiscJsonMap | null

/** System Misc 条目（§5.3 出参；审计四字段 createdAt/By + updatedAt/By，时间为 UI 可读格式——
 *  入站 wire 解码归请求层 decodeRow，srvHangConfig 同口径） */
export interface SystemMiscDto {
  item: string
  category: string
  description: string | null
  valueType: SystemMiscValueType
  value: SystemMiscValue
  defaultValue: SystemMiscValue
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
}

/** PUT 提交体（§5.2）：item 为唯一定位键；category/description/valueType 不可改、不入参；
 *  value/defaultValue 按库内 valueType 校验（Boolean 忽略 defaultValue） */
export interface ChangeSystemMiscValueRo {
  item: string
  value?: SystemMiscValue
  defaultValue?: SystemMiscValue
}
