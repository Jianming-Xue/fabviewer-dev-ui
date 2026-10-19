<script setup lang="ts">
import FvShell from './FvShell.vue'
</script>

<!-- 主界面布局：应用壳（侧栏 + 顶栏）包裹路由视图；登录页不经过此布局 -->
<template>
  <FvShell>
    <router-view />
  </FvShell>
</template>
