/**
 * 大屏导航 AI：专业三维空间理解 · 美学机位规划 · 自主导览漫游
 */
import { createAnthropic } from '@ai-sdk/anthropic'
import { streamText, stepCountIs } from 'ai'
import { z } from 'zod/v4'
import { CFG_KEY, DEFAULT_AI_CONFIG } from '../editor/ai/config.js'
import {
  mk,
  vec3req,
  allSceneTools,
  inspectScene,
  listObjects,
  focusScene,
  runEditorAction,
  getLiveContext,
} from '../editor/ai/core.js'

const CHATS_KEY = 'HOME_AI_chats'
const LAYOUT_KEY = 'HOME_AI_layout'
const DEFAULT_HOME_AI_API_KEY = ''
const MAX_HISTORY = 10
const MAX_STEPS = 18

const TOOL_STATUS = {
  analyzeSpatial: '空间分析',
  planBeautifulTour: '美学导览',
  runViewTour: '执行路线',
  inspectScene: '看场景',
  listObjects: '列对象',
  focusTarget: '飞到对象',
  focusOverview: '全景',
  setCamera: '定视角',
  listSavedViews: '列视角',
  flyToSavedView: '切视角',
  setRoaming: '漫游',
}

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi)
const r1 = (n) => Math.round(n * 10) / 10

/** 专业镜头预设（Y 上 / 地面 XZ） */
function suggestAestheticShots(bounds, label = '') {
  if (!bounds?.center || !bounds?.size) return []
  const [cx, cy, cz] = bounds.center
  const [sx, sy, sz] = bounds.size
  const span = Math.max(sx, sy, sz, 1)
  const distFar = clamp(span * 4.8, 8, 140)
  const distMid = clamp(span * 3.2, 5, 100)
  const distNear = clamp(span * 2.0, 3, 60)
  const lookY = cy + sy * 0.32
  const eyeY = (y, factor) => r1(cy + sy * factor)

  return [
    {
      preset: 'establishing',
      label: `${label}远景建立`,
      position: [r1(cx - distFar * 0.15), r1(eyeY(0, 0.55)), r1(cz + distFar)],
      target: [r1(cx), r1(lookY), r1(cz)],
      composition: '远景，主体约占画面 25~35%，交代环境',
      fovHint: '适合开场与区域认知',
    },
    {
      preset: 'hero',
      label: `${label}主视角`,
      position: [r1(cx + distMid * 0.2), r1(eyeY(0, 0.42)), r1(cz + distMid * 0.92)],
      target: [r1(cx), r1(lookY), r1(cz)],
      composition: '3/4 前方略偏，视线高度约物体 40%，数字孪生主展示位',
      fovHint: '默认最优观看位',
    },
    {
      preset: 'detail',
      label: `${label}近景`,
      position: [r1(cx + distNear * 0.35), r1(eyeY(0, 0.28)), r1(cz + distNear * 0.7)],
      target: [r1(cx), r1(cy + sy * 0.2), r1(cz)],
      composition: '近景，突出设备细节与质感',
      fovHint: '巡检问题点时使用',
    },
    {
      preset: 'aerial',
      label: `${label}俯瞰`,
      position: [r1(cx), r1(cy + distMid * 1.05), r1(cz + distMid * 0.35)],
      target: [r1(cx), r1(cy), r1(cz)],
      composition: '斜俯视，读产线平面布局与动线',
      fovHint: '理解空间关系与分区',
    },
    {
      preset: 'lateral',
      label: `${label}侧向`,
      position: [r1(cx - distMid), r1(eyeY(0, 0.38)), r1(cz + distMid * 0.25)],
      target: [r1(cx), r1(lookY), r1(cz)],
      composition: '侧向透视，强调纵深与前后遮挡',
      fovHint: '多设备一字排开时',
    },
  ]
}

