/**
 * 登录策略业务对象（security-management 服务，2026-10-19 新增）：
 * 命名遵循项目规则——请求体 Ro 结尾、返回对象 Dto 结尾（见 CLAUDE.md）。
 * 本期仅列表消费（新增/编辑用户弹窗的策略下拉）；策略管理页后续迭代实现。
 */

/** 登录策略返回对象 */
export interface PolicyDto {
  policyId: string
  policyName: string
  description: string
}
