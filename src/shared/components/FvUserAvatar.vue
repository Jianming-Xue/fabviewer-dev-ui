<script setup lang="ts">
import { computed } from 'vue'

/**
 * 用户头像统一渲染（2026-10-22 头像修改三类口径定稿）：UserDto.avatar 原文三种形态——
 *  ① JSON 配置 {"mode":"username","bg":"","fg":""}：用户名首字母大写（中文取首字），
 *    bg/fg 空串 = 底色主题色 / 字色系统默认（不覆写）；
 *  ② JSON 配置 {"mode":"emoji","emoji":"🚀"}：预设表情头像，底色默认主题色；
 *  ③ JSON 配置 {"mode":"img","base64":"<裁剪图 dataURL>"}：图片头像（2026-10-22 裁剪定稿），
 *    base64 不存在/为空=默认头像（走字母退化）；
 *  ④ 图片 URL/dataURL 原文（authMock 演示头像等旧口径）或 ''（退化=昵称/用户名首字符大写，原口径）。
 * 消费点：顶栏 FvShell / 用户信息弹窗 / ChangeUserAvatarDialog 预览。
 */
const props = withDefaults(
  defineProps<{
    /** UserDto.avatar 原文（JSON 配置 / 图片地址 / 空串） */
    avatar: string
    /** 用户名（username 模式取首字母） */
    userName: string
    /** 退化字母口径（avatar='' 时取昵称/用户名首字符，2026-10-18 原行为） */
    fallbackName?: string
    /** 直径（Vuetify SizeProp，数字按 px） */
    size?: number | string
  }>(),
  { fallbackName: '', size: 40 },
)

interface AvatarCfg {
  mode?: string
  bg?: string
  fg?: string
  emoji?: string
  base64?: string
}

const raw = computed(() => props.avatar.trim())

const cfg = computed<AvatarCfg | null>(() => {
  if (!raw.value.startsWith('{')) return null
  try {
    return JSON.parse(raw.value) as AvatarCfg
  } catch {
    return null
  }
})

const kind = computed<'username' | 'emoji' | 'image' | 'none'>(() => {
  if (cfg.value?.mode === 'username') return 'username'
  if (cfg.value?.mode === 'emoji') return 'emoji'
  if (cfg.value?.mode === 'img') return cfg.value.base64?.trim() ? 'image' : 'none'
  return raw.value ? 'image' : 'none'
})

/** 图片源：img 配置取 base64，旧口径取原文 */
const imgSrc = computed(() => (cfg.value?.mode === 'img' ? (cfg.value.base64 ?? '') : raw.value))

const sizeNum = computed(() => {
  const n = parseInt(String(props.size), 10)
  return Number.isFinite(n) && n > 0 ? n : 40
})

/** 首字母大写（中文取第一个文字）；''退化取昵称/用户名 */
const letter = computed(() => {
  const src = kind.value === 'username' ? props.userName : props.fallbackName || props.userName
  return src.trim().slice(0, 1).toUpperCase() || '?'
})

/** 底色：bg 空串=主题色 */
const bg = computed(() => cfg.value?.bg?.trim() || 'primary')

/** 字母样式：字号随尺寸缩放；fg 空串=不覆写字色（随底色系统配色） */
const letterStyle = computed(() => ({
  fontSize: `${Math.round(sizeNum.value * 0.42)}px`,
  ...(cfg.value?.fg?.trim() ? { color: cfg.value.fg.trim() } : null),
}))
</script>

<template>
  <v-avatar :size="size" :color="bg" variant="flat">
    <img v-if="kind === 'image'" :src="imgSrc" :alt="userName" />
    <span v-else-if="kind === 'emoji'" :style="{ fontSize: `${Math.round(sizeNum * 0.55)}px` }">
      {{ cfg?.emoji || '🙂' }}
    </span>
    <span v-else class="font-weight-bold" :style="letterStyle">{{ letter }}</span>
  </v-avatar>
</template>