function pickTourLandmarks(spatial, max = 4) {
  const lms = spatial.landmarks || []
  const picked = []
  const used = new Set()

  for (const q of ['center', 'east', 'west', 'north', 'south']) {
    for (const { id } of spatial.quadrants[q] || []) {
      if (picked.length >= max) break
      const lm = lms.find((l) => l.id === id)
      if (lm && !used.has(id)) {
        picked.push(lm)
        used.add(id)
      }
    }
  }
  for (const lm of lms) {
    if (picked.length >= max) break
    if (!used.has(lm.id)) {
      picked.push(lm)
      used.add(lm.id)
    }
  }
  return picked.slice(0, max)
}

function buildSpatialAnalysis(editor) {
  const scene = inspectScene(editor, { includeObjects: true })
  const items = (scene.objects || []).filter((o) => o.bounds?.center)
  if (!items.length) {
    return { ready: false, error: '场景无可用包围盒对象', spatial: scene.spatial }
  }

  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity
  const landmarks = []

  for (const o of items) {
    const [cx, cy, cz] = o.bounds.center
    const [sx, sy, sz] = o.bounds.size
    minX = Math.min(minX, cx - sx / 2)
    minY = Math.min(minY, o.bounds.bottomY ?? cy - sy / 2)
    minZ = Math.min(minZ, cz - sz / 2)
    maxX = Math.max(maxX, cx + sx / 2)
    maxY = Math.max(maxY, o.bounds.topY ?? cy + sy / 2)
    maxZ = Math.max(maxZ, cz + sz / 2)
    landmarks.push({
      id: o.id,
      name: o.name,
      role: o.role,
      center: o.bounds.center.map(r1),
      size: o.bounds.size.map(r1),
      bottomY: r1(o.bounds.bottomY ?? cy - sy / 2),
      topY: r1(o.bounds.topY ?? cy + sy / 2),
      volume: r1(sx * sy * sz),
    })
  }

  landmarks.sort((a, b) => b.volume - a.volume)
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const cz = (minZ + maxZ) / 2
  const spanX = maxX - minX
  const spanZ = maxZ - minZ

  const quadrants = { east: [], west: [], north: [], south: [], center: [] }
  for (const o of landmarks) {
    const [ox, , oz] = o.center
    const dx = ox - cx
    const dz = oz - cz
    const tag =
      Math.abs(dx) < spanX * 0.15 && Math.abs(dz) < spanZ * 0.15
        ? 'center'
        : Math.abs(dx) >= Math.abs(dz)
          ? dx > 0
            ? 'east'
            : 'west'
          : dz > 0
            ? 'north'
            : 'south'
    quadrants[tag].push({ id: o.id, name: o.name, volume: o.volume })
  }

  const sceneBounds = {
    min: [r1(minX), r1(minY), r1(minZ)],
    max: [r1(maxX), r1(maxY), r1(maxZ)],
    center: [r1(cx), r1(cy), r1(cz)],
    size: [r1(spanX), r1(maxY - minY), r1(spanZ)],
  }

  const layoutAxis =
    spanX >= spanZ * 1.15
      ? 'east-west（沿 X 展开，巡检宜东西向递进）'
      : spanZ >= spanX * 1.15
        ? 'north-south（沿 Z 展开，巡检宜南北向递进）'
        : 'compact（近方形场地，宜环绕+中心地标）'

  const topLandmarks = landmarks.slice(0, 14).map((lm) => ({
    ...lm,
    suggestedViews: suggestAestheticShots(
      { center: lm.center, size: lm.size, bottomY: lm.bottomY, topY: lm.topY },
      lm.name,
    ),
  }))

  const overviewShots = suggestAestheticShots(
    { center: sceneBounds.center, size: sceneBounds.size },
    '全场景',
  )

  const cam = editor.camera?.position
  const tgt = editor.controls?.target
  const roamSpeed = clamp((spanX + spanZ) / 400, 0.35, 0.75)

  return {
    ready: true,
    axes: { up: '+Y', ground: 'XZ', east: '+X', north: '+Z' },
    layoutAxis,
    spatial: scene.spatial,
    sceneBounds,
    objectCount: items.length,
    quadrants,
    landmarks: topLandmarks,
    overviewShots,
    roamRecommend: { speed: r1(roamSpeed), note: '大场景用 0.35~0.55，展示细节后开环绕' },
    currentCamera: cam
      ? {
          position: [r1(cam.x), r1(cam.y), r1(cam.z)],
          target: tgt ? [r1(tgt.x), r1(tgt.y), r1(tgt.z)] : null,
        }
      : null,
    compositionGuide: [
      '开场用 establishing/overview，主体用 hero，布局用 aerial，细节用 detail',
      '相邻机位避免同角度连跳，保持 30°~90° 方向变化',
      '相机高度多在物体 0.35~0.55 倍高度，避免贴地或正顶俯视',
      '每站停留 1.2~1.8s，运镜 duration 0.8~1.1s',
    ],
  }
}

