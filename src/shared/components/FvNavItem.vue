<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { FvFeature } from '@/shared/module'

/**
 * 递归导航项·功能层（2026-10-16 收敛：直接消费核心模型 FvFeature，不再有 FvNavNode 投影）：
 * 功能组（children 非空）= v-list-group；叶子 = 路由跳转（feature.url）。
 * 模块一级由 FvShell 自渲染（图标仅模块级）；depth 从 2 起。
 *
 * 层次感（2026-11-11 用户定稿）：每项挂深度类 vui-nav-l2 / vui-nav-l3（≥3 级归 l3），
 * 组头另挂 vui-nav-group；FvShell 按类给缩进/字号/字色/字重台阶——
 * 取代旧「vui-nav-child 一档 !important 缩进」把二三级压平的做法。
 */
const props = withDefaults(defineProps<{ feature: FvFeature; depth?: number }>(), { depth: 2 })

const { t } = useI18n()

/** 深度类：l2 / l3（更深层级一律按 l3 台阶呈现，现状菜单树最深三级） */
const depthClass = computed(() => `vui-nav-l${Math.min(props.depth, 3)}`)
</script>

<template>
  <!-- 功能组：有 children -->
  <v-list-group v-if="feature.children?.length" :value="feature.id">
    <template #activator="{ props: groupProps }">
      <v-list-item
        v-bind="groupProps"
        :title="t(feature.key)"
        rounded="lg"
        :class="['vui-nav-child', 'vui-nav-group', depthClass]"
      />
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
    :class="['vui-nav-child', depthClass]"
  />
</template>
