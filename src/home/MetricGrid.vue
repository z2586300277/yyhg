<template>
  <div class="metric-grid">
    <div
      v-for="(item, index) in items"
      :key="item.label"
      class="metric-cell"
      :class="{
        active: activeIndex === index,
        error: item.error,
        'is-text': item.type === 'text',
      }"
    >
      <div class="metric-label">{{ item.label }}</div>
      <div class="metric-value">
        <span class="num">{{ item.value }}</span>
        <span v-if="item.unit" class="unit">{{ item.unit }}</span>
      </div>
      <span v-if="item.error" class="alert-mark" aria-hidden="true">!</span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  items: { type: Array, required: true },
  activeIndex: { type: Number, default: -1 },
})
</script>

<style lang="less" scoped>
.metric-grid {
  box-sizing: border-box;
  flex: 1;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-template-rows: repeat(3, minmax(0, 1fr));
  gap: 6px;
  min-height: 0;
  padding: 2px 0 4px;
}

.metric-cell {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-width: 0;
  min-height: 0;
  padding: 5px 4px;
  overflow: hidden;
  background: linear-gradient(180deg, rgba(110, 181, 255, 0.1), rgba(110, 181, 255, 0.03));
  border: 1px solid rgba(158, 202, 255, 0.14);

  .metric-label {
    width: 100%;
    font-family: var(--font-title);
    font-size: var(--text-sm);
    font-weight: 500;
    line-height: 1.2;
    color: var(--color-label);
    text-align: center;
    white-space: nowrap;
  }

  .metric-value {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 3px;
    width: 100%;
    white-space: nowrap;
    color: var(--color-value);

    .num {
      font-size: var(--text-md);
      font-weight: 700;
      line-height: 1.2;
    }

    .unit {
      font-size: var(--text-xs);
      font-weight: 500;
      color: var(--color-unit);
    }
  }

  &.is-text .metric-value .num {
    font-size: var(--text-sm);
    font-weight: 600;
  }

  &.active {
    border-color: rgba(94, 235, 240, 0.55);
    background: linear-gradient(180deg, rgba(94, 235, 240, 0.18), rgba(94, 235, 240, 0.05));

    .metric-label {
      color: var(--color-accent);
    }

    .metric-value .unit {
      color: #a8f0f4;
    }
  }

  &.error {
    border-color: rgba(255, 171, 122, 0.45);
    background: linear-gradient(180deg, rgba(255, 171, 122, 0.14), rgba(255, 171, 122, 0.04));

    .metric-label {
      color: #ffc9a8;
    }

    .metric-value .num {
      color: var(--color-warning);
    }
  }

  .alert-mark {
    position: absolute;
    top: 4px;
    right: 6px;
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--color-warning);
  }
}
</style>
