<template>
  <div class="panel panel-in">
    <div class="panel-header">
      <div class="panel-title">{{ title }}</div>
    </div>
    <div class="panel-body">
      <slot />
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, default: '' },
})
</script>

<style lang="less" scoped>
.panel {
  position: relative;
  height: 100%;
  color: #fff;
  background-image: url('./assets/images/panel_body_bg.png');
  background-repeat: no-repeat;
  background-size: 100% 100%;

  .panel-header {
    display: flex;
    align-items: center;
    height: 65px;
    font-family: var(--font-title);
    background-image: url('./assets/images/panel_title_bg.png');
    background-repeat: no-repeat;
    background-size: 100% 100%;

    .panel-title {
      position: relative;
      top: -8px;
      left: 70px;
      font-size: var(--text-base);
      font-weight: 600;
      letter-spacing: 0.06em;
      white-space: nowrap;
      color: var(--color-panel-title);
      text-shadow: 0 0 12px rgba(158, 202, 255, 0.25);
    }
  }

  .panel-body {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    height: calc(100% - 65px);
    min-height: 0;
    padding: 0 12px 16px;
    overflow: hidden;
  }
}

@keyframes panel-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.panel-in {
  animation: panel-in 0.6s ease-out both;
}
</style>
