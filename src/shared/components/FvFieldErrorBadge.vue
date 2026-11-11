<script setup lang="ts">
/**
 * 全局错误徽标（Fv 族，2026-11-12 自 FvTextInput/FvTextSelect 的 #message 槽重复实现抽一）：
 * 错误色 fa-comment-dots 裸图标（2026-11-12 再定稿去底色/投影，仅留图标+20px 悬停热区），
 * 悬停出深底红字方框 tooltip。
 * **单一事实源**——形状/图标/tooltip/**锚定**全在本件 + tokens.css `.fv-field__err-badge` 段，
 * 消费方不得再各写徽标样式（用户定稿 2026-11-12「用一个错误样式」，三消费方已统一）：
 * - 嵌 Vuetify 字段核（FvTextInput/FvTextSelect）：经 #message 槽进 details 行，锚定由
 *   tokens.css 的 `.v-input__details` 段承担（top:24px=label 区高），消费方零样式；
 * - 直渲染场景（FvStringListEditor）：传 `anchor` 走绝对锚定档，消费方只提供
 *   position:relative 的定位祖先、不写徽标样式。message 空 = 不渲染。
 */
withDefaults(
  defineProps<{
    message?: string
    /** 绝对锚定档：徽标右下角=最近定位祖先（须 position:relative）右上角，
     *  配方在 tokens.css `.fv-field__err-badge--anchored`；不传则随流摆（#message 槽内场景） */
    anchor?: boolean
  }>(),
  { message: '', anchor: false },
)
</script>

<template>
  <v-tooltip v-if="message" :text="message" content-class="vui-table-tip vui-field-err-tip">
    <template #activator="{ props: tipProps }">
      <span
        v-bind="tipProps"
        class="fv-field__err-badge"
        :class="{ 'fv-field__err-badge--anchored': anchor }"
        ><v-icon size="12">fas fa-comment-dots</v-icon></span
      >
    </template>
  </v-tooltip>
</template>
