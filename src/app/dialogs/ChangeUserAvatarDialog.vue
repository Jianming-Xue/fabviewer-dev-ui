<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTheme } from 'vuetify'

import FvInteractiveDialog from '@/shared/dialog/FvInteractiveDialog.vue'
import FvTab from '@/shared/components/FvTab.vue'
import FvUserAvatar from '@/shared/components/FvUserAvatar.vue'

import type { FvTabItem } from '@/shared/components/FvTab.vue'
import { showOpError } from '@/shared/api/opError'
import { updateUserAttribute } from '@/api/security-management/requests/userRequest'
import { useAuthStore } from '@/app/stores/auth'

/**
 * 用户头像修改弹窗（2026-10-22 定稿，经 openInteractiveDialog 从用户信息弹窗点击头像打开，
 * 宿主层叠机制下叠于其上方）：
 * 无标题（标题区整体隐藏）；左侧=唯一大头像预览——修改后的头像直接覆盖原头像呈现，
 * 未动过任何选项时恒显现有头像原样（含 avatar='' 的缺省字母形态，2026-10-22 补充定稿）；
 * 右侧=修改方式三选（FvTab 自绘 Tab 条）：
 *  ① 字母：用户名首字母大写（中文取首字），底色默认主题色、字色默认系统字体色，两类颜色均可改；
 *    提交 {"mode":"username","bg":"","fg":""}（空串=用默认）；
 *  ② 表情：预设 emoji 中选一，底色默认主题色；提交 {"mode":"emoji","emoji":"🚀"}；
 *  ③ 图片：预留禁用（先做前两类，图片口径定后开放）。
 * Confirm 恒可提交「呈现出来的头像」（未动过=现有头像原样），POST /users/attribute attName=avatar；
 * Cancel/关闭 = 弃改动（无结果）。提交收口本组件（同 EditUserAttributeDialog 模式）：失败 showOpError、可重试。
 */
const props = defineProps<{ current: string }>()

const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ resolve: [avatar: string] }>()

const { t } = useI18n()
const auth = useAuthStore()
const theme = useTheme()
const saving = ref(false)

/** 预设 emoji 池（演示定档，②模式选一） */
const EMOJI_LIST = ['😀', '😎', '🤖', '🚀', '⚙️', '🔧', '📡', '💡', '⭐', '🦾', '🛠️', '🖥️']
/** 底色预设（''=默认主题色；行尾另有自由色板，2026-10-22 去白色档） */
const BG_COLORS = ['', '#1E88E5', '#8E24AA', '#D81B60', '#43A047', '#FB8C00', '#546E7A', '#212121']
/** 字色预设（''=默认系统字体色；行尾另有自由色板，2026-10-22 去白色档） */
const FG_COLORS = ['', '#212121', '#FFD54F', '#40C4FF']

/** 两默认档的实际色值（自由色板初显用；取当前主题，明暗切换自动跟随） */
function themeColor(name: string, fallback: string): string {
  const v = theme.current.value.colors[name as keyof typeof theme.current.value.colors]
  return typeof v === 'string' ? v : fallback
}
const primaryHex = computed(() => themeColor('primary', '#1976D2'))
const onSurfaceHex = computed(() => themeColor('on-surface', '#212121'))

/** 底色/字色自由色板桥接：''（默认档）显示为实际主题色；选取即覆写并置 touched */
function useColorBridge(get: () => string, set: (v: string) => void, fallback: () => string) {
  return computed({
    get: () => get() || fallback(),
    set: (v: unknown) => {
      // v-color-picker（mode=hex）回传字符串；带 alpha 的 hexa/对象值一律忽略不覆写
      if (typeof v === 'string' && v) {
        set(v)
        touch()
      }
    },
  })
}
const bgPick = useColorBridge(() => bg.value, (v) => (bg.value = v), () => primaryHex.value)
const fgPick = useColorBridge(() => fg.value, (v) => (fg.value = v), () => onSurfaceHex.value)

