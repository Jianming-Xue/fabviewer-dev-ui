import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import {
  fetchCallSysList,
  fetchEnvList,
  fetchIpList,
  fetchLockObjectList,
  fetchRuleInfoPage,
  fetchRuleResultList,
  fetchServerCategoryList,
  type PageRequest,
} from '@/api/log-service/ruleInfo'
import type { RuleInfoDto, RuleSearchRo } from '@/api/log-service/types'
import { minutesAgo, nowMinute, normalizeServerNumbers, toApiTime } from '@/shared/utils/time'

/** 折叠开关状态记忆（§2.6：存浏览器本地） */
const MORE_KEY = 'rule-searching.moreShown'
/** 列设置记忆（§3.3：Lock Object / Call Sys 与可隐列勾选，存浏览器本地） */
const COLUMNS_KEY = 'rule-searching.columns'

export interface ColumnSettings {
  showTotalCost: boolean
  showCostSummary: boolean
  showUnaccounted: boolean
  showExecStatus: boolean
  lockObjects: string[]
  callSys: string[]
}

const DEFAULT_COLUMNS: ColumnSettings = {
  showTotalCost: true,
  showCostSummary: true,
  showUnaccounted: true,
  showExecStatus: false, // EXEC_STATUS 默认不显示，勾选才出（§3.2）
  lockObjects: [],
  callSys: [],
}

function loadColumns(): ColumnSettings {
  try {
    const raw = localStorage.getItem(COLUMNS_KEY)
    if (raw) return { ...DEFAULT_COLUMNS, ...(JSON.parse(raw) as Partial<ColumnSettings>) }
  } catch {
    /* 忽略损坏的本地存储 */
  }
  return { ...DEFAULT_COLUMNS }
}

