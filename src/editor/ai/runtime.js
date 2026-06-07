import { createAnthropic } from '@ai-sdk/anthropic'
import { streamText, stepCountIs } from 'ai'
import { z } from 'zod/v4'
import { MAX_STEPS, TOOL_STATUS, CURATED, ADVANCED_HINT, BASIC_PANELS, LIGHT_TYPES, MESH_TYPES, MATERIAL_TYPES, GEOMETRY_TYPES, TEXTURE_MAPS, COLOR_PALETTES, SHADOW_GUIDE, EDIT_WORKFLOW, SPATIAL_EDIT_GUIDE, COLOR_EDIT_GUIDE, SHADER_EDIT_GUIDE } from './config.js'
import {
  allSceneTools, buildScene, enableSceneShadows, focusScene,
  getLiveContext, inspectScene, listEditorActions, listResources,
  mk, runEditorAction, validateEditInput, vec3, vec3req,
} from './core.js'

// ─── 系统提示词 ────────────────────────────────────────────────────────────────

export function buildSystemPrompt(live) {
  const scene = []
  if (live?.ready) {
    scene.push(`对象数：${live.count}，地面Y=${live.groundY}`)
    if (!live.shadowsOn && live.count > 1) scene.push('⚠ 阴影未开启（enableShadows 一键开）')
    const c = live.colors || {}
    if (c.background) scene.push(`背景：${c.background}${c.fog ? `  雾：${c.fog}${c.fogRange ? ` (${c.fogRange})` : ''}` : ''}`)
    if (c.lights?.length) scene.push(`灯光：${c.lights.map(l => `${l.type} intensity=${l.intensity}${l.shadow ? ' ✓shadow' : ''}`).join('，')}`)
    if (c.meshColors?.length) scene.push(`场景主色：${c.meshColors.join(' ')}`)
    if (live.selected) scene.push(`选中：${live.selected.line}`)
    if (live.snapshot?.length) scene.push(`对象快照：\n${live.snapshot.map(s => '  ' + s).join('\n')}`)
    if (live.hints?.length) scene.push(`⚡ ${live.hints.join('；')}`)
  } else {
    scene.push('场景为空，可用 buildScene 快速搭建示例')
  }

  return `你是专为「数字孪生三维场景编辑器」定制的 AI 助手，直接操作 Three.js 编辑器视口。用户看视口结果，不看代码。

## 当前场景状态
${scene.join('\n')}

## 工作流程
1. **理解**：用户要什么视觉效果？（不是字面堆对象）
2. **感知**：不确定场景现状先 inspectScene；改物体前先 getObject 读 editHints/bounds/custom
3. **规划**：最少步骤达成目标，优先原生工具
4. **执行**：调工具落地，添加/大改后 focusCamera 确保用户看得见
5. **反馈**：告诉用户视口里发生了什么变化

## 视觉美学标准（让场景好看的关键）

**光照层次**（最影响质感）
- 标准三点光：主光(平行光 intensity 1-2) + 补光(半球光/环境光 0.3-0.6) + 背光可选
- 主光位置：斜上方 45°，如 [5,8,5] 或 [-5,8,3]，避免正上方（会压平立体感）
- 开阴影后质感立刻提升：enableShadows 一键搞定
- 场景偏暗：提高主光 intensity 或加环境光；偏平：检查是否只有环境光

**色彩搭配**（3色原则）
- 背景色 + 主体色 + 点缀色，三色控制在同一色温（暖/冷/中性）
- 深色背景配亮色主体（对比强）；浅色背景配饱和度低的主体（高级感）
- 雾色应接近背景色，near/far 控制景深感（near=场景半径×0.3，far=×1.5）
- 地面色比背景略深或略浅，避免与主体撞色

**材质质感**
- 金属感：metalness 0.8-1.0，roughness 0.1-0.3，配高光环境
- 磨砂/哑光：metalness 0，roughness 0.7-1.0
- 玻璃/透明：opacity 0.3-0.6，metalness 0.1，roughness 0
- 发光体：emissive 设为主色，emissiveIntensity 0.3-1.0
- 地面：roughness 0.8，receiveShadow=true，避免纯白（用 #888 或深色）

**空间比例**
- 主体尺寸决定相机距离（focusCamera 后距离约为主体最大边×3-5倍）
- 地面尺寸 = 主体最大边×8-15倍，避免地面太小露边
- 多物体时高低错落（y轴差异），避免全部贴地一字排开
- 装饰物体积 = 主体×0.2-0.5，不要喧宾夺主

## 操作规则
- **执行型请求必须调用工具**，禁止只给建议
- **改物体前必须 getObject**：读 editHints/custom/bounds 再动手
- **组件/shader**：只改 getObject.custom 里已有的 params/uniforms key
- **加模型**：先 listResources 查本地库，再 addModel
- **加组件**：先 listResources({ label }) 了解外观，再 addComponent
- **空间**：position 是轴心不是底面；贴地用 placeOnGround

## 回复格式
【理解】用户要什么效果（1句）
【做法】用什么手段（1-2句）
【结果】执行后视口里能看到什么`
}

