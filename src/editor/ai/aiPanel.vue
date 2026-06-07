<template>
  <div>
    <el-button
      circle
      type="primary"
      class="ai-float-btn"
      :style="{ transform: `translate3d(${btn.x}px, ${btn.y}px, 0)` }"
      @mousedown="onBtnMouseDown"
    >
      <el-icon><ChatDotRound /></el-icon>
    </el-button>

    <div v-show="open" class="ai-chat-box" :style="{ left: box.x + 'px', top: box.y + 'px', width: box.w + 'px', height: box.h + 'px' }">
      <div class="ai-chat-header" @mousedown="onDragStart">
        <span class="ai-header-label">AI 助手</span>
        <div class="ai-header-actions" @mousedown.stop>
          <el-tooltip content="历史对话" :show-after="400">
            <span>
              <el-dropdown trigger="click" :hide-on-click="false" popper-class="ai-history-dropdown">
                <el-button class="ai-header-btn" link>
                  <el-icon><Clock /></el-icon>
                </el-button>
                <template #dropdown>
                  <div class="ai-history-panel">
                    <div
                      v-for="c in chatStore.chats"
                      :key="c.id"
                      class="ai-history-item"
                      :class="{ 'is-current': c.id === chatStore.activeId }"
                    >
                      <span class="ai-history-title" @click="onSwitchChat(c.id)">{{ formatChatLabel(c) }}</span>
                      <el-button class="ai-history-del" link @click.stop="removeChat(c.id)">
                        <el-icon><Delete /></el-icon>
                      </el-button>
                    </div>
                  </div>
                </template>
              </el-dropdown>
            </span>
          </el-tooltip>
          <el-tooltip content="新建对话" :show-after="400">
            <el-button class="ai-header-btn" link :disabled="loading" @click="newChat">
              <el-icon><Plus /></el-icon>
            </el-button>
          </el-tooltip>
          <el-tooltip content="API 配置" :show-after="400">
            <el-button class="ai-header-btn" link :class="{ 'is-active': showConfig }" @click="showConfig = !showConfig; save()">
              <el-icon><Setting /></el-icon>
            </el-button>
          </el-tooltip>
          <el-button class="ai-header-btn" link @click="closePanel">
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
      </div>

      <div v-show="showConfig" class="ai-chat-settings">
        <el-input v-model="baseURL" size="small" placeholder="https://api.deepseek.com/anthropic" />
        <el-input v-model="apiKey" size="small" type="password" placeholder="DeepSeek API Key" />
        <el-input v-model="model" size="small" placeholder="deepseek-v4-pro" />
      </div>

      <div class="ai-chat-body">
        <div v-if="!messages.length" class="ai-empty">
          <div class="ai-empty-icon"><el-icon><ChatDotRound /></el-icon></div>
          <p class="ai-empty-title">想做什么场景？</p>
          <p class="ai-empty-desc">建议这样说：「先分析当前场景，再给两套方案并执行其一」「只改选中球体材质，不新增对象」</p>
        </div>
        <BubbleList v-else :list="messages" :max-height="Math.max(120, box.h - (showConfig ? 240 : 130)) + 'px'" />
      </div>

      <div class="ai-chat-footer">
        <XSender ref="senderRef" placeholder="说说你想要的效果，我会像 Three.js 大师一样帮你实现…" :loading="loading" @submit="send" @cancel="stop" />
      </div>

      <div
        v-for="dir in ['n','s','e','w','ne','nw','se','sw']"
        :key="dir"
        class="resize-handle"
        :class="'resize-' + dir"
        @mousedown="onResizeStart(dir, $event)"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { ElMessageBox } from 'element-plus'
import { ChatDotRound, Close, Plus, Setting, Clock, Delete } from '@element-plus/icons-vue'
import { BubbleList, XSender } from 'vue-element-plus-x'
import {
  chatWithSceneAi, getAiConfig, formatAiError, restoreLayout, savePanelLayout,
  loadChats, persistActiveChat, createNewChat, switchChat, deleteChat, getActiveChat, formatChatLabel,
} from './ai'

