import type { RouteRecordRaw } from 'vue-router'

import type { FvDict, FvFeature, FvModule, FvModuleMessages } from '@/shared/module'

import configModule from './config'
import ruleSearchingModule from './rule-searching'
import securityModule from './security'

/**
 * 模块注册表（2026-10-15）：契约实体在 shared/module（Fv 前缀），
 * 本文件只对外暴露方法——菜单 / 路由 / 权限目录 / 权限树 / 词典聚合，全部由功能树派生。
 * 装一个模块 = 新增目录 + 下方数组加一行；卸载 = 删掉那行（菜单/路由/词典/权限目录随失）。
 */
const modules: FvModule[] = [
  ruleSearchingModule, // 日志检索与分析 · MES Rule 信息检索
  securityModule, // 用户和安全管理 · 用户/角色/登录策略
  configModule, // 系统管理 · Server Hang Reason Config
]

/* ===== 菜单：模块根一级 + 功能树（Home 由应用壳补充在最前） =====
   isGranted（可选）：功能权限谓词（URL 命中即放行）。传入时按权限过滤——
   命中模块/功能组 URL → 其下全部功能放行；命中功能 URL → 仅该功能；
   模块/功能组下无任何有权限功能 → 整组不显示。不传 = 全量（管理端/未启用权限场景）。 */

function filterFeatures(features: FvFeature[], grantedChain: string[], isGranted?: (url: string) => boolean): FvFeature[] {
  return [...features]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((f): FvFeature | null => {
      // 祖先链上的 URL（模块/功能组自身 URL）对整棵子树生效；功能组无 URL 时仅透传链
      const chain = f.url ? [...grantedChain, f.url] : grantedChain
      if (f.children?.length) {
        const children = filterFeatures(f.children, chain, isGranted)
        return children.length ? { ...f, children } : null
      }
      const visible = isGranted ? chain.some((url) => isGranted(url)) : true
      return visible ? f : null
    })
    .filter((f): f is FvFeature => f !== null)
}

/** 菜单模型：过滤后的模块清单（模块根一级 + 功能树；Home 由应用壳补在最前）。
 *  直接复用核心模型 FvModule/FvFeature（2026-10-16 收敛，不再有 FvNavNode 投影） */
export function getNavModules(isGranted?: (url: string) => boolean): FvModule[] {
  return modules
    .map((m): FvModule | null => {
      const chain = [m.url] // 模块 URL 放行 → 整模块可见
      const features = filterFeatures(m.features, chain, isGranted)
      return features.length ? { ...m, features } : null
    })
    .filter((m): m is FvModule => m !== null)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

/** UI 壳（app 层）版本：非模块路由（登录/首页等）发起的请求以此版本下发 */
export const APP_VERSION = '1.0.0'

/** 模块 UI 版本（交易头 txId 末段来源，2026-10-17） */
export function getModuleVersion(id: string): string {
  return modules.find((m) => m.id === id)?.version ?? APP_VERSION
}

/** 模块清单原样暴露（权限树适配器等消费方自行遍历功能树） */
export function getModules(): readonly FvModule[] {
  return modules
}


/* ===== 路由：收集叶子功能的 url + component ===== */

function collectRoutes(m: FvModule, features: FvFeature[], out: RouteRecordRaw[]) {
  for (const f of features) {
    if (f.children?.length) {
      collectRoutes(m, f.children, out)
      continue
    }
    if (!f.url || !f.component) continue // 组或未注册页面的项不产路由
    // 路由名：URL slug（已是模块前缀则直接用，保持与历史命名一致）
    const slug = f.url.split('/').filter(Boolean).join('-')
    out.push({
      path: f.url,
      name: slug.startsWith(m.id) ? slug : `${m.id}-${slug}`,
      component: f.component,
      meta: { titleKey: f.key, rootKey: m.key, moduleId: m.id },
    })
  }
}

export function getRoutes(): RouteRecordRaw[] {
  const out: RouteRecordRaw[] = []
  for (const m of modules) collectRoutes(m, m.features, out)
  return out
}

/* 权限目录 / 权限配置树投影已于 2026-10-16 删除：目录零消费方；权限树适配器
   （modules/security/components/PermissionTree.vue）直接遍历 getModules() 的功能树。 */

/* ===== 词典聚合：各模块私有词典按语言合并（模块卸载词条随失） ===== */

export function getMessages(): FvModuleMessages {
  const zh: FvDict = {}
  const en: FvDict = {}
  for (const m of modules) {
    Object.assign(zh, m.messages['zh-CN'])
    Object.assign(en, m.messages['en-US'])
  }
  return { 'zh-CN': zh, 'en-US': en }
}
