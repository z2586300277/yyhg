<template>
  <div class="home-ai">
    <button
      type="button"
      class="home-ai-fab"
      :class="{ open }"
      :style="{ left: fab.x + 'px', top: fab.y + 'px' }"
      aria-label="打开场景助手"
      @mousedown="onFabDown"
    >
      AI
    </button>

    <div
      v-show="open"
      class="home-ai-panel"
      :style="{ left: panel.x + 'px', top: panel.y + 'px' }"
    >
      <div class="panel-shell">
      <header class="panel-header" @mousedown="onPanelDrag">
        <div class="panel-title">可视化助手</div>
        <div class="panel-actions" @mousedown.stop>
          <button type="button" class="panel-act" :disabled="loading || !messages.length" @click="newChat">新建</button>
          <button type="button" class="panel-act" :class="{ on: showConfig }" @click="showConfig = !showConfig">设置</button>
          <button type="button" class="panel-act" @click="closePanel">关闭</button>
        </div>
      </header>

      <div class="panel-body">
        <div v-show="showConfig" class="home-ai-config">
          <input v-model="baseURL" class="home-ai-input" placeholder="API 地址" />
          <input v-model="apiKey" class="home-ai-input" type="password" placeholder="API Key" />
          <input v-model="model" class="home-ai-input" placeholder="模型名称" />
        </div>

        <div class="home-ai-chat">
          <div v-if="!messages.length" class="home-ai-empty">
          <p>描述浏览、巡检或汇报需求</p>
          <p class="hint">例如：专业导览全场景、巡检东侧重点区域、展示关键节点后慢速环绕</p>
          </div>
          <BubbleList v-else :list="messages" max-height="260px" />
        </div>

        <div class="home-ai-foot">
          <div class="quick-prompts">
            <button
              type="button"
              class="quick-toggle"
              :aria-expanded="showPrompts"
              :disabled="loading"
              @click="showPrompts = !showPrompts"
            >
              <span>快捷指令</span>
              <span class="quick-chevron" :class="{ open: showPrompts }" aria-hidden="true" />
            </button>
            <div v-show="showPrompts" class="quick-list">
              <button
                v-for="item in quickPrompts"
                :key="item.id"
                type="button"
                class="quick-item"
                :disabled="loading"
                @click="runQuick(item)"
              >
                <span class="quick-label">{{ item.label }}</span>
                <span v-if="item.desc" class="quick-desc">{{ item.desc }}</span>
              </button>
            </div>
          </div>
          <XSender
            ref="senderRef"
            placeholder="例如：规划导览并执行、巡检重点区域、全景后环绕…"
            :loading="loading"
            @submit="sendMessage(senderRef?.getModelValue()?.text)"
            @cancel="stop"
          />
        </div>
      </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { BubbleList, XSender } from 'vue-element-plus-x'
import {
  chatWithHomeAi,
  getAiConfig,
  formatAiError,
  loadChats,
  persistActiveChat,
  createNewChat,
  getActiveChat,
  restoreLayout,
  saveLayout,
} from './homeAi.js'

const PANEL_W = 380
const PANEL_H = 460
const FAB = 52
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi)

const layout = restoreLayout({ panelW: PANEL_W, panelH: PANEL_H, fabSize: FAB })
const cfg = getAiConfig()
const chatStore = ref(loadChats())
const active = getActiveChat(chatStore.value)

const open = ref(layout.open)
const showConfig = ref(false)
const showPrompts = ref(false)

const quickPrompts = [
  {
    id: 'tour',
    label: '全景专业导览',
    desc: '分析空间并自动执行多机位路线',
    text: '请先分析三维空间，再规划并立即执行一条专业美观的全景导览（全景建立、3~4个关键机位、俯瞰收束）。',
  },
  {
    id: 'east',
    label: '东侧重点巡检',
    desc: '按东侧象限选地标',
    text: '分析空间后，对东侧区域做美观巡检并自动执行导览路线。',
  },
  {
    id: 'layout',
    label: '布局俯瞰',
    desc: '理解场景平面关系',
    text: '从布局角度规划俯瞰导览，帮我看清场景走向与区域划分并执行。',
  },
  {
    id: 'overview',
    label: '全景总览',
    desc: '远景建立镜头',
    text: '切换到全景总览视角，并说明场景尺度与东西/南北分区。',
  },
  {
    id: 'roam',
    label: '导览后环绕',
    desc: '看完关键点再慢速漫游',
    text: '先执行一轮场景美观导览，完成后开启慢速环绕展示。',
  },
  {
    id: 'stop-roam',
    label: '停止漫游',
    desc: '关闭自动旋转',
    text: '停止环绕漫游。',
  },
]
const baseURL = ref(cfg.baseURL)
const apiKey = ref(cfg.apiKey)
const model = ref(cfg.model)
const loading = ref(false)
const messages = ref(active.messages)
const senderRef = ref(null)
const panel = ref(layout.panel)
const fab = ref(layout.fab)
let msgId = active.msgId
let abortCtrl = null
let lastW = innerWidth

