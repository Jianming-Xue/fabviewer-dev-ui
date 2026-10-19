<script setup lang="ts">
import { useI18n } from 'vue-i18n'

/** 登录策略管理（页面待实现，2026-10-15 先占位注册） */
const { t } = useI18n()
</script>

<template>
  <v-empty-state :text="t('security.placeholder')" icon="fas fa-key" />
</template>
