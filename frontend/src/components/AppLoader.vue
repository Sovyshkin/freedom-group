<template>
  <div class="loader-center">
    <svg viewBox="25 25 50 50" class="loader-svg">
      <circle r="20" cy="50" cx="50"></circle>
    </svg>
  </div>
</template>

<style scoped>
.loader-center {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28px 0; /* vertical spacing so loader sits centered in block */
}

.loader-svg {
  width: 3.25em;
  height: 3.25em;
  transform-origin: center;
  animation: rotate4 2s linear infinite;
}

.loader-svg circle {
  fill: none;
  stroke: #1233EA;
  stroke-width: 2;
  stroke-dasharray: 1, 200;
  stroke-dashoffset: 0;
  stroke-linecap: round;
  animation: dash4 1.5s ease-in-out infinite;
}

@keyframes rotate4 {
  100% {
    transform: rotate(360deg);
  }
}

@keyframes dash4 {
  0% {
    stroke-dasharray: 1, 200;
    stroke-dashoffset: 0;
  }

  50% {
    stroke-dasharray: 90, 200;
    stroke-dashoffset: -35px;
  }

  100% {
    stroke-dashoffset: -125px;
  }
}
</style>