const save = () => saveLayout({ panel: panel.value, fab: fab.value, open: open.value })

function track(e, move, up) {
  if (e.button !== 0) return
  e.preventDefault()
  const end = () => {
    window.removeEventListener('mousemove', move)
    window.removeEventListener('mouseup', end)
    up?.()
  }
  window.addEventListener('mousemove', move)
  window.addEventListener('mouseup', end)
}

function onPanelDrag(e) {
  const sx = e.clientX
  const sy = e.clientY
  const ox = panel.value.x
  const oy = panel.value.y
  track(e, (ev) => {
    panel.value = {
      x: clamp(ox + ev.clientX - sx, 0, innerWidth - PANEL_W),
      y: clamp(oy + ev.clientY - sy, 0, innerHeight - PANEL_H),
    }
  }, save)
}

function onFabDown(e) {
  let drag = false
  const sx = e.clientX
  const sy = e.clientY
  const ox = fab.value.x
  const oy = fab.value.y
  track(e, (ev) => {
    if (Math.abs(ev.clientX - sx) > 3 || Math.abs(ev.clientY - sy) > 3) drag = true
    fab.value = {
      x: clamp(ox + ev.clientX - sx, 0, innerWidth - FAB),
      y: clamp(oy + ev.clientY - sy, 0, innerHeight - FAB),
    }
  }, () => {
    if (!drag) open.value = !open.value
    save()
  })
}

function closePanel() {
  open.value = false
  save()
}

function onResize() {
  const dw = innerWidth - lastW
  fab.value.x = clamp(fab.value.x + dw, 0, innerWidth - FAB)
  panel.value.x = clamp(panel.value.x + dw, 0, innerWidth - PANEL_W)
  lastW = innerWidth
  save()
}

const persistChat = () => persistActiveChat(chatStore.value, { msgId, messages: messages.value })

function newChat() {
  if (loading.value || !messages.value.length) return
  persistChat()
  const chat = createNewChat(chatStore.value)
  messages.value = chat.messages
  msgId = chat.msgId
}

async function sendMessage(text) {
  const msg = text?.trim()
  if (!msg || loading.value) return
  showPrompts.value = false
  messages.value.push({ id: ++msgId, content: msg, placement: 'end' })
  persistChat()
  senderRef.value?.clear()
  loading.value = true
  const aiId = ++msgId
  messages.value.push({ id: aiId, content: '', placement: 'start', loading: true })
  const patch = (fields) => {
    messages.value = messages.value.map((m) => (m.id === aiId ? { ...m, ...fields } : m))
  }
  const history = messages.value.filter((m) => m.id !== aiId)
  abortCtrl = new AbortController()
  const { signal } = abortCtrl
  try {
    await chatWithHomeAi(msg, history, baseURL.value, apiKey.value, model.value, {
      signal,
      onStatus: () => patch({ loading: true }),
      onText: (content) => patch({ content, loading: false }),
    })
  } catch (e) {
    if (!signal.aborted) patch({ content: formatAiError(e), loading: false })
  } finally {
    if (signal.aborted) {
      const cur = messages.value.find((m) => m.id === aiId)
      patch({ content: cur?.content?.trim() || '已停止。', loading: false })
    }
    loading.value = false
    abortCtrl = null
    persistChat()
  }
}

function runQuick(item) {
  sendMessage(item.text)
}

function stop() {
  abortCtrl?.abort()
  loading.value = false
}

onMounted(() => window.addEventListener('resize', onResize))
onUnmounted(() => window.removeEventListener('resize', onResize))
</script>

<style lang="less" scoped>
.home-ai {
  position: fixed;
  inset: 0;
  z-index: 1002;
  pointer-events: none;
  font-family: var(--font-title);
  color: var(--color-value);
}

.home-ai-fab,
.home-ai-panel {
  position: fixed;
  pointer-events: auto;
}

.home-ai-fab {
  width: 52px;
  height: 52px;
  padding: 0;
  border: 1px solid rgba(94, 235, 240, 0.55);
  border-radius: 50%;
  background:
    radial-gradient(circle at 30% 20%, rgba(94, 235, 240, 0.35), transparent 55%),
    linear-gradient(180deg, rgba(14, 48, 88, 0.88), rgba(4, 18, 36, 0.92));
  box-shadow:
    0 0 18px rgba(94, 235, 240, 0.35),
    inset 0 0 12px rgba(158, 202, 255, 0.12);
  font-size: var(--text-sm);
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--color-accent);
  text-shadow: 0 0 10px rgba(94, 235, 240, 0.45);
  cursor: grab;
  transition: filter 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease;

  &:hover {
    filter: brightness(1.12);
    transform: translateY(-2px);
    box-shadow: 0 0 24px rgba(94, 235, 240, 0.5);
  }

  &.open {
    color: #04202a;
    background: linear-gradient(180deg, #7ef5fa, #5eebf0 45%, #3eb8c4);
    border-color: #b8fcff;
    text-shadow: none;
    box-shadow: 0 0 22px rgba(94, 235, 240, 0.65);
  }
}

