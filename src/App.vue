<script setup lang="ts">
import { useThemeMode } from '@/app/composables/useThemeMode'
import FvAlertToastHost from '@/shared/toast/FvAlertToastHost.vue'
import FvModalDialogHost from '@/shared/dialog/FvModalDialogHost.vue'
import FvInteractiveDialogHost from '@/shared/dialog/FvInteractiveDialogHost.vue'
import FvLoadingHost from '@/shared/loading/FvLoadingHost.vue'

// 主题初始化放在顶层：登录页（壳层外）同样生效
useThemeMode()
</script>

<template>
  <v-app>
    <router-view />
    <!-- 公共 Toast：全局唯一宿主，登录页与主界面均可弹出（useAlertToast() 调用即弹） -->
    <FvAlertToastHost />
    <!-- 公共 Dialog：全局唯一宿主（useModalDialog() 调用即弹，同一时刻一个、自动排队） -->
    <FvModalDialogHost />
    <!-- 编程式弹窗宿主：openInteractiveDialog(组件, props) 打开的独立弹窗组件在此渲染 -->
    <FvInteractiveDialogHost />
    <!-- 全局接口 Loading：shared/http 的 RequestOptions.loading=true 时显示，覆盖全页禁交互 -->
    <FvLoadingHost />
  </v-app>
</template>
