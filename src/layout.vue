<template>
  <div class="app-layout">
    <router-view />
  </div>
</template>

<style lang="less" scoped>
.app-layout {
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;

  :deep(> *) {
    width: 100%;
    height: 100%;
  }
}
</style>