.home-ai-panel {
  display: flex;
  flex-direction: column;
  width: 380px;
  height: 460px;
  color: var(--color-value);
  background: url('./assets/images/panel_body_bg.png') center / 100% 100% no-repeat;
  border: 1px solid rgba(94, 235, 240, 0.42);
  box-shadow:
    0 0 0 1px rgba(158, 202, 255, 0.12) inset,
    0 8px 32px rgba(2, 8, 16, 0.55),
    0 0 28px rgba(94, 235, 240, 0.18);
  overflow: hidden;
}

.panel-shell {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  isolation: isolate;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      linear-gradient(165deg, rgba(12, 48, 92, 0.88) 0%, rgba(6, 28, 58, 0.92) 45%, rgba(4, 18, 42, 0.94) 100%);
    pointer-events: none;
    z-index: 0;
  }

  &::after {
    content: '';
    position: absolute;
    inset: 8px 10px 10px;
    border: 1px solid rgba(94, 235, 240, 0.2);
    background: linear-gradient(180deg, rgba(110, 181, 255, 0.06), transparent 40%);
    box-shadow: inset 0 0 48px rgba(110, 181, 255, 0.1);
    pointer-events: none;
    z-index: 0;
  }

  > * {
    position: relative;
    z-index: 1;
  }
}

.panel-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  height: 65px;
  padding: 0 14px 0 0;
  background: url('./assets/images/panel_title_bg.png') center / 100% 100% no-repeat;
  cursor: move;
  user-select: none;
}

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

.panel-actions {
  position: relative;
  top: -6px;
  display: flex;
  gap: 4px;
}

.panel-act {
  min-width: 40px;
  height: 26px;
  padding: 0 10px;
  border: 1px solid rgba(158, 202, 255, 0.22);
  border-radius: 2px;
  background: linear-gradient(180deg, rgba(110, 181, 255, 0.14), rgba(110, 181, 255, 0.04));
  font-family: var(--font-title);
  font-size: var(--text-xs);
  color: var(--color-label);
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;

  &:hover:not(:disabled) {
    color: var(--color-accent);
    border-color: rgba(94, 235, 240, 0.45);
    box-shadow: 0 0 10px rgba(94, 235, 240, 0.2);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &.on {
    color: var(--color-accent);
    border-color: rgba(94, 235, 240, 0.5);
  }
}

.panel-body {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  padding: 4px 12px 14px;
}

.home-ai-config {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
  padding: 8px 10px;
  background: linear-gradient(180deg, rgba(110, 181, 255, 0.12), rgba(110, 181, 255, 0.03));
  border: 1px solid rgba(158, 202, 255, 0.18);
}

.home-ai-input {
  height: 30px;
  padding: 0 10px;
  border: 1px solid rgba(158, 202, 255, 0.22);
  border-radius: 2px;
  background: rgba(4, 16, 32, 0.45);
  font-family: var(--font-data);
  font-size: var(--text-xs);
  color: var(--color-value);
  outline: none;

  &::placeholder {
    color: rgba(139, 184, 232, 0.6);
  }

  &:focus {
    border-color: rgba(94, 235, 240, 0.55);
    box-shadow: 0 0 8px rgba(94, 235, 240, 0.15);
  }
}

.home-ai-chat {
  flex: 1;
  min-height: 0;
  margin: 0 4px;
  padding: 8px 6px;
  overflow: hidden;
  user-select: text;
  background: linear-gradient(180deg, rgba(8, 32, 64, 0.55), rgba(4, 20, 48, 0.65));
  border: 1px solid rgba(158, 202, 255, 0.22);
  box-shadow: inset 0 0 24px rgba(110, 181, 255, 0.08);

  :deep(.elx-bubble-list) {
    gap: 12px;
  }

  :deep([class*='elx-bubble'] [class*='content']) {
    user-select: text;
    font-family: var(--font-title) !important;
    font-size: var(--text-sm) !important;
    line-height: 1.55 !important;
    border-radius: 4px !important;
  }

  :deep(.elx-bubble__loading),
  :deep(.elx-bubble-loading) {
    color: var(--color-accent) !important;
  }

  :deep(.elx-bubble__avatar),
  :deep(.elx-bubble-avatar) {
    display: none;
  }
}

.home-ai-empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 10px;
  padding: 20px 12px;
  background: linear-gradient(180deg, rgba(110, 181, 255, 0.08), transparent);

  p {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-label);
  }

  .hint {
    font-size: var(--text-xs);
    line-height: 1.55;
    color: rgba(139, 184, 232, 0.82);
    max-width: 300px;
  }
}

