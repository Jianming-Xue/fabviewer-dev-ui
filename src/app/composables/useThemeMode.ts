import { computed } from 'vue'
import { useTheme } from 'vuetify'

const THEME_KEY = 'vui.theme' // 与 index.html 防闪白脚本共用
let initialized = false

/**
 * 明暗双模式（05 规范 §五）：默认跟随系统，顶栏手动切换，选择本地持久化。
 * 幂等初始化：App.vue 与 FvShell 都会调用，监听器只注册一次。
 */
export function useThemeMode() {
  const theme = useTheme()
  const html = document.documentElement

  function apply(dark: boolean) {
    theme.change(dark ? 'dark' : 'light') // Vuetify 4 API
    html.classList.toggle('vui-dark', dark)
    html.classList.toggle('vui-light', !dark)
  }

  if (!initialized) {
    initialized = true
    // 启动时与防闪白脚本的判定对齐
    apply(
      localStorage.getItem(THEME_KEY) === 'dark' ||
        (localStorage.getItem(THEME_KEY) === null && html.classList.contains('vui-dark')),
    )
    // 未手动选择过时，跟随系统变化
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (localStorage.getItem(THEME_KEY) === null) apply(e.matches)
    })
  }

  function toggle() {
    const next = !theme.global.current.value.dark
    localStorage.setItem(THEME_KEY, next ? 'dark' : 'light')
    apply(next)
  }

  return { toggle, isDark: computed(() => theme.global.current.value.dark) }
}
