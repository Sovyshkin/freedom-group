<template>
  <div class="loader-container">
    <div class="loader">
      <div class="loader-ring"></div>
      <div class="loader-ring"></div>
      <div class="loader-ring"></div>
      <div class="loader-ring"></div>
    </div>
  </div>
</template>

<style scoped>
.loader-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60px;
}

.loader {
  position: relative;
  width: 40px;
  height: 40px;
}

.loader-ring {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border: 3px solid transparent;
  border-radius: 50%;
  animation: spin 1.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite;
}

.loader-ring:nth-child(1) {
  border-top-color: #1233EA;
  animation-delay: 0s;
}

.loader-ring:nth-child(2) {
  border-right-color: #10b981;
  animation-delay: -0.375s;
}

.loader-ring:nth-child(3) {
  border-bottom-color: #f59e0b;
  animation-delay: -0.75s;
}

.loader-ring:nth-child(4) {
  border-left-color: #ef4444;
  animation-delay: -1.125s;
}

@keyframes spin {
  0% {
    transform: rotate(0deg) scale(1);
    opacity: 1;
  }
  50% {
    transform: rotate(180deg) scale(0.8);
    opacity: 0.7;
  }
  100% {
    transform: rotate(360deg) scale(1);
    opacity: 1;
  }
}
</style>
