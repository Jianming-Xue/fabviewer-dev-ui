/**
 * 模块注册契约实体（shared 层，2026-10-15）：app 与 modules 两层共用。
 * 模块自描述：菜单模块名/图标/URL/功能树；功能带完整 URL（权限匹配）、排序、
 * 可嵌套子功能（带 children 即为功能组——不是实际功能、没有路由），
 * 并可登记页内受管控控件（名称/ID/类型）。菜单/路由/权限目录由功能树派生。
 */

/** 词典：嵌套对象，叶子为字符串（模板零硬编码文案，05 §4.6） */
export type FvDict = { [key: string]: string | FvDict }

/** 模块私有词典：随模块装卸 */
export interface FvModuleMessages {
  'zh-CN': FvDict
  'en-US': FvDict
}

/** 受管控控件：功能页内可被权限系统显隐/禁用的最小单元 */
export interface FvManagedControl {
  /** 控件 ID（权限系统引用；建议『模块.功能.控件』命名空间） */
  id: string
  /** 控件名称（i18n 键） */
  key: string
  /** 控件类型（权限端分组展示用） */
  type?: 'button' | 'field' | 'action' | 'other'
}

/** 功能：叶子 = 实际功能页（必有完整 URL 与页面组件）；带 children = 功能组（无路由）。
 *  id 全局唯一（用户定稿 2026-10-16）。children 非空 = 功能组：此时 controls 配置一律失效
 *  （控件只登记在叶子功能上） */
export interface FvFeature {
  /** 功能/功能组 ID（全局唯一） */
  id: string
  /** 功能名（i18n 词典键） */
  key: string
  /** 完整 URL（以 / 开头，权限管理匹配用）；仅叶子功能填写 */
  url?: string
  /** 页面组件（懒加载）；仅叶子功能填写 */
  component?: import('vue-router').RouteRecordRaw['component']
  /** 同级排序（默认 0，升序） */
  order?: number
  /** 嵌套子功能：存在即本项为功能组 */
  children?: FvFeature[]
  /** 本功能页内受管控控件清单 */
  controls?: FvManagedControl[]
}

/** 模块自描述 manifest */
export interface FvModule {
  id: string
  /** 模块名（菜单一级显示，i18n 键） */
  key: string
  /** 一级菜单图标（FA 类名） */
  icon: string
  /** 模块 URL（功能 URL 的公共前缀；权限目录同时登记模块层 URL） */
  url: string
  /** 模块排序（默认 0，升序） */
  order?: number
  /** UI 模块版本号（2026-10-17）：随请求交易头 txId 末段下发，后端据此识别哪个 UI 哪个版本发的请求 */
  version: string
  /** 功能列表：菜单（二级起）/ 路由 / 权限目录的唯一样本 */
  features: FvFeature[]
  /** 模块私有词典（键名以模块 id 为命名空间） */
  messages: FvModuleMessages
}

/* 2026-10-16 收敛：FvNavNode / FvPermissionEntry / FvPermissionFeatureNode /
   FvPermissionModuleNode 四个派生投影类型已删除——导航直接消费过滤后的 FvModule/FvFeature
   （FvShell/FvNavItem），权限树适配器直接遍历 registry.getModules()；
   权限目录 getPermissionCatalog 零消费方一并移除。核心模型三件套即全部契约。 */