.quick-prompts {
  margin-bottom: 8px;
}

.quick-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 32px;
  padding: 0 10px;
  border: 1px solid rgba(94, 235, 240, 0.32);
  border-radius: 2px;
  background: linear-gradient(180deg, rgba(110, 181, 255, 0.2), rgba(40, 90, 160, 0.1));
  font-family: var(--font-title);
  font-size: var(--text-xs);
  color: var(--color-label);
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease;

  &:hover:not(:disabled) {
    color: var(--color-accent);
    border-color: rgba(94, 235, 240, 0.5);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.quick-chevron {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: rotate(45deg);
  transition: transform 0.2s ease;
  margin-top: -3px;

  &.open {
    transform: rotate(-135deg);
    margin-top: 3px;
  }
}

.quick-list {
  max-height: 160px;
  margin-top: 6px;
  padding: 4px;
  overflow-y: auto;
  background: rgba(6, 24, 48, 0.75);
  border: 1px solid rgba(158, 202, 255, 0.22);
  box-shadow: inset 0 0 20px rgba(110, 181, 255, 0.06);

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(94, 235, 240, 0.35);
    border-radius: 2px;
  }
}

.quick-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-bottom: 1px solid rgba(158, 202, 255, 0.1);
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease;

  &:last-child {
    border-bottom: none;
  }

  &:hover:not(:disabled) {
    background: linear-gradient(90deg, rgba(94, 235, 240, 0.12), transparent);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.quick-label {
  font-size: var(--text-sm);
  font-weight: 600;
  color: #e8f2ff;
}

.quick-desc {
  font-size: var(--text-xs);
  color: rgba(139, 184, 232, 0.85);
  line-height: 1.3;
}

.home-ai-foot {
  flex-shrink: 0;
  margin: 8px 4px 0;
  padding: 8px 8px 6px;
  background: linear-gradient(180deg, rgba(110, 181, 255, 0.22), rgba(40, 90, 160, 0.12));
  border: 1px solid rgba(94, 235, 240, 0.28);
  box-shadow: inset 0 0 16px rgba(110, 181, 255, 0.06);

  --chat-text: var(--color-value);
  --chat-text-placeholder: rgba(139, 184, 232, 0.7);
  --chat-box: rgba(8, 32, 64, 0.65);
  --chat-input: rgba(8, 32, 64, 0.7);
  --chat-input-border: rgba(94, 235, 240, 0.35);
  --chat-card: rgba(14, 48, 88, 0.75);

  :deep(.elx-x-sender) {
    background: rgba(8, 32, 64, 0.65) !important;
    border: 1px solid rgba(94, 235, 240, 0.32) !important;
    border-radius: 2px !important;
    box-shadow: inset 0 0 14px rgba(110, 181, 255, 0.1) !important;
  }

  :deep(.chat-rich-text),
  :deep(.chat-write-wrap),
  :deep(.chat-write-input) {
    font-family: var(--font-title);
    font-size: var(--text-sm);
    color: var(--color-value);
  }

  :deep(.chat-placeholder-wrap) {
    font-family: var(--font-title);
    color: rgba(139, 184, 232, 0.65) !important;
  }

  :deep(.elx-sender-action-btn),
  :deep(.el-button) {
    border-color: rgba(94, 235, 240, 0.45) !important;
    background: linear-gradient(180deg, rgba(94, 235, 240, 0.35), rgba(62, 184, 196, 0.25)) !important;
    color: #e8f6ff !important;
  }
}
</style>

<!-- 覆盖 BubbleList 内联/变量默认灰底 -->
<style lang="less">
.home-ai-panel .home-ai-chat {
  [class*='elx-bubble'][class*='end'] [class*='content'],
  .elx-bubble-end [class*='content'] {
    color: #e8f6ff !important;
    background: linear-gradient(135deg, rgba(94, 235, 240, 0.38), rgba(62, 160, 220, 0.22)) !important;
    background-color: rgba(20, 72, 120, 0.75) !important;
    border: 1px solid rgba(94, 235, 240, 0.45) !important;
  }

  [class*='elx-bubble'][class*='start'] [class*='content'],
  .elx-bubble-start [class*='content'] {
    color: #d6e8ff !important;
    background: linear-gradient(180deg, rgba(110, 181, 255, 0.28), rgba(40, 100, 180, 0.18)) !important;
    background-color: rgba(14, 42, 78, 0.82) !important;
    border: 1px solid rgba(158, 202, 255, 0.32) !important;
  }
}
</style>