const BTN = 48
const MIN_W = 320
const MIN_H = 400
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi)
const layout = restoreLayout({ btnSize: BTN, minW: MIN_W, minH: MIN_H })
const cfg = getAiConfig()
const chatStore = ref(loadChats())
const active = getActiveChat(chatStore.value)

const open = ref(layout.open)
const showConfig = ref(layout.showConfig)
const baseURL = ref(cfg.baseURL)
const apiKey = ref(cfg.apiKey)
const model = ref(cfg.model)
const loading = ref(false)
const messages = ref(active.messages)
const senderRef = ref(null)
const btn = ref(layout.btn)
const box = ref(layout.box)
let msgId = active.msgId
let abortCtrl = null
let lastW = innerWidth

const save = () => savePanelLayout({ btn: btn.value, box: box.value, open: open.value, showConfig: showConfig.value })

function onResize() {
  const dw = innerWidth - lastW
  btn.value.x = clamp(btn.value.x + dw, 0, innerWidth - BTN)
  box.value.x = clamp(box.value.x + dw, 0, innerWidth - box.value.w)
  lastW = innerWidth
  save()
}
const persistChat = () => persistActiveChat(chatStore.value, { msgId, messages: messages.value })

async function confirmAction(message, title, okText) {
  try {
    await ElMessageBox.confirm(message, title, { confirmButtonText: okText, cancelButtonText: '取消', type: 'warning' })
    return true
  } catch {
    return false
  }
}

function applyChat(chat) {
  messages.value = chat.messages
  msgId = chat.msgId
}

async function newChat() {
  if (loading.value || !messages.value.length) return
  if (!await confirmAction('当前对话将保存到历史记录，确定新建？', '新建对话', '新建')) return
  persistChat()
  applyChat(createNewChat(chatStore.value))
}

function onSwitchChat(id) {
  if (loading.value || id === chatStore.value.activeId) return
  persistChat()
  const chat = switchChat(chatStore.value, id)
  if (chat) applyChat(chat)
}

async function removeChat(id) {
  if (loading.value) return
  const chat = chatStore.value.chats.find(c => c.id === id)
  if (!chat) return
  if (chat.messages.length && !await confirmAction(`确定删除「${formatChatLabel(chat)}」？`, '删除对话', '删除')) return
  const next = deleteChat(chatStore.value, id)
  if (next) applyChat(next)
}

function track(e, move, up, stop = false) {
  if (e.button !== 0) return
  e.preventDefault()
  if (stop) e.stopPropagation()
  const end = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', end); up?.() }
  window.addEventListener('mousemove', move)
  window.addEventListener('mouseup', end)
}

function closePanel() {
  open.value = false
  save()
}

function onBtnMouseDown(e) {
  let drag = false
  const sx = e.clientX, sy = e.clientY, ox = btn.value.x, oy = btn.value.y
  track(e, (ev) => {
    if (Math.abs(ev.clientX - sx) > 3 || Math.abs(ev.clientY - sy) > 3) drag = true
    btn.value.x = clamp(ox + ev.clientX - sx, 0, innerWidth - BTN)
    btn.value.y = clamp(oy + ev.clientY - sy, 0, innerHeight - BTN)
  }, () => { if (!drag) open.value = !open.value; save() })
}

function onDragStart(e) {
  const sx = e.clientX, sy = e.clientY, ox = box.value.x, oy = box.value.y
  track(e, (ev) => {
    box.value.x = clamp(ox + ev.clientX - sx, 0, innerWidth - box.value.w)
    box.value.y = clamp(oy + ev.clientY - sy, 0, innerHeight - box.value.h)
  }, save)
}