/** 根据空间分析自动生成美学导览步骤 */
function buildBeautifulTourSteps(spatial, { theme = 'factory', landmarkIds, shotPreset = 'hero', maxStops = 4, includeRoam = false }) {
  const steps = []
  steps.push({
    type: 'overview',
    label: '全景建立',
    duration: 1.1,
    pauseMs: 1500,
  })

  let targets = []
  if (landmarkIds?.length) {
    targets = (spatial.landmarks || []).filter((l) => landmarkIds.includes(l.id))
  } else if (theme === 'zone-east') {
    targets = (spatial.quadrants.east || [])
      .map((q) => spatial.landmarks.find((l) => l.id === q.id))
      .filter(Boolean)
      .slice(0, maxStops)
  } else if (theme === 'zone-north') {
    targets = (spatial.quadrants.north || [])
      .map((q) => spatial.landmarks.find((l) => l.id === q.id))
      .filter(Boolean)
      .slice(0, maxStops)
  } else {
    targets = pickTourLandmarks(spatial, theme === 'quick' ? 2 : maxStops)
  }

  const presets = theme === 'layout' ? ['aerial', 'establishing'] : [shotPreset, 'hero', 'establishing']

  for (const lm of targets) {
    const shot =
      lm.suggestedViews?.find((s) => presets.includes(s.preset)) || lm.suggestedViews?.[1] || lm.suggestedViews?.[0]
    if (!shot) continue
    steps.push({
      type: 'camera',
      label: `${lm.name}·${shot.label}`,
      position: shot.position,
      target: shot.target,
      duration: 0.9,
      pauseMs: 1700,
      composition: shot.composition,
    })
  }

  const closing =
    spatial.overviewShots?.find((s) => s.preset === 'aerial') || spatial.overviewShots?.[0]
  if (closing && steps.length < 8) {
    steps.push({
      type: 'camera',
      label: '俯瞰收束',
      position: closing.position,
      target: closing.target,
      duration: 1,
      pauseMs: 1200,
    })
  }

  if (includeRoam && steps.length < 8) {
    steps.push({
      type: 'roam',
      label: '慢速环绕',
      enabled: true,
      speed: spatial.roamRecommend?.speed ?? 0.5,
      pauseMs: 0,
    })
  }

  return steps.slice(0, 8)
}

