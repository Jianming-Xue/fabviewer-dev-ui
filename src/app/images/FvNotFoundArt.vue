<script setup lang="ts">
/**
 * 404 插画（2026-10-27）：「4🤖4」——中间的 0 换成机器人头（与 FvSupportBot 同族造型：
 * 圆角方头/天线球/大眼），迷路表情（惊讶小圆嘴 + 歪头问号）。
 * 动画全 CSS keyframes：整机 6s 浮动（与登录页浮动动画同节奏）、投影反相缩放、
 * 天线球脉冲、双眼 5s 周期瞬眨、问号摆动、三点星光闪烁；prefers-reduced-motion 全停。
 * 颜色一律设计令牌（--vui-primary/--vui-text/--vui-primary-bg…），双主题自适应，零硬编码色值。
 */
</script>

<template>
  <svg
    class="nf-art"
    viewBox="0 0 360 200"
    role="img"
    aria-hidden="true"
    fill="none"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <!-- 左「4」：斜笔+横杠 / 竖笔 -->
    <g class="nf-digit" stroke="var(--vui-primary)" stroke-width="12">
      <path d="M92 34 L42 116 H127" />
      <path d="M92 34 V164" />
    </g>
    <!-- 右「4」（镜像） -->
    <g class="nf-digit" stroke="var(--vui-primary)" stroke-width="12">
      <path d="M268 34 L318 116 H233" />
      <path d="M268 34 V164" />
    </g>

    <!-- 地面投影：与浮动反相（升高时缩小变淡） -->
    <ellipse class="nf-shadow" cx="180" cy="182" rx="58" ry="7" />

    <!-- 机器人头（顶替「0」）：整机浮动 -->
    <g class="nf-robot">
      <!-- 天线 -->
      <path d="M180 52 V30" stroke="var(--vui-text)" stroke-width="8" />
      <circle class="nf-ball" cx="180" cy="22" r="8" fill="var(--vui-primary)" />
      <!-- 头壳 -->
      <rect x="128" y="52" width="104" height="104" rx="24" stroke="var(--vui-text)" stroke-width="10" />
      <!-- 双眼（同 cy，组级 scaleY 瞬眨）：文字色大眼 + 主题色瞳 -->
      <g class="nf-eyes">
        <circle cx="157" cy="96" r="10" fill="var(--vui-text)" />
        <circle cx="203" cy="96" r="10" fill="var(--vui-text)" />
        <circle cx="159" cy="93" r="3.4" fill="var(--vui-primary-bg)" />
        <circle cx="205" cy="93" r="3.4" fill="var(--vui-primary-bg)" />
      </g>
      <!-- 惊讶小圆嘴 -->
      <circle cx="180" cy="128" r="7" stroke="var(--vui-text)" stroke-width="6" />
      <!-- 迷路问号（随头浮动，另加摆动） -->
      <text
        class="nf-qmark"
        x="244"
        y="44"
        font-size="30"
        font-weight="700"
        fill="var(--vui-text-secondary)"
        stroke="none"
        font-family="var(--vui-font-ui)"
      >
        ?
      </text>
    </g>

    <!-- 三点星光 -->
    <circle class="nf-sparkle nf-sparkle--a" cx="52" cy="52" r="4" fill="var(--vui-primary)" />
    <circle class="nf-sparkle nf-sparkle--b" cx="312" cy="66" r="3" fill="var(--vui-primary)" />
    <circle class="nf-sparkle nf-sparkle--c" cx="196" cy="186" r="3" fill="var(--vui-primary)" />
  </svg>
</template>

<style scoped>
.nf-art {
  width: 100%;
  height: auto;
  animation: nf-enter 0.5s cubic-bezier(0.4, 0, 0.2, 1) both;
}

@keyframes nf-enter {
  from {
    opacity: 0;
    transform: scale(0.94);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* 整机浮动（6s，与登录页展示图同节奏） */
.nf-robot {
  animation: nf-float 6s ease-in-out infinite;
}

@keyframes nf-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

/* 投影反相：机器人升高时缩小变淡 */
.nf-shadow {
  fill: var(--vui-text);
  opacity: 0.1;
  transform-box: fill-box;
  transform-origin: center;
  animation: nf-shadow 6s ease-in-out infinite;
}

@keyframes nf-shadow {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.1;
  }
  50% {
    transform: scale(0.82);
    opacity: 0.05;
  }
}

/* 天线球脉冲 */
.nf-ball {
  transform-box: fill-box;
  transform-origin: center;
  animation: nf-pulse 1.8s ease-in-out infinite;
}

@keyframes nf-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.28);
    opacity: 0.75;
  }
}

/* 瞬眨：绝大部分周期睁眼，尾部快速压扁一回（双眼同 cy，组级 scaleY 即可） */
.nf-eyes {
  transform-box: fill-box;
  transform-origin: center;
  animation: nf-blink 5s infinite;
}

@keyframes nf-blink {
  0%,
  90%,
  100% {
    transform: scaleY(1);
  }
  94% {
    transform: scaleY(0.08);
  }
}

/* 问号摆动 */
.nf-qmark {
  transform-box: fill-box;
  transform-origin: center;
  animation: nf-wobble 3s ease-in-out infinite;
}

@keyframes nf-wobble {
  0%,
  100% {
    transform: rotate(-8deg);
  }
  50% {
    transform: rotate(10deg);
  }
}

/* 星光闪烁（三颗错拍） */
.nf-sparkle {
  transform-box: fill-box;
  transform-origin: center;
  animation: nf-twinkle 2.4s ease-in-out infinite;
}

.nf-sparkle--b {
  animation-duration: 3s;
  animation-delay: 0.7s;
}

.nf-sparkle--c {
  animation-duration: 2.8s;
  animation-delay: 1.4s;
}

@keyframes nf-twinkle {
  0%,
  100% {
    opacity: 0.25;
    transform: scale(0.8);
  }
  50% {
    opacity: 1;
    transform: scale(1.15);
  }
}

/* 无障碍：系统减弱动态偏好 → 全停（入场动画保留终帧） */
@media (prefers-reduced-motion: reduce) {
  .nf-art,
  .nf-robot,
  .nf-shadow,
  .nf-ball,
  .nf-eyes,
  .nf-qmark,
  .nf-sparkle {
    animation: none;
  }
}
</style>
