import { computed, ref } from 'vue'

/**
 * 全局接口 Loading 计数（模块级单例，2026-10-17）：
 * shared/api/http 的 request 层管账——调用方传 RequestOptions.loading=true 时，
 * 请求发起前 acquire、该请求落定（成功/失败，含 1s 去重复用）后 release；
 * 计数 > 0 即显示，并发 loading 请求共用同一片浮层，全部落定才消失。
 */
const pending = ref(0)

export const loadingVisible = computed(() => pending.value > 0)

export function acquireLoading(): void {
  pending.value += 1
}

export function releaseLoading(): void {
  pending.value = Math.max(0, pending.value - 1)
}
