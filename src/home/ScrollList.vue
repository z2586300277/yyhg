<template>
  <div class="scroll-wrap">
    <div ref="listEl" class="scroll-list">
      <div
        v-for="item in list"
        :key="item.id"
        class="scroll-item"
        :class="[qc && 'scroll-item--qc', { error: !item.status }]"
      >
        <i class="dot" />
        <span class="col-label">{{ qc ? item.name : item.label }}</span>
        <span class="col-value">{{ item.value }}</span>
        <span v-if="qc" class="col-status" :class="item.status ? 'ok' : 'bad'">
          {{ item.status ? '合格' : '异常' }}
        </span>
        <span class="col-time">{{ item.time }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const ROW_GAP = 7

const props = defineProps({
  list: { type: Array, required: true },
  interval: { type: Number, required: true },
  startDelay: { type: Number, default: 0 },
  qc: { type: Boolean, default: false },
})

const listEl = ref()
let timer
let delayTimer
let busy = false

function scrollOnce(el) {
  const row = el.querySelector('.scroll-item')
  const step = row ? row.offsetHeight + ROW_GAP : 39
  el.style.transform = `translate3d(0, -${step}px, 0)`

  const onEnd = (event) => {
    if (event.target !== el || event.propertyName !== 'transform') return
    el.removeEventListener('transitionend', onEnd)
    el.style.transition = 'none'
    el.style.transform = 'translate3d(0, 0, 0)'
    props.list.push(props.list.shift())
    void el.offsetHeight
    el.style.transition = ''
  }
  el.addEventListener('transitionend', onEnd)
}

function tick() {
  const el = listEl.value
  if (!el || busy) return
  busy = true
  scrollOnce(el)
  setTimeout(() => { busy = false }, 650)
}

onMounted(() => {
  const start = () => { timer = setInterval(tick, props.interval) }
  if (props.startDelay) delayTimer = setTimeout(start, props.startDelay)
  else start()
})

onUnmounted(() => {
  clearTimeout(delayTimer)
  clearInterval(timer)
})
</script>

<style lang="less" scoped>
.scroll-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.scroll-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
  transform: translate3d(0, 0, 0);
  transition: transform 0.6s cubic-bezier(0.25, 0.1, 0.25, 1);
  will-change: transform;
}

.scroll-item {
  position: relative;
  display: grid;
  grid-template-columns: 96px 68px minmax(0, 1fr);
  gap: 8px;
  flex-shrink: 0;
  align-items: center;
  min-height: 32px;
  padding: 6px 10px 6px 20px;
  font-size: var(--text-base);
  background: linear-gradient(90deg, rgba(98, 255, 190, 0.16), transparent);
  border-left: 2px solid rgba(98, 255, 190, 0.35);

  &.error {
    background: linear-gradient(90deg, rgba(255, 171, 122, 0.18), transparent);
    border-left-color: rgba(255, 171, 122, 0.55);

    .dot { background-color: var(--color-warning); }
    .col-value { color: var(--color-warning); }
  }

  .dot {
    position: absolute;
    left: 8px;
    width: 5px;
    height: 10px;
    background-color: var(--color-success);
  }

  .col-label,
  .col-value,
  .col-time {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .col-label {
    font-family: var(--font-title);
    font-weight: 500;
    color: var(--color-label);
  }

  .col-value {
    font-size: var(--text-md);
    font-weight: 700;
    color: var(--color-value);
  }

  .col-time {
    text-align: right;
    font-size: var(--text-xs);
    color: var(--color-time);
  }
}

.scroll-item--qc {
  grid-template-columns: 76px 72px 44px minmax(0, 1fr);

  .col-status {
    font-size: var(--text-sm);
    font-weight: 700;
    text-align: center;

    &.ok { color: var(--color-success); }
    &.bad { color: var(--color-warning); }
  }
}
</style>