export const useSearchStore = defineStore('rule-searching', () => {
  // ===== 条件区（默认值见 §2.5「重置」） =====
  const filters = ref({
    env: '',
    serverCategory: '',
    serverNumber: '',
    startTime: minutesAgo(60),
    endTime: nowMinute(),
    ruleName: '',
    tid: '',
    eqpId: '',
    carrierId: '',
    lotId: '',
    minCost: '0',
    maxCost: '999',
    descTime: false,
    // 折叠区 4 项（收起即清空）
    ipaddress: '',
    userId: '',
    errorCode: '',
    ruleResult: '',
  })

  const moreShown = ref(localStorage.getItem(MORE_KEY) === 'true')
  function toggleMore() {
    moreShown.value = !moreShown.value
    localStorage.setItem(MORE_KEY, String(moreShown.value))
    if (!moreShown.value) {
      // 收起那一刻立即清空这 4 项（§2.6）
      filters.value.ipaddress = ''
      filters.value.userId = ''
      filters.value.errorCode = ''
      filters.value.ruleResult = ''
    }
  }

  // ===== 候选 =====
  const options = ref({
    env: [] as string[],
    serverCategory: [] as string[],
    ruleResult: [] as string[],
    lockObject: [] as string[],
    callSys: [] as string[],
    ipaddress: [] as string[],
  })

  async function loadOptions() {
    // Host IP 虽默认收起，进页面照旧调候选接口（§2.3）
    const [env, category, ruleResult, lockObject, callSys, ip] = await Promise.all([
      fetchEnvList(),
      fetchServerCategoryList(),
      fetchRuleResultList(),
      fetchLockObjectList(),
      fetchCallSysList(),
      fetchIpList(),
    ])
    options.value.env = env.env
    options.value.serverCategory = category.serverCategory
    options.value.ruleResult = ruleResult.ruleResult
    options.value.lockObject = lockObject.lockObject
    options.value.callSys = callSys.calledSystem
    options.value.ipaddress = ip.ipaddress
  }

  /** Environment 变化：重取 Host IP 候选并清空已选（§2.7） */
  async function reloadIpOptions(environment: string) {
    const ip = await fetchIpList(environment || undefined)
    options.value.ipaddress = ip.ipaddress
    filters.value.ipaddress = ''
  }

  // ===== 结果列表 =====
  const rows = ref<RuleInfoDto[]>([])
  const total = ref(0)
  const totalPage = ref(1)
  const pageIndex = ref(1)
  const pageSize = ref(20) // 默认 20，档位 20 / 50 / 100（§3.1）
  const loading = ref(false)
  const loadError = ref<unknown>(null)
  /** 是否已查询过（区分「未查询引导」与「空结果」状态，§4.3 六件套） */
  const searched = ref(false)

  /** 选中行：单选，翻页保留；重新 Search / 重置清空（§3.7） */
  const selected = ref<RuleInfoDto | null>(null)

  function buildParams(): RuleSearchRo | null {
    // Server Number 只在点 Search 那一刻校验（§2.8）；非法返回 null 由调用方拦截
    let serverId: string[] | undefined
    if (filters.value.serverCategory) {
      const numbers = normalizeServerNumbers(filters.value.serverNumber)
      if (numbers === null) return null
      if (numbers.length > 0) {
        serverId = numbers.map((n) => `${filters.value.serverCategory}srv.${n}`)
      }
    }
    const f = filters.value
    return {
      env: f.env || undefined,
      serverCategory: f.serverCategory || undefined,
      serverId,
      startTime: toApiTime(f.startTime),
      endTime: toApiTime(f.endTime),
      ruleName: f.ruleName || undefined,
      tid: f.tid || undefined,
      eqpId: f.eqpId || undefined,
      carrierId: f.carrierId || undefined,
      lotId: f.lotId || undefined,
      ipaddress: f.ipaddress || undefined,
      userId: f.userId || undefined,
      errorCode: f.errorCode || undefined,
      ruleResult: f.ruleResult || undefined,
      minCost: f.minCost,
      maxCost: f.maxCost,
      descTime: f.descTime,
    }
  }

  async function search() {
    const params = buildParams()
    if (!params) return false
    return doSearch(1, params)
  }

  async function changePage(page: number) {
    const params = buildParams()
    if (!params) return false
    return doSearch(page, params)
  }

  async function changePageSize(size: number) {
    pageSize.value = size
    return changePage(1)
  }

  async function doSearch(page: number, parameters: RuleSearchRo) {
    loading.value = true
    loadError.value = null
    try {
      const req: PageRequest = { pageIndex: page, pageSize: pageSize.value, parameters }
      const data = await fetchRuleInfoPage(req)
      rows.value = data.contents
      total.value = data.total
      totalPage.value = data.totalPage
      pageIndex.value = data.pageIndex
      searched.value = true
      return true
    } catch (e) {
      loadError.value = e
      return false
    } finally {
      loading.value = false
    }
  }

  /** 重置：条件区恢复进页面默认值；结果清空回未查询态；不自动查询（§2.5） */
  function reset() {
    filters.value = {
      env: '',
      serverCategory: '',
      serverNumber: '',
      startTime: minutesAgo(60),
      endTime: nowMinute(),
      ruleName: '',
      tid: '',
      eqpId: '',
      carrierId: '',
      lotId: '',
      minCost: '0',
      maxCost: '999',
      descTime: false,
      ipaddress: '',
      userId: '',
      errorCode: '',
      ruleResult: '',
    }
    rows.value = []
    total.value = 0
    totalPage.value = 1
    pageIndex.value = 1
    searched.value = false
    loadError.value = null
    selected.value = null
  }

  // ===== 列设置（确认后不重查，就地重渲；本地记忆） =====
  const columns = ref<ColumnSettings>(loadColumns())

  function applyColumns(next: ColumnSettings) {
    columns.value = { ...next }
    localStorage.setItem(COLUMNS_KEY, JSON.stringify(next))
  }

  /** 动态耗时列：Lock + 空格 + 对象名 / Call + 空格 + 系统名（§3.3） */
  const dynamicColumns = computed(() => [
    ...columns.value.lockObjects.map((o) => ({ kind: 'lock' as const, name: o })),
    ...columns.value.callSys.map((c) => ({ kind: 'call' as const, name: c })),
  ])

  return {
    filters,
    moreShown,
    toggleMore,
    options,
    loadOptions,
    reloadIpOptions,
    rows,
    total,
    totalPage,
    pageIndex,
    pageSize,
    loading,
    loadError,
    searched,
    selected,
    search,
    changePage,
    changePageSize,
    reset,
    columns,
    applyColumns,
    dynamicColumns,
  }
})