interface AvatarCfg {
  mode?: string
  bg?: string
  fg?: string
  emoji?: string
}

function parseCfg(raw: string): AvatarCfg | null {
  const s = raw.trim()
  if (!s.startsWith('{')) return null
  try {
    return JSON.parse(s) as AvatarCfg
  } catch {
    return null
  }
}

const init = parseCfg(props.current)
/** 选项区模式（'image' 预留未开放） */
const mode = ref(init?.mode === 'emoji' ? 'emoji' : 'username')
const bg = ref(init?.mode === 'username' ? (init.bg ?? '') : '')
const fg = ref(init?.mode === 'username' ? (init.fg ?? '') : '')
const emoji = ref(init?.mode === 'emoji' && EMOJI_LIST.includes(init.emoji ?? '') ? init.emoji! : EMOJI_LIST[0])
/** 用户是否动过选项：未动过=呈现现有头像原样（avatar 空则即缺省字母形态） */
const touched = ref(false)

/** 方式三选 Tab 项（③图片预留禁用，2026-10-22 先做前两类） */
const modeTabs = computed<FvTabItem[]>(() => [
  { title: t('topbar.avatarModeLetter'), value: 'username' },
  { title: t('topbar.avatarModeEmoji'), value: 'emoji' },
  { title: t('topbar.avatarModeImage'), value: 'image', disabled: true },
])

function touch() {
  touched.value = true
}

/** 呈现即提交口径：序列化当前选择；未动过则原样回传 current */
const shown = computed(() => {
  if (!touched.value) return props.current
  return mode.value === 'emoji'
    ? JSON.stringify({ mode: 'emoji', emoji: emoji.value })
    : JSON.stringify({ mode: 'username', bg: bg.value, fg: fg.value })
})

