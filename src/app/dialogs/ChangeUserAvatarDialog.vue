<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTheme } from 'vuetify'

import FvInteractiveDialog from '@/shared/dialog/FvInteractiveDialog.vue'
import FvImageCropper from '@/shared/components/FvImageCropper.vue'
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
 *  ③ 图片（2026-10-22 裁剪定稿）：上传原图（仅 image/*、≤2MB 弹窗内拦截）→ FvImageCropper 框圆裁剪
 *    （圆内拖拽+缩放，自动压缩到 2KB 预算）→ 提交 {"mode":"img","base64":"<裁剪结果 dataURL>"}，
 *    base64 空=默认头像；现有头像即图片时进入自动落位本 Tab 回填。
 * 无恢复钮（2026-10-22 再定）：要弃稿直接 Cancel/关闭；切 Tab 不算改动、不动已呈现大头像，
 * 呈现只随实际选择（点色/点表情/裁剪出图）联动。
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
/** 底色备选（''=默认主题色，2026-10-22 去白色档；默认九种、与字色数量一致，另带右下角改色格） */
const BG_COLORS = ['', '#1E88E5', '#8E24AA', '#D81B60', '#43A047', '#FB8C00', '#546E7A', '#00ACC1', '#212121']
/** 字色备选（''=默认系统字体色；默认九种、数量与底色对齐） */
const FG_COLORS = ['', '#212121', '#FFD54F', '#40C4FF', '#FF7043', '#66BB6A', '#AB47BC', '#F06292', '#D50000']

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

/** 当前值是否不在预设内（=自由色板档被选中；进弹窗时头像色不在备选中即此态） */
const bgCustom = computed(() => !BG_COLORS.includes(bg.value))
const fgCustom = computed(() => !FG_COLORS.includes(fg.value))

/** 字色预览字母：用户名首字符大写（中文取首字），逐格以候选字色书写 */
const letterText = computed(() => auth.user.userName.trim().slice(0, 1).toUpperCase() || '?')

/** 格内填充色：''默认档解析成实际主题色（底色=primary / 字色=on-surface） */
function bgResolved(c: string): string {
  return c || primaryHex.value
}
function fgResolved(c: string): string {
  return c || onSurfaceHex.value
}

/** 勾形色：按填充色亮度反相（亮底深勾/暗底白勾）；解析失败退回白 */
function contrastOf(hex: string): string {
  const s = /^#?([\da-f]{6})$/i.exec(hex.trim())?.[1]
  if (!s) return '#FFFFFF'
  const n = parseInt(s, 16)
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  return lum > 0.6 ? '#212121' : '#FFFFFF'
}

interface AvatarCfg {
  mode?: string
  bg?: string
  fg?: string
  emoji?: string
  base64?: string
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
/** 现有头像是否为旧口径图片（非 JSON 配置且非空 = URL/dataURL 直存，如 authMock 演示头像） */
const initIsLegacyImg = init === null && props.current.trim() !== ''
/** 选项区模式：按现有头像形态落位（emoji/img/旧图片 → 对应 Tab，其余=字母） */
const mode = ref(
  init?.mode === 'emoji' ? 'emoji' : init?.mode === 'img' || initIsLegacyImg ? 'image' : 'username',
)
const bg = ref(init?.mode === 'username' ? (init.bg ?? '') : '')
const fg = ref(init?.mode === 'username' ? (init.fg ?? '') : '')
const emoji = ref(init?.mode === 'emoji' && EMOJI_LIST.includes(init.emoji ?? '') ? init.emoji! : EMOJI_LIST[0])
/** 图片模式（2026-10-22 裁剪定稿）：选图→框圆裁剪→缩到 2KB 的结果 dataURL；
 *  提交包成 {"mode":"img","base64":""}，base64 无=默认头像；'' 档回填自旧口径直存图 */
const imgData = ref(init?.mode === 'img' ? (init.base64?.trim() ?? '') : initIsLegacyImg ? props.current.trim() : '')
/** 待裁剪原图（选图后即进裁剪编辑器；确认裁剪结果才算改动） */
const sourceData = ref('')
const imgName = ref('')
const pickError = ref('')
const fileInput = ref<HTMLInputElement>()
/** 原图上传上限 2MB（裁剪压缩后另按 2KB 预算落库） */
const MAX_BYTES = 2 * 1024 * 1024
/** 用户是否动过选项：未动过=呈现现有头像原样（avatar 空则即缺省字母形态） */
const touched = ref(false)

/** 方式三选 Tab 项（③图片=2026-10-22 本轮开放） */
const modeTabs = computed<FvTabItem[]>(() => [
  { title: t('topbar.avatarModeLetter'), value: 'username' },
  { title: t('topbar.avatarModeEmoji'), value: 'emoji' },
  { title: t('topbar.avatarModeImage'), value: 'image' },
])

/** 真正做过选择才动大头像：呈现只认「最后一次实际改动」的模式，纯切 Tab 不改呈现 */
const applied = ref<'username' | 'emoji' | 'image'>('username')

function touch() {
  touched.value = true
  applied.value = mode.value === 'emoji' || mode.value === 'image' ? mode.value : 'username'
}

function pickImage() {
  fileInput.value?.click()
}

function onImageFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // 清空选择：重选同一文件也能触发 change
  pickError.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    pickError.value = t('topbar.avatarNotImage')
    return
  }
  if (file.size > MAX_BYTES) {
    pickError.value = t('topbar.avatarTooLarge')
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    sourceData.value = String(reader.result)
    imgName.value = file.name
  }
  reader.readAsDataURL(file)
}