function onResizeStart(dir, e) {
  const sx = e.clientX, sy = e.clientY, { x, y, w, h } = box.value
  track(e, (ev) => {
    const dx = ev.clientX - sx, dy = ev.clientY - sy
    let nx = x, ny = y, nw = w, nh = h
    if (dir.includes('e')) nw = w + dx
    if (dir.includes('w')) { nw = w - dx; nx = x + dx }
    if (dir.includes('s')) nh = h + dy
    if (dir.includes('n')) { nh = h - dy; ny = y + dy }
    if (nw < MIN_W) { if (dir.includes('w')) nx -= MIN_W - nw; nw = MIN_W }
    if (nh < MIN_H) { if (dir.includes('n')) ny -= MIN_H - nh; nh = MIN_H }
    nx = clamp(nx, 0, Math.max(0, innerWidth - nw))
    ny = clamp(ny, 0, Math.max(0, innerHeight - nh))
    box.value = { x: nx, y: ny, w: clamp(nw, MIN_W, innerWidth - nx), h: clamp(nh, MIN_H, innerHeight - ny) }
  }, save, true)
}

async function send() {
  const text = senderRef.value?.getModelValue()?.text?.trim()
  if (!text || loading.value) return
  messages.value.push({ id: ++msgId, content: text, placement: 'end' })
  persistChat()
  senderRef.value?.clear()
  loading.value = true
  const aiId = ++msgId
  messages.value.push({ id: aiId, content: '', placement: 'start', loading: true })
  const patch = (fields) => { messages.value = messages.value.map(m => m.id === aiId ? { ...m, ...fields } : m) }
  const history = messages.value.filter(m => m.id !== aiId)
  abortCtrl = new AbortController()
  const { signal } = abortCtrl
  try {
    await chatWithSceneAi(text, history, baseURL.value, apiKey.value, model.value, {
      signal,
      onStatus: () => patch({ loading: true }),
      onText: content => patch({ content, loading: false }),
    })
  } catch (e) {
    if (!signal.aborted) patch({ content: formatAiError(e), loading: false })
  } finally {
    if (signal.aborted) {
      const cur = messages.value.find(m => m.id === aiId)
      patch({ content: cur?.content?.trim() || '已停止。', loading: false })
    }
    loading.value = false
    abortCtrl = null
    persistChat()
  }
}

function stop() {
  abortCtrl?.abort()
  loading.value = false
}

/** 面板内 Ctrl+C 只做文本复制，不触发编辑器 clone（编辑器只跳过 INPUT） */
function inAiPanel(el) {
  if (!el?.closest) return false
  return !!(el.closest('.ai-chat-box') || el.closest('.ai-history-dropdown'))
}

function isAiPanelKeyEvent(e) {
  if (!open.value) return false
  if (inAiPanel(e.target) || inAiPanel(document.activeElement)) return true
  for (const n of e.composedPath?.() ?? []) {
    if (n instanceof Element && inAiPanel(n)) return true
  }
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed) return false
  const toEl = (n) => (n?.nodeType === 3 ? n.parentElement : n)
  return inAiPanel(toEl(sel.anchorNode)) || inAiPanel(toEl(sel.focusNode))
}

function blockEditorHotkeys(e) {
  if (e.type !== 'keydown' || !isAiPanelKeyEvent(e)) return
  const tag = e.target?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return
  if (!(e.ctrlKey || e.metaKey)) return
  const k = e.key?.toLowerCase()
  if (k !== 'c' && k !== 'v' && k !== 'x') return
  e.stopImmediatePropagation()
}

onMounted(() => { document.addEventListener('keydown', blockEditorHotkeys, true); window.addEventListener('resize', onResize) })
onUnmounted(() => { document.removeEventListener('keydown', blockEditorHotkeys, true); window.removeEventListener('resize', onResize) })
</script>