async function save() {
  if (saving.value) return
  saving.value = true
  try {
    await updateUserAttribute({ userId: auth.userName, attName: 'avatar', attValue: shown.value })
    emit('resolve', shown.value)
    open.value = false
  } catch (e) {
    showOpError(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <FvInteractiveDialog v-model="open" :max-width="460" class="vui-avatar-dialog">
    <div class="vui-avatar">
      <!-- 唯一预览：修改后的头像直接覆盖原头像呈现 -->
      <FvUserAvatar
        :avatar="shown"
        :user-name="auth.user.userName"
        :fallback-name="auth.profile.nickName || auth.profile.name"
        :size="96"
      />
      <div class="vui-avatar__side">
        <FvTab v-model="mode" :items="modeTabs" @update:model-value="touch" />
        <!-- 内容框：FvTable 档描边+圆角（--vui-border/--vui-radius-s），Tab 切换只换框内内容 -->
        <div class="vui-avatar__panel">
          <!-- 字母模式（2026-10-22 调版）：一行两组——左=底色、右=字体色，不带文字标签（空串=默认档；
               组尾自由色板钮点开 v-color-picker 任选） -->
          <div v-if="mode === 'username'" class="vui-avatar__colors">
            <div class="vui-avatar__swatches">
              <button
                v-for="(c, i) in BG_COLORS"
                :key="`bg-${i}`"
                type="button"
                class="vui-avatar__swatch"
                :class="{ 'vui-avatar__swatch--on': bg === c }"
                :style="{ background: c || 'rgb(var(--v-theme-primary))' }"
                :title="c || t('topbar.avatarColorDefault')"
                @click="bg = c; touch()"
              />
              <v-menu>
                <template #activator="{ props: pickProps }">
                  <button
                    type="button"
                    class="vui-avatar__swatch"
                    :style="{ background: bg || primaryHex }"
                    :title="t('topbar.avatarColorCustom')"
                    v-bind="pickProps"
                  />
                </template>
                <v-color-picker v-model="bgPick" mode="hex" hide-inputs hide-mode-switch class="ma-2" />
              </v-menu>
            </div>
            <div class="vui-avatar__swatches">
              <button
                v-for="(c, i) in FG_COLORS"
                :key="`fg-${i}`"
                type="button"
                class="vui-avatar__swatch vui-avatar__swatch--fg"
                :class="{ 'vui-avatar__swatch--on': fg === c }"
                :title="c || t('topbar.avatarColorDefault')"
                @click="fg = c; touch()"
              >
                <span :style="{ color: c || 'rgb(var(--v-theme-on-surface))' }">A</span>
              </button>
              <v-menu>
                <template #activator="{ props: pickProps }">
                  <button
                    type="button"
                    class="vui-avatar__swatch vui-avatar__swatch--fg"
                    :title="t('topbar.avatarColorCustom')"
                    v-bind="pickProps"
                  >
                    <span :style="{ color: fg || onSurfaceHex }">A</span>
                  </button>
                </template>
                <v-color-picker v-model="fgPick" mode="hex" hide-inputs hide-mode-switch class="ma-2" />
              </v-menu>
            </div>
          </div>
          <!-- 表情模式：预设 emoji 单选（底色默认主题色） -->
          <div v-else class="vui-avatar__emojis">
            <button
              v-for="e in EMOJI_LIST"
              :key="e"
              type="button"
              class="vui-avatar__emoji"
              :class="{ 'vui-avatar__emoji--on': emoji === e }"
              @click="emoji = e; touch()"
            >
              {{ e }}
            </button>
          </div>
        </div>
      </div>
    </div>
    <template #actions>
      <!-- 取消 = 普通按钮（项目约定 2026-10-18：关闭/取消不指定颜色与变体） -->
      <v-btn :disabled="saving" @click="open = false">{{ t('common.cancel') }}</v-btn>
      <v-btn color="primary" :loading="saving" @click="save">{{ t('common.confirm') }}</v-btn>
    </template>
  </FvInteractiveDialog>
</template>

<style scoped>
/* 无标题（2026-10-22 定稿）：隐藏基座标题条（随之该弹窗拖动不可用——内容小、按需弹出，可接受） */
.vui-avatar-dialog :deep(.vui-base-dialog__title) {
  display: none;
}

.vui-avatar {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 6px 0;
}

.vui-avatar__side {
  flex: 1;
  min-width: 0;
}

/* 内容框（2026-10-22）：Tab 下方区域的 FvTable 档容器——描边同 --vui-border 令牌；
   上边框与 Tab 基线（滑块所在线）重合为一条线：-1px 叠压，滑块绘于其上不受遮；
   圆角只留下方两角（6px 同 radius-s 档），上沿取直与滑动线严丝合缝、不再角内塌缝；
   固定高度 116px：切 Tab（字母色板↔表情格）框高恒定、弹窗不跳（内容垂直居中，超档滚动兜底） */
.vui-avatar__panel {
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 116px;
  overflow-y: auto;
  margin-top: -1px;
  padding: 12px;
  border: 1px solid var(--vui-border);
  border-radius: 0 0 var(--vui-radius-s) var(--vui-radius-s);
}

/* 字母模式色板：一行两组，左=底色、右=字体色（2026-10-22 调版，无文字标签） */
.vui-avatar__colors {
  display: flex;
  align-items: center;
  gap: 14px;
}

.vui-avatar__swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.vui-avatar__swatch {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1px solid rgba(128, 128, 128, 0.45);
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.vui-avatar__swatch--fg span {
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
}

.vui-avatar__swatch--fg {
  background: rgb(var(--v-theme-surface));
}

.vui-avatar__swatch--on {
  box-shadow: 0 0 0 2px rgb(var(--v-theme-primary));
}

.vui-avatar__emojis {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* 表情格放大（2026-10-22）：42px 格 / 28px 字，每行 6 枚两行收齐 */
.vui-avatar__emoji {
  width: 42px;
  height: 42px;
  font-size: 28px;
  line-height: 1;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
}

.vui-avatar__emoji--on {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.12);
}
</style>
