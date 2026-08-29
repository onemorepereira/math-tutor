<template>
  <div class="confetti" aria-hidden="true">
    <span
      v-for="piece in pieces"
      :key="piece.id"
      class="piece"
      :style="piece.style"
    ></span>
  </div>
</template>

<script setup lang="ts">
const COLORS = ['#667eea', '#764ba2', '#28a745', '#ffc107', '#dc3545', '#0066cc']

const pieces = Array.from({ length: 40 }, (_, i) => ({
  id: i,
  style: {
    left: `${(i * 61) % 100}%`,
    background: COLORS[i % COLORS.length],
    animationDelay: `${(i % 10) * 0.18}s`,
    animationDuration: `${2.4 + (i % 5) * 0.35}s`,
    transform: `rotate(${(i * 47) % 360}deg)`
  }
}))
</script>

<style scoped>
.confetti {
  position: fixed;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 999;
}

.piece {
  position: absolute;
  top: -12px;
  width: 10px;
  height: 14px;
  opacity: 0.9;
  border-radius: 2px;
  animation-name: fall;
  animation-timing-function: ease-in;
  animation-iteration-count: 1;
  animation-fill-mode: forwards;
}

@keyframes fall {
  to {
    top: 105%;
    transform: rotate(720deg);
    opacity: 0.6;
  }
}
</style>