export const SCENE_SYSTEM = buildSystemPrompt({ ready: false })

// ─── 工具集 ────────────────────────────────────────────────────────────────────

export function createSceneTools(editor, { userMessage = '' } = {}) {
  const all = allSceneTools(editor)

  // 带快照回滚的原子操作包装
  const atomic = (name, toolObj, desc) => mk(
    desc || toolObj?.description || name,
    toolObj?.inputSchema || z.any(),
    async (input) => {
      const snap = _snap(editor)
      try {
        const out = await toolObj.execute(input)
        if (out?.error) { _rollback(editor, snap); return { ...out, reverted: true } }
        return out
      } catch (e) {
        _rollback(editor, snap)
        return { error: `${name} 失败：${e?.message || String(e)}`, reverted: true }
      }
    },
  )

  return {
    // ── 感知工具 ──────────────────────────────────────────────────────────────
    inspectScene: mk(
      '查看场景全貌：对象列表、空间信息、地面高度、选中状态。不确定场景有什么时先调用',
      z.object({ id: z.number().optional().describe('聚焦某个对象的详情') }),
      (input) => inspectScene(editor, { ...input, includeObjects: true }),
    ),

    listResources: mk(
      '查可用资源。label=查单个组件详情（查后才能 addComponent）；query=模糊搜索；无参=全览（meshes/lights/components/models/skies）',
      z.object({
        label: z.string().optional().describe('精确组件名，如"网格地面"，查后解锁 addComponent'),
        query: z.string().optional().describe('模糊搜索，如"粒子"、"地面"、"图表"'),
      }),
      (input) => listResources(editor, input || {}),
    ),

    getObject: mk(
      '读取对象完整属性：bounds/editHints/custom(params/uniforms)/material/shadow。改任何对象前必须先调用',
      z.object({
        id: z.number(),
        children: z.boolean().optional().describe('是否包含子节点列表'),
      }),
      ({ id, children }) => all.getDetail.execute({ id, children }),
    ),

    // ── 修改工具 ──────────────────────────────────────────────────────────────
    editObject: mk(
      '精准修改对象属性。先 getObject 读 editHints；组件改 params/uniforms；mesh 改 color/material；改完自动 focusCamera',
      z.object({
        id: z.number(),
        name: z.string().optional(),
        visible: z.boolean().optional(),
        position: vec3,
        rotation: vec3,
        scale: vec3,
        color: z.string().optional().describe('#rrggbb，仅 mesh 有效'),
        opacity: z.number().min(0).max(1).optional(),
        intensity: z.number().optional().describe('灯光强度'),
        castShadow: z.boolean().optional(),
        receiveShadow: z.boolean().optional(),
        metalness: z.number().min(0).max(1).optional(),
        roughness: z.number().min(0).max(1).optional(),
        emissive: z.string().optional(),
        params: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).optional()
          .describe('组件 params，key 必须来自 getObject.custom.params'),
        uniforms: z.record(z.string(), z.union([z.number(), z.string(), z.boolean(), z.array(z.number())])).optional()
          .describe('shader uniforms，key 必须来自 getObject.custom.uniforms'),
      }),
      async (input) => {
        const snap = _snap(editor)
        try {
          const bad = validateEditInput(editor, input)
          if (bad) return bad
          const { id, params, uniforms, metalness, roughness, emissive, ...rest } = input
          let last
          if (params || uniforms) {
            last = await all.setObjectParams.execute({ id, params, uniforms })
            if (last?.error) { _rollback(editor, snap); return { ...last, reverted: true } }
          }
          const mat = { metalness, roughness, emissive, color: rest.color, opacity: rest.opacity }
          if (Object.values(mat).some(v => v != null)) {
            last = await all.setMaterial.execute({ id, ...mat })
            if (last?.error) { _rollback(editor, snap); return { ...last, reverted: true } }
            delete rest.color; delete rest.opacity
          }
          if (Object.keys(rest).some(k => k !== 'id' && rest[k] != null)) {
            last = await all.setProps.execute({ id, ...rest })
          }
          const out = last || { error: '没有可应用的修改' }
          if (out?.error) return out
          // 有视觉变化时自动对准
          const visual = params || uniforms || rest.position || rest.rotation || rest.scale
            || input.color != null || input.opacity != null || input.metalness != null
          if (visual) await all.focusObject.execute({ id: input.id }).catch(() => {})
          return out
        } catch (e) {
          _rollback(editor, snap)
          return { error: `editObject 失败：${e?.message || String(e)}`, reverted: true }
        }
      },
    ),

    // ── 创建工具 ──────────────────────────────────────────────────────────────
    addMesh: atomic('addMesh', all.addMesh,
      `添加基础几何体。类型：${Object.keys(MESH_TYPES).join('/')}。支持颜色/名称/贴地/运镜`),
    addComponent: atomic('addComponent', all.addComponent,
      '添加场景组件（特效/地面/图表/UI等）。必须先 listResources({ label }) 查阅后才能调用'),
    addModel: atomic('addModel', all.addModel,
      '加载本地 GLB/FBX 模型。先 listResources 查 models 列表，再用文件名调用。默认贴地+飞到模型'),
    addLight: atomic('addLight', all.addLight,
      `添加灯光。类型：${LIGHT_TYPES.join('/')}。平行光/聚光灯自动开 castShadow`),
    cloneObject: atomic('cloneObject', all.cloneObject, '深拷贝对象（含子节点/几何/材质），可指定新位置'),
    deleteObject: atomic('deleteObject', all.deleteObject, '删除对象并释放 GPU 资源'),
    placeOnGround: atomic('placeOnGround', all.placeOnGround, '将对象底面精确对齐到地面高度'),

    // ── Three.js 原生工具 ─────────────────────────────────────────────────────
    createMesh: atomic('createMesh', all.createMesh,
      `Three.js 原生建模：用几何类名创建 Mesh。几何类型：${GEOMETRY_TYPES.slice(0, 8).join('/')}...`),
    setMaterial: atomic('setMaterial', all.setMaterial,
      `切换材质类型或修改 PBR 参数。材质类型：${MATERIAL_TYPES.join('/')}`),
    setSceneProps: atomic('setSceneProps', all.setSceneProps,
      '修改场景背景色(background)或雾效(fog)'),
    addNativeLight: atomic('addNativeLight', all.addNativeLight,
      'Three.js 原生灯光，用 API 类名创建'),
    setLightProps: atomic('setLightProps', all.setLightProps,
      '精细调整灯光：target/castShadow/distance/angle/penumbra/shadowMapSize'),
    applyTexture: atomic('applyTexture', all.applyTexture,
      `加载远程纹理赋给材质通道。通道：${TEXTURE_MAPS.join('/')}`),
    lookAt: atomic('lookAt', all.lookAt, '让对象朝向目标点或目标对象'),

    // ── 场景环境 ──────────────────────────────────────────────────────────────
    setEnvironment: mk(
      `设置天空盒/环境贴图/背景色/雾效。天空选项：${['蓝天', '晴天', '森林', '清除'].join('/')}。用户明确要求时才调用`,
      z.object({
        sky: z.string().optional().describe('天空盒名称'),
        env: z.string().optional().describe('环境反射贴图名称'),
        background: z.string().nullable().optional().describe('#rrggbb 或 null 清除'),
        fog: z.object({
          color: z.string().optional(),
          near: z.number().optional(),
          far: z.number().optional(),
        }).nullable().optional(),
      }),
      async ({ sky, env, background, fog }) => {
        const out = {}
        if (sky) Object.assign(out, await all.setSky.execute({ name: sky }))
        if (env) Object.assign(out, await all.setEnv.execute({ name: env }))
        if (background !== undefined || fog !== undefined)
          Object.assign(out, await all.setSceneProps.execute({ background, fog }))
        return Object.keys(out).length ? out : { error: '请指定 sky/env/background/fog 之一' }
      },
    ),

    enableShadows: mk(
      '一键开启阴影四要素：renderer.shadowMap + 主光源castShadow + mesh castShadow + 地面receiveShadow',
      z.object({
        castIds: z.array(z.number()).optional().describe('指定投射阴影的对象 id，不传则自动处理所有 mesh'),
        receiveIds: z.array(z.number()).optional().describe('指定接收阴影的地面 id'),
      }),
      (input) => enableSceneShadows(editor, input || {}),
    ),

    // ── 相机控制 ──────────────────────────────────────────────────────────────
    focusCamera: mk(
      '对准相机视角。objectId=飞到某个对象；不传则框选整个场景',
      z.object({
        objectId: z.number().optional(),
        position: vec3req.optional().describe('直接指定相机位置'),
        target: vec3req.optional().describe('直接指定相机目标点'),
      }),
      async ({ objectId, position, target }) => {
        if (objectId != null) return all.focusObject.execute({ id: objectId })
        if (position && target) return all.focusView.execute({ position, target })
        return focusScene(editor)
      },
    ),

    // ── 动画/历史 ─────────────────────────────────────────────────────────────
    playAnimation: atomic('playAnimation', all.playAnimation,
      '播放 GLB/FBX 模型自带动画。先 listResources 或 getObject 查看动画列表'),

    history: mk(
      '撤销(undo)或重做(redo)操作',
      z.object({ action: z.enum(['undo', 'redo']) }),
      ({ action }) => action === 'undo' ? all.undoEditor.execute({}) : all.redoEditor.execute({}),
    ),

    // ── 面板/配置 ─────────────────────────────────────────────────────────────
    openPanel: mk(
      `打开编辑器配置面板。选项：${BASIC_PANELS.join('/')}`,
      z.object({ panel: z.enum(BASIC_PANELS).optional() }),
      ({ panel }) => all.openEditorPanel.execute(panel ? { panel, openMain: true } : {}),
    ),

    // ── 场景搭建 ──────────────────────────────────────────────────────────────
    buildScene: mk(
      `快速搭建完整示例场景（地面+灯光+主体+装饰+阴影+运镜）。色调：${COLOR_PALETTES.map(p => p.name).join('/')}。仅用户要示例/好看场景时用`,
      z.object({
        palette: z.string().optional().describe('色调名称，不传则随机'),
      }),
      ({ palette }) => {
        const snap = _snap(editor)
        return buildScene(editor, { palette }).catch(e => {
          _rollback(editor, snap)
          return { error: e?.message || String(e) }
        })
      },
    ),

    // ── 高级操作 ──────────────────────────────────────────────────────────────
    runAdvanced: mk(
      '调用高级工具：createInstancedMesh/createLatheMesh/addTubeMesh/exportSceneGlb/captureScreenshot/setEditorSettings/runEditorAction 等',
      z.object({
        tool: z.string().describe('工具名，来自 listResources.advancedTools 或 listEditorActions'),
        input: z.record(z.string(), z.unknown()).optional(),
      }),
      async ({ tool: name, input = {} }) => {
        if (CURATED.has(name)) return { error: `请直接用「${name}」工具，不要走 runAdvanced` }
        if (name === 'openEditorPanel') return { error: '请直接用「openPanel」工具' }
        if (name === 'undoEditor' || name === 'redoEditor') return { error: '请直接用「history」工具' }
        if (name === 'runEditorAction')
          return runEditorAction(editor, { action: input.action, params: input.params || {} })
        if (name === 'listEditorActions') return listEditorActions(editor)
        const t = allSceneTools(editor)[name]
        if (!t?.execute) return { error: `未知工具「${name}」`, hint: ADVANCED_HINT }
        return t.execute(input)
      },
    ),
  }
}