function loadJson(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function normUrl(url) {
  return (url || DEFAULT_AI_CONFIG.baseURL).trim().replace(/\/+$/, '')
}

function emptyChat(id = String(Date.now())) {
  return { id, msgId: 0, messages: [], updatedAt: Date.now() }
}

function clampRoamingSpeed(speed, controls, fallback = 0.5) {
  const s = clamp(Number(speed) || fallback, 0.15, 1.2)
  if (controls) {
    controls.autoRotateSpeed = s
    if (controls.dampingFactor != null) {
      controls.enableDamping = true
      controls.dampingFactor = clamp(controls.dampingFactor || 0.05, 0.03, 0.12)
    }
  }
  return s
}

async function runViewTour(editor, sceneTools, { steps, stopRoamFirst = true }) {
  if (!Array.isArray(steps) || !steps.length) return { error: 'steps 为空' }
  if (stopRoamFirst && editor.controls) editor.controls.autoRotate = false

  const done = []
  for (const step of steps.slice(0, 8)) {
    const duration = step.duration ?? 0.85
    let out
    switch (step.type) {
      case 'overview':
        out = await focusScene(editor, duration)
        break
      case 'focus':
        if (step.objectId == null) return { error: 'focus 需要 objectId', completed: done }
        out = await sceneTools.focusObject.execute({ id: step.objectId, duration })
        break
      case 'camera':
        if (!step.position || !step.target) return { error: 'camera 需要 position+target', completed: done }
        out = await sceneTools.focusView.execute({ position: step.position, target: step.target, duration })
        break
      case 'savedView':
        out = await runEditorAction(editor, { action: 'flyToViewAngle', params: { index: step.index ?? 0 } })
        break
      case 'roam':
        if (editor.controls) {
          editor.controls.autoRotate = !!step.enabled
          if (step.enabled) clampRoamingSpeed(step.speed, editor.controls, 0.5)
        }
        out = { roaming: !!step.enabled }
        break
      default:
        out = { error: `未知 step.type: ${step.type}` }
    }
    done.push({ type: step.type, label: step.label, result: out })
    if (out?.error) return { error: out.error, completed: done }
    if (step.pauseMs > 0) await new Promise((res) => setTimeout(res, step.pauseMs))
  }
  return { completed: done.length, tour: done }
}

function createHomeAiTools(editor) {
  const sceneTools = allSceneTools(editor)

  return {
    analyzeSpatial: mk(
      '【必调】专业空间分析：场景尺度、产线展开方向 layoutAxis、象限分布、地标、每地标 5 种美学机位(establishing/hero/detail/aerial/lateral)、漫游速度建议',
      z.object({ focusId: z.number().optional() }),
      ({ focusId }) => {
        const full = buildSpatialAnalysis(editor)
        if (!full.ready) return full
        if (focusId == null) return full
        const one = full.landmarks.find((l) => l.id === focusId)
        return one
          ? { focus: one, sceneBounds: full.sceneBounds, layoutAxis: full.layoutAxis, compositionGuide: full.compositionGuide }
          : { error: `未找到 id=${focusId}`, landmarks: full.landmarks.map((l) => ({ id: l.id, name: l.name })) }
      },
    ),

    planBeautifulTour: mk(
      '【自主美学导览】根据空间分析自动生成专业镜头路线（远景建立→地标主视角→俯瞰收束→可选环绕）。execute=true 时立即执行',
      z.object({
        theme: z
          .enum(['factory', 'quick', 'layout', 'zone-east', 'zone-north'])
          .optional()
          .describe('factory=全厂巡检 quick=2站 layout=偏俯瞰 zone-east/north=分区'),
        landmarkIds: z.array(z.number()).optional().describe('指定地标 id 列表，不传则自动选'),
        shotPreset: z.enum(['hero', 'establishing', 'detail', 'aerial', 'lateral']).optional(),
        maxStops: z.number().int().min(1).max(5).optional(),
        includeRoam: z.boolean().optional().describe('末段开启慢速环绕'),
        execute: z.boolean().optional().describe('true=生成后立刻 runViewTour'),
      }),
      async (input) => {
        const spatial = buildSpatialAnalysis(editor)
        if (!spatial.ready) return spatial
        const steps = buildBeautifulTourSteps(spatial, {
          theme: input.theme || 'factory',
          landmarkIds: input.landmarkIds,
          shotPreset: input.shotPreset || 'hero',
          maxStops: input.maxStops ?? 4,
          includeRoam: !!input.includeRoam,
        })
        const plan = {
          theme: input.theme || 'factory',
          layoutAxis: spatial.layoutAxis,
          stopCount: steps.length,
          steps: steps.map((s) => ({
            type: s.type,
            label: s.label,
            objectId: s.objectId,
            position: s.position,
            target: s.target,
            pauseMs: s.pauseMs,
            composition: s.composition,
          })),
          compositionGuide: spatial.compositionGuide,
        }
        if (!input.execute) return plan
        const run = await runViewTour(editor, sceneTools, { steps, stopRoamFirst: true })
        return { ...plan, executed: run }
      },
    ),

    runViewTour: mk(
      '手动提交导览步骤（已由 planBeautifulTour 生成时可原样传入 steps）',
      z.object({
        steps: z.array(
          z.object({
            type: z.enum(['overview', 'focus', 'camera', 'savedView', 'roam']),
            label: z.string().optional(),
            objectId: z.number().optional(),
            position: vec3req.optional(),
            target: vec3req.optional(),
            index: z.number().int().min(0).optional(),
            enabled: z.boolean().optional(),
            speed: z.number().min(0.1).max(3).optional(),
            duration: z.number().min(0.1).max(5).optional(),
            pauseMs: z.number().int().min(0).max(8000).optional(),
          }),
        ).min(1).max(8),
        stopRoamFirst: z.boolean().optional(),
      }),
      (input) => runViewTour(editor, sceneTools, input),
    ),

    inspectScene: mk(
      '查看对象与 spatial；规划前优先 analyzeSpatial',
      z.object({ id: z.number().optional() }),
      (input) => inspectScene(editor, { ...input, includeObjects: true }),
    ),

    listObjects: mk(
      '按名称搜索对象及 bounds',
      z.object({ name: z.string().optional() }),
      ({ name }) => {
        const items = listObjects(editor, name ? { name } : {})
        return {
          count: items.length,
          objects: items.slice(0, 50).map((o) => ({
            id: o.id,
            name: o.name,
            role: o.role,
            bounds: o.bounds,
            position: o.position,
          })),
        }
      },
    ),

    focusTarget: mk(
      '飞到对象（编辑器内置最优包围盒视角）',
      z.object({ objectId: z.number(), duration: z.number().min(0.1).max(5).optional() }),
      ({ objectId, duration }) => sceneTools.focusObject.execute({ id: objectId, duration: duration ?? 0.85 }),
    ),

    focusOverview: mk('全场景远景建立', z.object({ duration: z.number().optional() }), ({ duration }) =>
      focusScene(editor, duration ?? 1),
    ),

    setCamera: mk(
      '飞到 analyzeSpatial / planBeautifulTour 给出的 position+target',
      z.object({ position: vec3req, target: vec3req, duration: z.number().optional() }),
      ({ position, target, duration }) =>
        sceneTools.focusView.execute({ position, target, duration: duration ?? 0.85 }),
    ),

    listSavedViews: mk('已保存视角', z.object({}), () =>
      runEditorAction(editor, { action: 'listViewAngles', params: {} }),
    ),

    flyToSavedView: mk(
      '飞到已保存视角',
      z.object({ index: z.number().int().min(0) }),
      ({ index }) => runEditorAction(editor, { action: 'flyToViewAngle', params: { index } }),
    ),

    setRoaming: mk(
      '慢速环绕漫游；大屏展示建议 speed 0.35~0.6',
      z.object({ enabled: z.boolean(), speed: z.number().min(0.15).max(1.2).optional() }),
      ({ enabled, speed }) => {
        const controls = editor?.controls
        if (!controls) return { error: '轨道控制器未就绪' }
        controls.autoRotate = !!enabled
        const spatial = buildSpatialAnalysis(editor)
        const fallback = spatial.ready ? spatial.roamRecommend?.speed : 0.5
        return { roaming: !!enabled, speed: enabled ? clampRoamingSpeed(speed, controls, fallback) : null }
      },
    ),
  }
}

function buildHomeAiPrompt(live) {
  const lines = []
  if (live?.ready) {
    lines.push(`对象数：${live.count}，地面 Y≈${live.groundY}`)
    if (live.layoutAxis) lines.push(`空间展开：${live.layoutAxis}`)
    if (live.sceneSize) lines.push(`场景尺度：${live.sceneSize.join(' × ')}`)
    if (live.roamSpeed) lines.push(`建议漫游速度：${live.roamSpeed}`)
    if (live.snapshot?.length) {
      lines.push('地标快照：')
      live.snapshot.forEach((s) => lines.push(`  ${s}`))
    }
  } else {
    lines.push('场景尚未就绪')
  }

  return `你是「数字孪生大屏」首席空间导航导演，精通三维空间推理与影视化机位设计。坐标：Y 上，地面 XZ。

## 当前场景
${lines.join('\n')}

## 专业能力
1. **空间理解**：读 bounds/象限/layoutAxis，判断产线走向、设备相对位置、何者为主地标
2. **美学机位**：establishing 建立 → hero 主展示 → detail 细节 → aerial 布局 → lateral 纵深；控制高度比例与方向变化
3. **自主规划**：用户说参观/巡检/好看/漫游时，先 analyzeSpatial，再 planBeautifulTour(execute:true)，勿只飞一次
4. **漫游**：展示完关键机位后再 setRoaming 或 planBeautifulTour(includeRoam:true)，速度宜慢(0.35~0.6)

## 工作流（强制）
- 模糊需求：analyzeSpatial → planBeautifulTour({ theme:'factory', execute:true, includeRoam: 用户要漫游 })
- 指定区域：theme=zone-east/zone-north 或 landmarkIds
- 只要布局：theme=layout，多用 aerial/establishing
- 单点：analyzeSpatial(focusId) → setCamera 用 hero 机位

## 工具
analyzeSpatial | planBeautifulTour | runViewTour | setCamera | focusTarget | focusOverview | setRoaming | listObjects

## 禁止
改场景内容、加载模型、开编辑器面板。禁止只文字不调用工具。

## 回复
用导演口吻简述：空间判断 → 路线设计（几镜、为何好看）→ 已执行效果。`
}

function getHomeLiveContext(editor) {
  const live = getLiveContext(editor)
  if (!live.ready) return live
  const spatial = buildSpatialAnalysis(editor)
  const views = editor?.other?.viewAngleList || []
  return {
    ready: true,
    count: live.count,
    groundY: spatial.ready ? spatial.sceneBounds?.center?.[1] : live.groundY,
    sceneSize: spatial.ready ? spatial.sceneBounds?.size : null,
    layoutAxis: spatial.ready ? spatial.layoutAxis : null,
    roamSpeed: spatial.ready ? spatial.roamRecommend?.speed : null,
    snapshot: live.snapshot,
    savedViews: views.map((v, i) => ({ index: i, name: v.name })),
  }
}

function normalizeHistory(history = []) {
  return history
    .filter((m) => m.content?.trim() && !m.loading)
    .map((m) => ({
      role: m.placement === 'end' ? 'user' : 'assistant',
      content: String(m.content).trim().slice(0, 500),
    }))
    .slice(-MAX_HISTORY)
}

function mergeText(current, chunk) {
  const next = String(chunk || '')
  if (!next) return current
  if (!current) return next
  if (next.startsWith(current)) return next
  const limit = Math.min(current.length, next.length)
  for (let i = limit; i > 0; i--) {
    if (current.slice(-i) === next.slice(0, i)) return current + next.slice(i)
  }
  return current + next
}

async function runHomeAi({ editor, userMessage, history, config, onText, onStatus, signal }) {
  const system = buildHomeAiPrompt(getHomeLiveContext(editor))
  const tools = createHomeAiTools(editor)
  const messages = normalizeHistory(history)

  onStatus?.('空间规划…')

  const result = streamText({
    model: createAnthropic({ baseURL: config.baseURL, apiKey: config.apiKey })(config.model),
    system,
    messages: [...messages, { role: 'user', content: userMessage }],
    tools,
    stopWhen: stepCountIs(MAX_STEPS),
    abortSignal: signal,
  })

  let draft = ''
  const steps = []

  try {
    for await (const part of result.fullStream) {
      if (signal?.aborted) break
      if (part.type === 'tool-call') {
        const label = TOOL_STATUS[part.toolName] || part.toolName
        steps.push(label)
        onStatus?.(`${label}...`)
      }
      if (part.type === 'text-delta') {
        const chunk = part.text ?? part.delta ?? ''
        if (!chunk) continue
        draft = mergeText(draft, chunk)
        onText?.(draft)
      }
    }

    if (signal?.aborted) return draft || '已停止。'

    let final = (await result.text)?.trim() || draft || (steps.length ? '美学导览已完成。' : '好的。')
    if (steps.length && !/导览|镜头|漫游|视角|巡检|参观|飞到/.test(final)) {
      final = `${final}\n（${steps.join(' → ')}）`
    }
    onText?.(final)
    return final
  } catch (e) {
    if (signal?.aborted || e?.name === 'AbortError') return draft || '已停止。'
    throw e
  }
}

function saveAiConfig(baseURL, apiKey, model) {
  const key = apiKey?.trim() || DEFAULT_HOME_AI_API_KEY
  const config = {
    baseURL: normUrl(baseURL),
    apiKey: key,
    model: model?.trim() || DEFAULT_AI_CONFIG.model,
  }
  localStorage.setItem(CFG_KEY, JSON.stringify(config))
  return config
}

export function getAiConfig() {
  const saved = loadJson(CFG_KEY) || {}
  return { ...DEFAULT_AI_CONFIG, ...saved, baseURL: normUrl(saved.baseURL), apiKey: saved.apiKey?.trim() || DEFAULT_HOME_AI_API_KEY }
}

export function formatAiError(err) {
  const msg = (err?.message || String(err)).trim()
  if (/insufficient balance/i.test(msg)) return '账户余额不足，请充值后再试。'
  if (/invalid api key|authentication/i.test(msg)) return 'API Key 无效，请检查设置。'
  return msg || '请求失败'
}

export function loadChats() {
  let store = loadJson(CHATS_KEY) || { activeId: '', chats: [] }
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
  chat.msgId = msgId
  chat.messages = messages.filter((m) => !m.loading)
  chat.updatedAt = Date.now()
  saveChats(store)
}

export function createNewChat(store) {
  const current = getActiveChat(store)
  if (!current.messages.length) return current
  const chat = emptyChat()
  store.chats.unshift(chat)
  if (store.chats.length > 20) store.chats.length = 20
  store.activeId = chat.id
  saveChats(store)
  return chat
}

export function restoreLayout({ panelW = 360, panelH = 440, fabSize = 52 } = {}) {
  const saved = loadJson(LAYOUT_KEY)
  const panel = saved?.panel
    ? { x: clamp(saved.panel.x, 0, innerWidth - panelW), y: clamp(saved.panel.y, 0, innerHeight - panelH) }
    : { x: Math.max(0, innerWidth - 860), y: Math.max(80, innerHeight - panelH - 120) }
  const fab = saved?.fab
    ? { x: clamp(saved.fab.x, 0, innerWidth - fabSize), y: clamp(saved.fab.y, 0, innerHeight - fabSize) }
    : { x: Math.max(0, innerWidth - 560), y: Math.max(0, innerHeight - fabSize - 108) }
  return { panel, fab, open: !!saved?.open }
}

export function saveLayout(layout) {
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout))
}

export async function chatWithHomeAi(
  userMessage,
  history,
  baseURL,
  apiKey,
  model,
  { onText, onStatus, signal } = {},
) {
  const editor = window.threeEditor || window.editor
  if (!editor) throw new Error('三维场景尚未就绪')

  return runHomeAi({
    editor,
    userMessage,
    history,
    config: saveAiConfig(baseURL, apiKey, model),
    onText,
    onStatus,
    signal,
  })
}