/** 裁剪器出结果（加载/拖拽/缩放结束自动提交）：即视为改动 */
function onCropped(d: string) {
  imgData.value = d
  touch()
}

/** 呈现即提交口径：字母/表情/图片均包 JSON（img={mode:'img',base64:裁剪结果}）；
 *  未动过原样回传 current；按最后一次实际改动的模式呈现（纯切 Tab 不动大头像） */
const shown = computed(() => {
  if (!touched.value) return props.current
  if (applied.value === 'emoji') return JSON.stringify({ mode: 'emoji', emoji: emoji.value })
  if (applied.value === 'image') return JSON.stringify({ mode: 'img', base64: imgData.value })
  return JSON.stringify({ mode: 'username', bg: bg.value, fg: fg.value })
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
        <!-- 切 Tab 不算改动：只换编辑区，不动已呈现的大头像（2026-10-22 定稿） -->
        <FvTab v-model="mode" :items="modeTabs" />
        <!-- 内容框：FvTable 档描边+圆角（--vui-border/--vui-radius-s），Tab 切换只换框内内容 -->
        <div class="vui-avatar__panel">
          <!-- 字母模式（2026-10-22 定稿）：底色/字色两区各占一半、正中纵向虚线切开，两区备选数一致（默认九色）；
               每区纵横均分 3 列 × 4 行（九预设铺满前三行、末行左两格留空）——
               底色格=待选色整块填充（选中叠反相勾）、
               字色格=白底写用户名首字母逐格着候选字色（所见即所得，选中靠描边环）；
               改色格恒置右下角（末行末列）、左缘虚线与预设分割：点开 v-color-picker 任选、选定自动回填该格；
               进弹窗时头像色命中预设则选中预设格，否则（自定义色/无法解析）选中改色格 -->
          <div v-if="mode === 'username'" class="vui-avatar__colors">
            <div class="vui-avatar__colors-half vui-avatar__colors-half--bg">
              <button
                v-for="(c, i) in BG_COLORS"
                :key="`bg-${i}`"
                type="button"
                class="vui-avatar__chip"
                :class="{ 'vui-avatar__chip--on': bg === c }"
                :style="{ background: bgResolved(c) }"
                :title="c || t('topbar.avatarColorDefault')"
                @click="bg = c; touch()"
              >
                <v-icon v-if="bg === c" icon="fas fa-check" size="12" :color="contrastOf(bgResolved(c))" />
              </button>
              <v-menu>
                <template #activator="{ props: pickProps }">
                  <button
                    type="button"
                    class="vui-avatar__chip vui-avatar__chip--pick"
                    :class="{ 'vui-avatar__chip--on': bgCustom }"
                    :style="{ background: bgResolved(bg) }"
                    :title="t('topbar.avatarColorCustom')"
                    v-bind="pickProps"
                  >
                    <v-icon
                      :icon="bgCustom ? 'fas fa-check' : 'fas fa-palette'"
                      size="12"
                      :color="contrastOf(bgResolved(bg))"
                    />
                  </button>
                </template>
                <v-color-picker v-model="bgPick" mode="hex" hide-inputs hide-mode-switch class="ma-2" />
              </v-menu>
            </div>
            <div class="vui-avatar__colors-half vui-avatar__colors-half--fg">
              <button
                v-for="(c, i) in FG_COLORS"
                :key="`fg-${i}`"
                type="button"
                class="vui-avatar__chip vui-avatar__chip--letter"
                :class="{ 'vui-avatar__chip--on': fg === c }"
                :title="c || t('topbar.avatarColorDefault')"
                @click="fg = c; touch()"
              >
                <span class="vui-avatar__letter" :style="{ color: fgResolved(c) }">{{ letterText }}</span>
              </button>
              <v-menu>
                <template #activator="{ props: pickProps }">
                  <button
                    type="button"
                    class="vui-avatar__chip vui-avatar__chip--letter vui-avatar__chip--pick"
                    :class="{ 'vui-avatar__chip--on': fgCustom }"
                    :title="t('topbar.avatarColorCustom')"
                    v-bind="pickProps"
                  >
                    <span class="vui-avatar__letter" :style="{ color: fgResolved(fg) }">{{ letterText }}</span>
                  </button>
                </template>
                <v-color-picker v-model="fgPick" mode="hex" hide-inputs hide-mode-switch class="ma-2" />
              </v-menu>
            </div>
          </div>
          <!-- 表情模式：预设 emoji 单选（底色默认主题色） -->
          <div v-else-if="mode === 'emoji'" class="vui-avatar__emojis">
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
          <!-- 图片模式（2026-10-22 裁剪定稿）：选图进圆形裁剪编辑器（拖拽+缩放、自动压 2KB），
               裁剪结果即左侧大头像呈现、随 Confirm 以 {"mode":"img","base64":""} 提交；
               未裁过图时呈现/提交沿用现有头像原样；弃稿走 Cancel，无恢复钮 -->
          <div v-else class="vui-avatar__image">
            <input ref="fileInput" type="file" accept="image/*" hidden @change="onImageFile" />
            <template v-if="sourceData">
              <!-- 重新选择钮居中、置圆窗上方（不压圆面、不碍拖拽选位）；恢复无需钮——Cancel 即弃稿 -->
              <v-btn size="small" @click="pickImage">{{ t('topbar.avatarPickAgain') }}</v-btn>
              <FvImageCropper :src="sourceData" :max-bytes="2048" @cropped="onCropped" />
            </template>
            <template v-else>
              <v-btn size="small" @click="pickImage">
                {{ imgData ? t('topbar.avatarPickAgain') : t('topbar.avatarPick') }}
              </v-btn>
              <div class="text-caption text-medium-emphasis vui-avatar__image-name">
                {{ imgName || t('topbar.avatarPickHint') }}
              </div>
            </template>
            <div v-if="pickError" class="text-caption text-error">{{ pickError }}</div>
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
   固定高度 208px（取三档内容最高者=图片模式 钮排+圆窗+缩放行 ≈182px + 内衬；字母正方格 3 列×4 行 ≈176px、
   表情两行 ≈90px 均垂直居中）：切 Tab 框高恒定、弹窗不跳 */
.vui-avatar__panel {
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 208px;
  overflow-y: auto;
  margin-top: -1px;
  padding: 12px;
  border: 1px solid var(--vui-border);
  border-radius: 0 0 var(--vui-radius-s) var(--vui-radius-s);
}

/* 字母模式色板：一行两组各占一半，正中纵向虚线切开（无文字标签） */
.vui-avatar__colors {
  display: flex;
  align-items: center;
}

/* 每区纵横均分：3 列 × 4 行=九预设铺满前三行，末行左两格留空、右格=改色格 */
.vui-avatar__colors-half {
  flex: 1 1 50%;
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}

.vui-avatar__colors-half--bg {
  padding-right: 12px;
}

.vui-avatar__colors-half--fg {
  padding-left: 12px;
  border-left: 1px dashed var(--vui-border);
}

/* 方块格（2026-10-22 定稿）：aspect-ratio 恒正方——宽随 3 列均分、高自动等宽 */
.vui-avatar__chip {
  aspect-ratio: 1 / 1;
  border: 1px solid rgba(128, 128, 128, 0.35);
  border-radius: 4px;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.vui-avatar__chip--on {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

/* 右下角改色格：钉死 4 行 3 列的末格（前三行 9 预设自动铺格、末行左两格留空）；
   左缘一条虚线与预设区切开 */
.vui-avatar__chip--pick {
  grid-column: 3;
  grid-row: 4;
  border-left: 1px dashed var(--vui-border);
}

/* 字色格（2026-10-22 定稿）：底色恒为白（surface 档），逐格写用户名首字母、以候选字色着色——
   所见即所得预览；选中态靠 primary 描边环，不再叠勾 */
.vui-avatar__chip--letter {
  background: rgb(var(--v-theme-surface));
}

.vui-avatar__letter {
  font-size: 17px;
  font-weight: 700;
  line-height: 1;
}

.vui-avatar__emojis {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* 图片模式区：裁剪器/按钮+文件名/提示+校验错误，纵向居中 */
.vui-avatar__image {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}


.vui-avatar__image-name {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
