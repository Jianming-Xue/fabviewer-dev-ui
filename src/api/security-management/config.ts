/**
 * security-management 服务配置（2026-10-17 定稿：本文件只声明服务名；
 * Host 不逐服务写死，由全局链解析——运行时 app-config.json > 构建 env FV_APP_HOST > 内置兜底，
 * 仅当某服务确需编译期专属 Host 时才填 ServiceConfig.host）。
 * 另兼本服务 Mock 注册点（项目约定 2026-10-18：Mock 一律收在 api 层——
 * config 是服务调用链的必经静态 import，先于任何接口发起完成装载；UI 模块不再挂 mock）。
 */
import type { ServiceConfig } from '@/shared/api/http'

// Mock 处理器：仅 VITE_MOCK=true 时加载（构建期静态替换 → 生产包不含 mock 代码）
if (import.meta.env.VITE_MOCK === 'true') {
  await import('./authMock')
  await import('./roleMock')
  await import('./policyMock')
  await import('./userMock')
}

const config: ServiceConfig = {
  service: 'security-management',
}

export default config