<style scoped>
.ai-float-btn {
  position: fixed; z-index: 1000; top: 0; left: 0; width: 48px; height: 48px; font-size: 22px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
  transition: none !important;
  will-change: transform;
}
.ai-chat-box {
  position: fixed; z-index: 1001; display: flex; flex-direction: column;
  background: #252525; border: 1px solid #404040; border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45); overflow: hidden;
}
.resize-handle { position: absolute; z-index: 2; }
.resize-n, .resize-s { left: 8px; right: 8px; height: 6px; cursor: ns-resize; }
.resize-n { top: 0; } .resize-s { bottom: 0; }
.resize-e, .resize-w { top: 8px; bottom: 8px; width: 6px; cursor: ew-resize; }
.resize-e { right: 0; } .resize-w { left: 0; }
.resize-ne, .resize-nw, .resize-se, .resize-sw { width: 12px; height: 12px; }
.resize-ne { top: 0; right: 0; cursor: nesw-resize; }
.resize-nw { top: 0; left: 0; cursor: nwse-resize; }
.resize-se { right: 0; bottom: 0; cursor: nwse-resize; }
.resize-sw { left: 0; bottom: 0; cursor: nesw-resize; }
.ai-chat-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 14px; color: #e5eaf3; font-size: 14px;
  border-bottom: 1px solid #404040; cursor: move; user-select: none;
}
.ai-header-label { color: #e5eaf3; font-size: 14px; font-weight: 500; }
.ai-header-actions { display: flex; align-items: center; gap: 2px; }
.ai-header-btn { padding: 4px; color: #888; font-size: 16px; }
.ai-header-btn:hover { color: #e5eaf3; }
.ai-header-btn.is-active { color: #409eff; }
.ai-history-panel { min-width: 220px; max-width: 300px; max-height: 280px; overflow-y: auto; padding: 4px 0; }
.ai-history-item {
  display: flex; align-items: center; gap: 4px; padding: 8px 10px 8px 12px;
}
.ai-history-item:hover { background: #333; }
.ai-history-item.is-current { background: #1a1a1a; }
.ai-history-item.is-current .ai-history-title { color: #409eff; }
.ai-history-title {
  flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 13px; color: #ccc; cursor: pointer;
}
.ai-history-title:hover { color: #e5eaf3; }
.ai-history-del { padding: 2px; color: #666; font-size: 14px; flex-shrink: 0; }
.ai-history-del:hover { color: #f56c6c; }
.ai-chat-settings { display: flex; flex-direction: column; gap: 6px; padding: 8px 12px; border-bottom: 1px solid #333; }
.ai-chat-body { flex: 1; padding: 12px; overflow: hidden; min-height: 0; user-select: text; }
.ai-empty {
  height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; padding: 24px 16px;
}
.ai-empty-icon {
  width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;
  margin-bottom: 14px; border-radius: 10px; background: #1a1a1a; border: 1px solid #404040;
  color: #409eff; font-size: 22px;
}
.ai-empty-title { margin: 0 0 8px; color: #e5eaf3; font-size: 15px; font-weight: 500; }
.ai-empty-desc { margin: 0; color: #888; font-size: 13px; line-height: 1.6; max-width: 240px; }
.ai-chat-body :deep(.elx-bubble__content), .ai-chat-body :deep(.elx-bubble__text) { user-select: text; cursor: text; }
.ai-chat-settings :deep(.el-input__wrapper) { background: #1a1a1a; box-shadow: 0 0 0 1px #404040 inset; }
.ai-chat-settings :deep(.el-input__inner) { color: #e5eaf3; }
.ai-chat-footer {
  padding: 8px 12px 12px; border-top: 1px solid #404040;
  --chat-text: #e5eaf3; --chat-text-placeholder: #888; --chat-box: #1a1a1a;
  --chat-input: #1a1a1a; --chat-input-border: #404040; --chat-card: #333;
}
.ai-chat-footer :deep(.elx-x-sender) { background: #1a1a1a; }
.ai-chat-footer :deep(.chat-rich-text), .ai-chat-footer :deep(.chat-write-wrap), .ai-chat-footer :deep(.chat-write-input) { color: #e5eaf3; }
.ai-chat-footer :deep(.chat-placeholder-wrap) { color: #888 !important; }
:global(.ai-history-dropdown.el-popper) {
  background: #2a2a2a !important;
  border: 1px solid #404040 !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45) !important;
}
:global(.ai-history-dropdown.el-popper .el-popper__arrow::before) {
  background: #2a2a2a !important;
  border-color: #404040 !important;
}
</style>