// ─── Agent 主入口 ──────────────────────────────────────────────────────────────

export async function runSceneAi({ editor, userMessage, history, config, onText, onStatus, signal }) {
  if (!editor) throw new Error('编辑器尚未就绪，请等待场景加载完成')

  const live = getLiveContext(editor)
  const system = buildSystemPrompt(live)
  const tools = createSceneTools(editor, { userMessage })
  const messages = _normalizeHistory(history)

  onStatus?.('思考中...')

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
        draft = _merge(draft, chunk)
        onText?.(draft)
      }
    }

    if (signal?.aborted) return draft || '已停止。'

    let final = (await result.text)?.trim() || draft || (steps.length ? '已执行操作。' : '好了。')
    if (steps.length && !/已执行/.test(final)) {
      final = `${final}\n\n（已执行：${steps.join(' → ')}）`
    }
    onText?.(final)
    return final
  } catch (e) {
    if (signal?.aborted || e?.name === 'AbortError') return draft || '已停止。'
    throw e
  }
}

// ─── 内部工具函数 ──────────────────────────────────────────────────────────────

function _snap(editor) {
  try { return editor.saveSceneEdit?.() ?? null } catch { return null }
}

function _rollback(editor, snap) {
  if (!snap) return
  try { editor.resetEditorStorage?.(snap) } catch { /* ignore */ }
}

function _normalizeHistory(history = []) {
  return history
    .filter(m => m.content?.trim() && !m.loading)
    .map(m => ({
      role: m.placement === 'end' ? 'user' : 'assistant',
      content: String(m.content).trim().slice(0, 600),
    }))
    .slice(-8)
}

function _merge(current, chunk) {
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
