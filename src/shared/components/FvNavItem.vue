<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import type { FvFeature } from '@/shared/module'

/**
 * 递归导航项·功能层（2026-10-16 收敛：直接消费核心模型 FvFeature，不再有 FvNavNode 投影）：
 * 功能组（children 非空）= v-list-group；叶子 = 路由跳转（feature.url）。
 * 模块一级由 FvShell 自渲染（图标仅模块级）；depth 从 2 起（缩进样式判定 depth > 2 为三级起）。
 */
withDefaults(defineProps<{ feature: FvFeature; depth?: number }>(), { depth: 2 })

const { t } = useI18n()
</script>

<template>
  <!-- 功能组：有 children -->
  <v-list-group v-if="feature.children?.length" :value="feature.id">
    <template #activator="{ props: groupProps }">
      <v-list-item v-bind="groupProps" :title="t(feature.key)" rounded="lg" />
    </template>
    <FvNavItem
      v-for="child in feature.children"
      :key="child.id"
      :feature="child"
      :depth="depth + 1"
    />
  </v-list-group>

  <!-- 叶子：走路由 -->
  <v-list-item
    v-else
    :to="feature.url"
    :title="t(feature.key)"
    rounded="lg"
    :class="{ 'vui-nav-child': depth > 1 }"
  />
</template>
