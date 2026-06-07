import {
  CFG_KEY,
  CHATS_KEY,
  DEFAULT_AI_CONFIG,
  LAYOUT_KEY,
} from './config.js'
import {
  getEditorApi,
  getEditorSettings,
  listEditorActions,
  listObjects,
  openEditorPanel,
  runEditorAction,
} from './core.js'
import { runSceneAi } from './runtime.js'

export { buildSystemPrompt, createSceneTools, SCENE_SYSTEM } from './runtime.js'

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi)

function loadJson(key, legacyKey) {
  try {
    let raw = localStorage.getItem(key)
    if (!raw && legacyKey) {
      raw = localStorage.getItem(legacyKey)
      if (raw) localStorage.setItem(key, raw)
    }
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function normUrl(url) {
  return (url || DEFAULT_AI_CONFIG.baseURL).trim().replace(/\/+$/, '')
}

function chatTitle(messages) {
  const first = messages.find((m) => m.placement === 'end' && m.content?.trim())
  if (!first) return ''
  const t = first.content.trim()
  return t.length > 24 ? `${t.slice(0, 24)}...` : t
}

export function formatChatLabel(chat) {
  const title = chatTitle(chat.messages)
  if (title) return title
  const d = new Date(chat.updatedAt || Date.now())
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `新对话 ${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`
}

function emptyChat(id = String(Date.now())) {
  return { id, msgId: 0, messages: [], updatedAt: Date.now() }
}

function migrateLegacyChat(store) {
  if (store.chats.length) return store
  const legacy = loadJson('AI_chat')
  if (!legacy?.messages?.length) return store

  const id = String(Date.now())
  store.chats.unshift({
    id,
    msgId: legacy.msgId || 0,
    messages: legacy.messages.filter((m) => !m.loading),
    updatedAt: Date.now(),
  })
  store.activeId = id
  return store
}

export function loadChats() {
  let store = loadJson(CHATS_KEY) || { activeId: '', chats: [] }
  store = migrateLegacyChat(store)

  if (!store.chats.length) {
    const chat = emptyChat()
    store = { activeId: chat.id, chats: [chat] }
    saveChats(store)
  }

  if (!store.chats.some((c) => c.id === store.activeId)) {
    store.activeId = store.chats[0].id
    saveChats(store)
  }

  return store
}

export function saveChats(store) {
  localStorage.setItem(CHATS_KEY, JSON.stringify(store))
}

export function getActiveChat(store) {
  return store.chats.find((c) => c.id === store.activeId) || store.chats[0]
}

export function persistActiveChat(store, { msgId, messages }) {
  const chat = getActiveChat(store)
  const list = messages.filter((m) => !m.loading)
  chat.msgId = msgId
  chat.messages = list
  chat.updatedAt = Date.now()
  saveChats(store)
}

export function createNewChat(store) {
  const current = getActiveChat(store)
  if (!current.messages.length) return current

  const chat = emptyChat()
  store.chats.unshift(chat)
  if (store.chats.length > 30) store.chats.length = 30
  store.activeId = chat.id
  saveChats(store)
  return chat
}

export function switchChat(store, id) {
  const chat = store.chats.find((c) => c.id === id)
  if (!chat || store.activeId === id) return null
  store.activeId = id
  saveChats(store)
  return chat
}

export function deleteChat(store, id) {
  const idx = store.chats.findIndex((c) => c.id === id)
  if (idx === -1) return null

  const wasActive = store.activeId === id
  store.chats.splice(idx, 1)

  if (!store.chats.length) {
    const chat = emptyChat()
    store.chats.push(chat)
    store.activeId = chat.id
    saveChats(store)
    return chat
  }

  if (wasActive) store.activeId = store.chats[0].id
  saveChats(store)
  return wasActive ? getActiveChat(store) : null
}

export function getAiConfig() {
  const saved = loadJson(CFG_KEY) || {}
  return {
    ...DEFAULT_AI_CONFIG,
    ...saved,
    baseURL: normUrl(saved.baseURL),
  }
}

export function formatAiError(err) {
  const msg = (err?.message || String(err)).trim()
  if (/insufficient balance/i.test(msg)) return '账户余额不足，请充值后再试。'
  if (/invalid api key|authentication/i.test(msg)) return 'API Key 无效，请重新检查配置。'
  return msg || '请求失败'
}

function saveAiConfig(baseURL, apiKey, model) {
  const key = apiKey?.trim()
  if (!key) throw new Error('请填写 DeepSeek API Key')

  const config = {
    baseURL: normUrl(baseURL),
    apiKey: key,
    model: model?.trim() || DEFAULT_AI_CONFIG.model,
  }

  localStorage.setItem(CFG_KEY, JSON.stringify(config))
  return config
}

export async function chatWithSceneAi(
  userMessage,
  history,
  baseURL,
  apiKey,
  model,
  { onText, onStatus, signal } = {},
) {
  const editor = window.threeEditor
  if (!editor) throw new Error('编辑器尚未就绪，请等待场景加载完成')

  const config = saveAiConfig(baseURL, apiKey, model)

  return runSceneAi({
    editor,
    userMessage,
    history,
    config,
    onText,
    onStatus,
    signal,
  })
}

export function restoreLayout({ btnSize = 48, minW = 320, minH = 400 } = {}) {
  const saved = loadJson(LAYOUT_KEY, 'ai_panel_layout')

  const btn = saved?.btn
    ? {
        x: clamp(saved.btn.x, 0, innerWidth - btnSize),
        y: clamp(saved.btn.y, 0, innerHeight - btnSize),
      }
    : {
        x: Math.max(0, innerWidth - 365),
        y: Math.max(0, innerHeight - 80),
      }

  const box = saved?.box
    ? {
        x: clamp(saved.box.x, 0, innerWidth - minW),
        y: clamp(saved.box.y, 0, innerHeight - minH),
        w: clamp(saved.box.w, minW, innerWidth),
        h: clamp(saved.box.h, minH, innerHeight),
      }
    : {
        x: Math.max(0, innerWidth - 680),
        y: 160,
        w: 380,
        h: 520,
      }

  return {
    btn,
    box,
    open: !!saved?.open,
    showConfig: saved?.showConfig ?? true,
  }
}

export function savePanelLayout(layout) {
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout))
}

export function mountSceneAI(threeEditor) {
  window.sceneAI = {
    list: () => listObjects(threeEditor),
    getSettings: () => getEditorSettings(threeEditor),
    getApi: () => getEditorApi(threeEditor),
    listActions: () => listEditorActions(threeEditor),
    run: (action, params) => runEditorAction(threeEditor, { action, params: params || {} }),
    openPanel: (panel) => openEditorPanel(threeEditor, typeof panel === 'string' ? { panel } : panel || {}),
  }
}
