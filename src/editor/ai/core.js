import { tool } from 'ai'
import { z } from 'zod/v4'
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
import { ThreeEditor, CORES_LIST, getObjectViews, createGsapAnimation, restoreHistoryHandler, getObjectBox3, getMaterials, createSpriteText, setGsapMeshAction } from '../lib'
import {
  CFG_KEY, LAYOUT_KEY, CHATS_KEY, DEFAULT_AI_CONFIG, MAX_HISTORY, MAX_STEPS, TOOL_STATUS,
  CURATED, ADVANCED_HINT, animJsonPath, scenePath, PROTECTED, SKIP, MAX_POS, MIN_SCALE, MAX_SCALE,
  MAX_INTENSITY, MAX_COUNT, MAX_INSTANCES, MAX_CURVE_POINTS, MAX_DRAW_POINTS, LIST_CAP, EXTRA_KEYS,
  PARAM_LIMITS, OTHER_PANELS, LIGHT_ZH, HANDLER_MODES, TC_MODES, TRANSFORM_MODES, TC_SPACES,
  EDITOR_SETTING_KEYS, EFFECT_PASS_KEYS, RENDER_WAYS, OUTPUT_COLOR_SPACES, RENDER_LIST_NAMES,
  BASIC_PANELS, OBJECT_PANELS, LIGHT_TYPES, NATIVE_LIGHT_TYPES, NATIVE_TOOL_NAMES, MESH_TYPES,
  MESH_USAGE, SKIES, MATERIAL_TYPES, GEOMETRY_TYPES, TEXTURE_MAPS, SIDE_MAP, COLOR_PALETTES,
  ELEMENT_CATEGORIES, OBJECT_TYPES_GUIDE, COMPONENT_HINTS, MESH_INSTEAD,
  SHADOW_GUIDE, SCENE_COMPOSE_GUIDE,
  SPATIAL_EDIT_GUIDE, COLOR_EDIT_GUIDE, SHADER_EDIT_GUIDE, EDIT_WORKFLOW,
  r, v3, _v, _e, _box,
} from './config.js'


function resolveClass(name, fallback) {
  const Cls = THREE[name]
  return typeof Cls === 'function' ? Cls : fallback
}

function attachObject(editor, obj) {
  const scene = editor?.scene
  if (!scene || !obj) return
  if (obj.parent === scene) {
    editor.transformControls?.attach?.(obj)
    return
  }
  if (scene.attach_add) scene.attach_add(obj)
  else {
    scene.add(obj)
    editor.transformControls?.attach?.(obj)
  }
}

function getTransformInfo(mesh) {
  return {
    position: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z },
    rotation: { x: mesh.rotation.x, y: mesh.rotation.y, z: mesh.rotation.z },
    scale: { x: mesh.scale.x, y: mesh.scale.y, z: mesh.scale.z },
  }
}

function createCoreLight(type, { color = 0xffffff, intensity = 1 } = {}) {
  switch (type) {
    case 'AmbientLight': return new THREE.AmbientLight(color, intensity)
    case 'DirectionalLight': return new THREE.DirectionalLight(color, intensity)
    case 'PointLight': return new THREE.PointLight(color, intensity, 0, 0)
    case 'SpotLight': return new THREE.SpotLight(color, intensity, 0, Math.PI / 3, 0, 0)
    case 'HemisphereLight': return new THREE.HemisphereLight(color, 0x000000, intensity)
    case 'RectAreaLight': return new THREE.RectAreaLight(color, intensity, 100, 100)
    default: return null
  }
}

function resolveLightType(editor, type) {
  const lc = editor.lightCores
  if (!type && lc?.type) return lc.type
  if (lc?.list?.[type]) return lc.list[type]
  if (LIGHT_ZH[type]) return LIGHT_ZH[type]
  return type
}

function editorArgs(editor) {
  return {
    scene: editor.scene,
    camera: editor.camera,
    renderer: editor.renderer,
    controls: editor.controls,
    transformControls: editor.transformControls,
    effectComposer: editor.effectComposer,
    css3DRender: editor.css3DRender,
    css2DRender: editor.css2DRender,
    DOM: editor.DOM,
  }
}

function editorCores(editor) {
  const c = {}
  for (const k of ['shaderCores', 'handler', 'other', 'modelCores', 'innerCores', 'drawCores', 'textCores', 'particleCores', 'designCores', 'lightCores', 'geoCores']) {
    if (editor[k]) c[k] = editor[k]
  }
  return c
}

function loadSceneList() {
  try {
    return JSON.parse(localStorage.getItem('new_sceneList') || '[]')
  } catch {
    return []
  }
}

function saveSceneList(list) {
  localStorage.setItem('new_sceneList', JSON.stringify(list))
}

export const EDITOR_ACTIONS = {
  openCorePanel: {
    desc: '打开控制板「核心」子面板 GUI（文字物体/绘制物体/粒子物体/模型等）',
    params: { panel: 'CORES_LIST.label 或 name，如 textCores / 文字物体' },
  },
  openOtherPanel: {
    desc: '打开控制板「其他」子面板：编辑动画/视角动画/变换动画/裁剪场景',
    params: { panel: '编辑动画|视角动画|变换动画|裁剪场景' },
  },
  addText3D: {
    desc: '添加 3D 文字（等同核心→文字物体→添加）',
    params: { text: 'string', fontLink: 'optional url', materialType: 'optional', position: '[x,y,z]' },
  },
  addParticleSystem: {
    desc: '添加粒子系统（等同核心→粒子物体）',
    params: { particlesSum: 'number', inner: 'number', outer: 'number', mapUrl: 'optional url', size: 'optional' },
  },
  addDrawLine: {
    desc: '用绘制核心「直线」模式从点列创建 Line2',
    params: { points: '[[x,y,z],...]', lineWidth: 'optional' },
  },
  deselectAll: { desc: '取消选中并清除轮廓高亮', params: {} },
  setOutlineSelection: { desc: '设置 outlinePass 高亮对象', params: { ids: 'number[]' } },
  nudgeTransform: { desc: '微调位移(Q/W/E/A/S/D 等价)', params: { id: 'number', dx: 'number', dy: 'number', dz: 'number' } },
  rotateObject90: { desc: '绕轴旋转 90°(Shift+X/Y/Z 等价)', params: { id: 'number', axis: 'x|y|z', sign: '1|-1 optional' } },
  addCss2dLabel: { desc: '在场景中添加 CSS2D 标签', params: { html: 'string', position: '[x,y,z]' } },
  addCss3dElement: { desc: '在场景中添加 CSS3D DOM', params: { html: 'string', position: '[x,y,z]' } },
  saveViewAngle: { desc: '记录当前相机视角到 viewAngleList', params: { name: 'string' } },
  flyToViewAngle: { desc: '飞到已记录视角', params: { index: 'number' } },
  listViewAngles: { desc: '列出已记录视角', params: {} },
  listClippingPlanes: { desc: '列出 renderer 裁剪面', params: {} },
  addClippingPlane: { desc: '添加裁剪面', params: { normal: '[x,y,z]', constant: 'number' } },
  clearClippingPlanes: { desc: '清除所有裁剪面', params: {} },
  getSceneStats: { desc: '物体/顶点/三角面统计', params: {} },
  switchScene: { desc: '切换 localStorage 场景槽并 resetEditorStorage', params: { name: 'string' } },
  createSceneSlot: { desc: '新建场景槽', params: { name: 'string' } },
  deleteSceneSlot: { desc: '删除场景槽', params: { name: 'string' } },
  setPixelRatio: { desc: '设置像素比并刷新页面', params: { ratio: '0.5-3' } },
  setLogDepthBuffer: { desc: '对数深度缓冲并刷新', params: { enabled: 'boolean' } },
  getShareLink: { desc: '获取分享链接', params: { sceneName: 'optional' } },
  loadOnlineModel: { desc: 'modelCores.loadModel + attach_add（等同核心→模型管理）', params: { url: 'string', position: '[x,y,z] optional', flyTo: 'boolean optional' } },
  addInnerMesh: { desc: '内置物体（等同 innerCores→添加，默认 scale×10）', params: { geometryType: 'BoxGeometry 等', materialType: 'optional', position: '[x,y,z]', scale: 'number optional' } },
  addCoreLight: { desc: '添加光源并 attach_add（等同 lightCores）', params: { type: 'AmbientLight|平行光|...', position: '[x,y,z]', color: 'hex optional', intensity: 'number optional' } },
  applyBlendShader: { desc: '混合着色器（等同对象→着色配置）', params: { id: 'number', shaderName: '如 水波纹', uvType: 'material|world optional' } },
  listBlendShaders: { desc: '列出可用混合着色器名', params: {} },
  setSceneSkybox: { desc: '六面 skybox（baseUrl/1.png..6.png）或 clear', params: { baseUrl: 'string optional', clear: 'boolean optional' } },
  setSceneEnvironment: { desc: '环境贴图 IBL', params: { baseUrl: 'string', enabled: 'boolean optional' } },
  animateMeshTransform: { desc: 'GSAP 变换动画（等同其他→变换动画）', params: { id: 'number', position: '[x,y,z]', rotation: '[x,y,z]', scale: '[x,y,z]', duration: 'optional', mode: 'to|from optional' } },
  addSpriteLabel: { desc: 'Sprite 文字标签（createSpriteText）', params: { text: 'string', position: '[x,y,z]', color: 'optional', fontSize: 'optional' } },
  playCoreModelAnimation: { desc: 'modelCores.modelAnimationPlay', params: { id: 'number', initPlay: 'boolean', speed: 'number', loop: 'boolean' } },
  setHandlerOptions: { desc: 'handler.mode / transformControls.mode', params: { mode: 'transform|select|none', transformMode: 'translate|rotate|scale', openKeyEnable: 'boolean optional' } },
  setPreview: { desc: '预览模式(handler.mode=none)，不控制侧栏折叠', params: { enabled: 'boolean' } },
  applyTheatreAnimation: { desc: '应用 Theatre 时间线 JSON（会 reload）', params: { urlOrName: 'string' } },
  clearTheatreAnimation: { desc: '清除 Theatre 动画（会 reload）', params: {} },
  controlTheatreSheet: { desc: '控制 Theatre sheet 播放', params: { index: 'number', action: 'play|pause|reset' } },
  clearEditorCache: { desc: '清理 localStorage/IndexDB 并刷新（危险，需 confirm:true）', params: { confirm: 'boolean 必须为 true' } },
}

const ACTION_REQUIREMENTS = {
  openCorePanel: { allPaths: ['GUI'], allFns: ['GUI.addDragFolder'] },
  openOtherPanel: {
    allPaths: ['GUI', 'panelApi.otherPanelApi'],
    anyFns: [[
      'panelApi.otherPanelApi.setAnimateEditorPanel',
      'panelApi.otherPanelApi.setControlsAnimationPanel',
      'panelApi.otherPanelApi.setMeshAnimationPanel',
      'panelApi.otherPanelApi.setClippingPanel',
    ]],
  },
  addText3D: { allPaths: ['scene', 'textCores'] },
  addParticleSystem: { allPaths: ['scene', 'particleCores'] },
  addDrawLine: { allPaths: ['scene', 'renderer'] },
  deselectAll: { allPaths: ['transformControls'] },
  setOutlineSelection: { allPaths: ['scene', 'transformControls'], allFns: ['setOutlinePass'] },
  nudgeTransform: { allPaths: ['scene', 'transformControls'] },
  rotateObject90: { allPaths: ['scene', 'transformControls'] },
  addCss2dLabel: { allFns: ['setCss2dDOM'] },
  addCss3dElement: { allFns: ['setCss3dDOM'] },
  saveViewAngle: { allPaths: ['other.viewAngleList', 'camera', 'controls'] },
  flyToViewAngle: { allPaths: ['other.viewAngleList', 'camera', 'controls'] },
  listViewAngles: { allPaths: ['other.viewAngleList'] },
  listClippingPlanes: { allPaths: ['renderer'] },
  addClippingPlane: { allPaths: ['renderer'] },
  clearClippingPlanes: { allPaths: ['renderer'] },
  getSceneStats: { allPaths: ['scene'] },
  switchScene: { allFns: ['resetEditorStorage'] },
  createSceneSlot: {},
  deleteSceneSlot: {},
  setPixelRatio: {},
  setLogDepthBuffer: {},
  getShareLink: {},
  loadOnlineModel: { allPaths: ['scene'], allFns: ['modelCores.loadModel'] },
  addInnerMesh: { allPaths: ['scene'] },
  addCoreLight: { allPaths: ['scene'] },
  applyBlendShader: { allPaths: ['scene'], allFns: ['shaderCores.setObjectBlendShader'] },
  listBlendShaders: { allPaths: ['scene'] },
  setSceneSkybox: {
    allPaths: ['scene'],
    anyFns: [['scene.setSceneBackground', 'scene.resetEnv']],
  },
  setSceneEnvironment: { allPaths: ['scene'], allFns: ['scene.setEnvBackground'] },
  animateMeshTransform: { allPaths: ['scene'] },
  addSpriteLabel: { allPaths: ['scene'] },
  playCoreModelAnimation: { allFns: ['modelCores.modelAnimationPlay'] },
  setHandlerOptions: { allPaths: ['handler', 'transformControls'] },
  setPreview: { allPaths: ['handler'] },
  applyTheatreAnimation: {},
  clearTheatreAnimation: {},
  controlTheatreSheet: { allPaths: ['other.animateEditor'] },
  clearEditorCache: {},
}

function getPathValue(obj, path) {
  return String(path || '').split('.').reduce((acc, key) => acc?.[key], obj)
}

function hasPath(editor, path) {
  return getPathValue(editor, path) != null
}

function hasFn(editor, path) {
  return typeof getPathValue(editor, path) === 'function'
}

function detectActionSupport(editor, action) {
  if (!editor || !action) return { supported: true, missing: [] }
  const req = ACTION_REQUIREMENTS[action]
  if (!req) return { supported: true, missing: [] }

  const missing = []

  for (const p of (req.allPaths || [])) {
    if (!hasPath(editor, p)) missing.push(`path:${p}`)
  }

  for (const f of (req.allFns || [])) {
    if (!hasFn(editor, f)) missing.push(`fn:${f}`)
  }

  for (const group of (req.anyFns || [])) {
    const ok = group.some((f) => hasFn(editor, f))
    if (!ok) missing.push(`fn:any(${group.join('|')})`)
  }

  return { supported: missing.length === 0, missing }
}

export function listEditorActions(editor) {
  const cores = CORES_LIST.map(c => ({ name: c.name, label: c.label }))
  const allActionNames = Object.keys(EDITOR_ACTIONS)
  const mappedActionNames = allActionNames.filter(name => ACTION_REQUIREMENTS[name])
  const unmappedActionNames = allActionNames.filter(name => !ACTION_REQUIREMENTS[name])
  const actions = Object.entries(EDITOR_ACTIONS).map(([name, meta]) => {
    const support = detectActionSupport(editor, name)
    return {
      name,
      desc: meta.desc,
      params: meta.params,
      supported: support.supported,
      ...(support.supported ? {} : { missing: support.missing }),
    }
  })
  const available = actions.filter(a => a.supported).length
  return {
    total: Object.keys(EDITOR_ACTIONS).length,
    available,
    requirementCoverage: {
      covered: mappedActionNames.length,
      total: allActionNames.length,
      unmapped: unmappedActionNames,
    },
    actions,
    cores,
    otherPanels: OTHER_PANELS,
    hint: 'supported=false 代表当前编辑器缺少能力。优先用专用工具，其余走 runEditorAction。',
  }
}

function openCorePanel(editor, { panel }) {
  if (!editor.GUI) return { error: 'GUI 未就绪' }
  if (editor.GUI.children.length <= 1) editor.openControlPanel?.()
  const core = CORES_LIST.find(c => c.name === panel || c.label === panel)
  if (!core?.createPanel) return { error: `未知 core「${panel}」`, cores: CORES_LIST.map(c => c.label) }
  try {
    core.createPanel(editor.GUI.addDragFolder(core.label), editorArgs(editor), editorCores(editor))
    return { opened: core.label, core: core.name }
  } catch (e) {
    return { error: `打开 core 面板失败: ${e?.message || String(e)}` }
  }
}

function openOtherPanel(editor, { panel }) {
  if (!editor.GUI) return { error: 'GUI 未就绪' }
  if (editor.GUI.children.length <= 1) editor.openControlPanel?.()
  const api = editor.panelApi?.otherPanelApi
  if (!api) return { error: 'otherPanelApi 不可用' }
  const map = {
    '编辑动画': api.setAnimateEditorPanel,
    '视角动画': api.setControlsAnimationPanel,
    '变换动画': api.setMeshAnimationPanel,
    '裁剪场景': api.setClippingPanel,
  }
  const fn = map[panel]
  if (!fn) return { error: `未知 panel「${panel}」`, panels: OTHER_PANELS }
  try {
    fn(editorArgs(editor), editorCores(editor), editor.GUI.addDragFolder(panel))
    return { opened: panel }
  } catch (e) {
    return { error: `打开面板失败: ${e?.message || String(e)}` }
  }
}

async function addText3D(editor, { text, fontLink, materialType, position }) {
  const tc = editor.textCores
  if (!tc) return { error: 'textCores 不可用' }
  const t = String(text || tc.text || 'Text').slice(0, 128)
  const fontUrl = fontLink || tc.fontLink
  if (!fontUrl) return { error: '缺少 fontLink' }
  const matType = materialType || tc.materialType || 'MeshBasicMaterial'
  const MatCls = resolveClass(matType, THREE.MeshBasicMaterial)
  let font
  try {
    font = await new FontLoader().loadAsync(fontUrl)
  } catch (e) {
    return { error: `字体加载失败: ${e?.message || fontUrl}` }
  }
  const geo = new TextGeometry(t, { font, size: 0.5, height: 0.08, curveSegments: 8 })
  geo.computeBoundingBox()
  geo.center()
  const mesh = new THREE.Mesh(geo, new MatCls())
  mesh.fontLink = fontUrl
  mesh.text = t
  mesh.editorType = 'isTextMesh'
  mesh.name = t.slice(0, 16)
  const pos = safeVec3(position)
  if (pos) mesh.position.set(...pos)
  attachObject(editor, mesh)
  return { object: { id: mesh.id, name: mesh.name, type: 'TextMesh', text: t } }
}

function addParticleSystem(editor, params = {}) {
  const pc = editor.particleCores
  if (!pc) return { error: 'particleCores 不可用' }
  const cfg = {
    particlesSum: params.particlesSum ?? pc.particlesSum ?? 5000,
    inner: params.inner ?? pc.inner ?? 0,
    outer: params.outer ?? pc.outer ?? 2000,
    mapUrl: params.mapUrl ?? pc.mapUrl,
  }
  const inner = Math.max(0, fin(cfg.inner, 0))
  const outer = Math.max(inner + 0.001, fin(cfg.outer, inner + 2000))
  const count = clampN(cfg.particlesSum, 100, 20000)
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const rad = inner + Math.random() * (outer - inner)
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    positions[i * 3] = rad * Math.sin(phi) * Math.cos(theta)
    positions[i * 3 + 1] = rad * Math.sin(phi) * Math.sin(theta)
    positions[i * 3 + 2] = rad * Math.cos(phi)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const mat = new THREE.PointsMaterial({ size: params.size ?? 0.15, transparent: true, opacity: 0.85 })
  if (cfg.mapUrl) {
    new THREE.TextureLoader().load(cfg.mapUrl, tex => { mat.map = tex; mat.needsUpdate = true })
  }
  const pts = new THREE.Points(geo, mat)
  pts.editorType = 'isParticleMesh'
  pts.name = '粒子'
  pts.parameters = { ...pc, ...params }
  attachObject(editor, pts)
  return {
    object: { id: pts.id, type: 'Points', editorType: pts.editorType },
    hint: '基础粒子；完整着色器请 openCorePanel({ panel: "粒子物体" })',
  }
}

function addDrawLine(editor, { points, lineWidth, color }) {
  if (!Array.isArray(points) || points.length < 2) return { error: 'points 至少 2 个点' }
  if (points.length > MAX_DRAW_POINTS) return { error: `points 最多 ${MAX_DRAW_POINTS} 个` }
  const flat = []
  for (const p of points) {
    const v = safeVec3(p)
    if (!v) return { error: 'points 格式无效' }
    flat.push(v[0], v[1] + 0.001, v[2])
  }
  const geo = new LineGeometry().setPositions(flat)
  const hex = color?.startsWith('#') ? color : '#ffffff'
  const mat = new LineMaterial({ color: hex, linewidth: lineWidth ?? 1, worldUnits: false })
  mat.resolution.set(editor.renderer?.domElement?.clientWidth || 1920, editor.renderer?.domElement?.clientHeight || 1080)
  const line = new Line2(geo, mat)
  line.computeLineDistances()
  line.editorType = 'isDrawMesh'
  line.drawParams = { mode: 'straight', points: points.map(p => new THREE.Vector3(...p)), lineWidth: lineWidth ?? 1 }
  line.name = 'DrawLine'
  attachObject(editor, line)
  return { object: { id: line.id, type: line.type, editorType: line.editorType, pointCount: points.length } }
}
function deselectAll(editor) {
  editor.transformControls?.detach?.()
  const op = editor.effectComposer?.effectPass?.outlinePass
  if (op) op.selectedObjects = []
  return { deselected: true }
}

function setOutlineSelection(editor, { ids }) {
  if (!Array.isArray(ids)) return { error: 'ids 需为数组' }
  const objs = ids.map(id => find(editor.scene, id)).filter(o => o && !isProtected(o))
  if (!objs.length) return { error: '未找到有效对象' }
  editor.setOutlinePass?.(objs)
  editor.transformControls?.attach?.(objs[0])
  return { count: objs.length, ids: objs.map(o => o.id) }
}

function nudgeTransform(editor, { id, dx = 0, dy = 0, dz = 0 }) {
  const { obj: o, error } = findEditable(editor.scene, id)
  if (error) return { error }
  o.position.x += clampN(dx, -MAX_POS, MAX_POS)
  o.position.y += clampN(dy, -MAX_POS, MAX_POS)
  o.position.z += clampN(dz, -MAX_POS, MAX_POS)
  editor.transformControls?.attach?.(o)
  return { id, position: [o.position.x, o.position.y, o.position.z] }
}

function rotateObject90(editor, { id, axis = 'y', sign = 1 }) {
  const { obj: o, error } = findEditable(editor.scene, id)
  if (error) return { error }
  const s = sign >= 0 ? 1 : -1
  const a = String(axis).toLowerCase()
  if (a === 'x') o.rotation.x += s * Math.PI / 2
  else if (a === 'z') o.rotation.z += s * Math.PI / 2
  else o.rotation.y += s * Math.PI / 2
  editor.transformControls?.attach?.(o)
  return { id, rotation: [o.rotation.x, o.rotation.y, o.rotation.z] }
}

function addCss2dLabel(editor, { html, position }) {
  if (!html) return { error: 'html 必填' }
  if (!Array.isArray(position) || position.length !== 3) return { error: 'position 无效' }
  const el = document.createElement('div')
  el.innerHTML = html
  el.style.cssText = 'color:#fff;font-size:14px;pointer-events:none;white-space:nowrap;'
  editor.setCss2dDOM?.(el, { x: position[0], y: position[1], z: position[2] })
  return { added: true, type: 'css2d' }
}

function addCss3dElement(editor, { html, position }) {
  if (!html) return { error: 'html 必填' }
  if (!Array.isArray(position) || position.length !== 3) return { error: 'position 无效' }
  const el = document.createElement('div')
  el.innerHTML = html
  editor.setCss3dDOM?.(el, { x: position[0], y: position[1], z: position[2] })
  return { added: true, type: 'css3d' }
}

function saveViewAngle(editor, { name }) {
  const list = editor.other?.viewAngleList
  if (!list || !editor.camera || !editor.controls?.target) return { error: 'viewAngleList 或相机未就绪' }
  const n = String(name || `视角${list.length + 1}`).slice(0, 64)
  list.push({
    name: n,
    position: editor.camera.position.clone(),
    target: editor.controls.target.clone(),
  })
  return { saved: n, index: list.length - 1, total: list.length }
}

async function flyToViewAngle(editor, { index }) {
  const list = editor.other?.viewAngleList
  const item = list?.[index]
  if (!item || !editor.camera || !editor.controls) return { error: `无 index=${index} 的视角`, total: list?.length ?? 0 }
  await Promise.all([
    createGsapAnimation(editor.camera.position, item.position, { duration: 0.5 }),
    createGsapAnimation(editor.controls.target, item.target, { duration: 0.5 }),
  ])
  return { flewTo: item.name, index }
}

function listViewAngles(editor) {
  const list = editor.other?.viewAngleList || []
  return { angles: list.map((a, i) => ({ index: i, name: a.name })) }
}

function listClippingPlanes(editor) {
  const planes = editor.renderer?.clippingPlanes || []
  return {
    enabled: !!editor.renderer?.localClippingEnabled,
    count: planes.length,
    planes: planes.map((p, i) => ({ index: i, normal: [p.normal.x, p.normal.y, p.normal.z], constant: p.constant })),
  }
}

function addClippingPlane(editor, { normal, constant = 0 }) {
  if (!Array.isArray(normal) || normal.length !== 3) return { error: 'normal 需 [x,y,z]' }
  const r = editor.renderer
  if (!r) return { error: 'renderer 不可用' }
  if (!r.clippingPlanes) r.clippingPlanes = []
  r.clippingPlanes.push(new THREE.Plane(new THREE.Vector3(...normal).normalize(), constant))
  r.localClippingEnabled = true
  return listClippingPlanes(editor)
}

function clearClippingPlanes(editor) {
  const r = editor.renderer
  if (r?.clippingPlanes) r.clippingPlanes.length = 0
  return { cleared: true }
}

function getSceneStats(editor) {
  let vertices = 0, triangles = 0, objects = 0
  editor.scene.traverse(obj => {
    if (obj.isTransformControls || obj.isHelper || obj.type?.includes('Helper')) return
    const geo = obj.geometry
    if (!geo) return
    objects++
    const pos = geo.attributes?.position
    if (pos) vertices += pos.count
    if (geo.index) triangles += geo.index.count / 3
    else if (pos) triangles += pos.count / 3
  })
  return { objects, vertices: Math.floor(vertices), triangles: Math.floor(triangles) }
}

function switchScene(editor, { name }) {
  if (!name) return { error: '缺少 name' }
  const list = loadSceneList()
  if (!list.some(o => o.name === name)) return { error: `场景「${name}」不存在`, scenes: list.map(o => o.name) }
  localStorage.setItem('new_sceneName', name)
  const raw = localStorage.getItem(`${name}-newEditor`)
  let data = null
  if (raw) {
    try { data = JSON.parse(raw) } catch { return { error: `场景「${name}」数据损坏` } }
  }
  editor.resetEditorStorage?.(data)
  return { switched: name }
}

function createSceneSlot(_editor, { name }) {
  if (!name) return { error: '缺少 name' }
  const list = loadSceneList()
  if (list.some(o => o.name === name)) return { error: '场景名已存在' }
  list.push({ name })
  saveSceneList(list)
  localStorage.setItem('new_sceneName', name)
  return { created: name }
}

function deleteSceneSlot(_editor, { name }) {
  if (!name) return { error: '缺少 name' }
  const list = loadSceneList()
  const idx = list.findIndex(o => o.name === name)
  if (idx === -1) return { error: `场景「${name}」不存在` }
  list.splice(idx, 1)
  saveSceneList(list)
  localStorage.removeItem(`${name}-newEditor`)
  const current = localStorage.getItem('new_sceneName')
  if (current === name) localStorage.setItem('new_sceneName', list[0]?.name || '三维测试')
  return { deleted: name }
}

function setPixelRatio(_editor, { ratio }) {
  if (ratio == null) return { error: '缺少 ratio' }
  const r = clampN(ratio, 0.5, 3)
  localStorage.setItem('new_threeEditor_pixelRatio', String(r))
  setTimeout(() => window.location.reload(), 500)
  return { ratio: r, reload: true }
}

function setLogDepthBuffer(_editor, { enabled }) {
  localStorage.setItem('new_threeEditor_logBuffer', String(!!enabled))
  setTimeout(() => window.location.reload(), 500)
  return { enabled: !!enabled, reload: true }
}

function getShareLink(_editor, { sceneName } = {}) {
  const name = sceneName || window.currentOnlineSceneName || localStorage.getItem('new_sceneName') || ''
  const base = `${window.location.origin}${window.location.pathname}`
  const q = name ? `?sceneName=${encodeURIComponent(name.replace(/\.json$/, ''))}` : ''
  return { url: `${base}${q}`, sceneName: name || null }
}

function loadOnlineModel(editor, { url, position, flyTo }) {
  if (!url) return { error: '缺少 url' }
  const mc = editor.modelCores
  if (!mc?.loadModel) return { error: 'modelCores 不可用' }
  return new Promise(resolve => {
    try {
      const loaded = mc.loadModel(url)
      if (!loaded?.loaderService) {
        resolve({ error: '无效模型 URL，支持 glb/gltf/fbx/obj' })
        return
      }
      const { loaderService } = loaded
      loaderService.complete = async (model) => {
        try {
          if (!model) { resolve({ error: '模型加载结果为空' }); return }
          const pos = safeVec3(position)
          if (pos) model.position.set(...pos)
          attachObject(editor, model)
          if (flyTo) await flyToObject(editor, model, 0.5)
          resolve({ object: { id: model.id, name: model.name || '(模型)' }, url, attached: true })
        } catch (e) {
          resolve({ error: `模型加载后处理失败: ${e?.message || String(e)}` })
        }
      }
      loaderService.error = (e) => resolve({ error: `模型加载失败: ${e?.message || url}` })
    } catch (e) {
      resolve({ error: e?.message || String(e) })
    }
  })
}

function addInnerMesh(editor, { geometryType, materialType, position, scale }) {
  const ic = editor.innerCores
  const geoType = geometryType || ic?.geometryType || 'BoxGeometry'
  const matType = materialType || ic?.materialType || 'MeshStandardMaterial'
  const GeoCls = resolveClass(geoType, null)
  const MatCls = resolveClass(matType, THREE.MeshStandardMaterial)
  if (!GeoCls) return { error: `未知 geometryType「${geoType}」` }
  const mesh = new THREE.Mesh(new GeoCls(), new MatCls({ side: THREE.DoubleSide }))
  mesh.name = geoType
  mesh.scale.multiplyScalar(clampN(scale ?? 10, MIN_SCALE, MAX_SCALE))
  mesh.editorType = 'isInnerMesh'
  const pos = safeVec3(position)
  if (pos) mesh.position.set(...pos)
  attachObject(editor, mesh)
  return { object: { id: mesh.id, name: mesh.name, geometryType: geoType, materialType: matType } }
}

function addCoreLight(editor, { type, position, color, intensity }) {
  const resolved = resolveLightType(editor, type || 'DirectionalLight')
  const hex = safeHex(color) ?? 0xffffff
  const light = createCoreLight(resolved, { color: hex, intensity: clampN(intensity ?? 1, 0, 100) })
  if (!light) return { error: `未知灯光「${type}」`, types: Object.keys(LIGHT_ZH).concat(['AmbientLight', 'DirectionalLight', 'PointLight', 'SpotLight', 'HemisphereLight', 'RectAreaLight']) }
  if (light.target) editor.scene.add(light.target)
  light.editorType = 'isLight'
  light.name = type || resolved
  const pos = safeVec3(position) || [0, 5, 0]
  light.position.set(...pos)
  attachObject(editor, light)
  return { object: { id: light.id, name: light.name, type: light.type } }
}

function getBlendShaderCapability(editor) {
  const fromStatic = Array.isArray(ThreeEditor.__GLSLLIB__)
    ? ThreeEditor.__GLSLLIB__.map(i => i?.name).filter(Boolean)
    : []
  const lib = editor?.shaderCores?.shaderLibrary || editor?.scene?.shaderLibrary
  const fromRuntime = lib ? Object.keys(lib).filter(k => typeof lib[k] === 'object') : []
  const shaders = [...new Set([...fromStatic, ...fromRuntime])]
  const supported = typeof editor?.shaderCores?.setObjectBlendShader === 'function'
  return {
    supported,
    shaders,
    shaderCount: shaders.length,
    source: { static: fromStatic.length, runtime: fromRuntime.length },
    missing: supported ? [] : ['fn:shaderCores.setObjectBlendShader'],
  }
}

function listBlendShaders(editor) {
  const cap = getBlendShaderCapability(editor)
  return {
    supported: cap.supported,
    shaders: cap.shaders.length ? cap.shaders : ['水波纹'],
    shaderCount: cap.shaderCount,
    source: cap.source,
    ...(cap.supported ? {} : { missing: cap.missing }),
    hint: 'runEditorAction({ action: "applyBlendShader", params: { id, shaderName, uvType } })',
  }
}

function applyBlendShader(editor, { id, shaderName, uvType }) {
  const { obj, error } = findEditable(editor.scene, id)
  if (error) return { error }
  const fn = editor.shaderCores?.setObjectBlendShader
  if (!fn) return { error: 'shaderCores.setObjectBlendShader 不可用', hint: 'openCorePanel({ panel: "shaderCores" })' }
  const name = String(shaderName || '水波纹').slice(0, 64)
  const uv = uvType === 'world' ? 'world' : 'material'
  try {
    fn(obj, name, uv)
  } catch (e) {
    return { error: `着色器应用失败: ${e?.message || String(e)}` }
  }
  editor.transformControls?.attach?.(obj)
  return { id: obj.id, shader: name, uvType: uv }
}

function setSceneSkybox(editor, { baseUrl, clear }) {
  if (clear || baseUrl === '') {
    editor.scene.background = null
    editor.scene.resetEnv?.()
    return { cleared: true }
  }
  if (!baseUrl) return { error: '需要 baseUrl 或 clear:true' }
  const root = baseUrl.replace(/\/$/, '')
  editor.scene.setSceneBackground?.(Array.from({ length: 6 }, (_, i) => `${root}/${i + 1}.png`))
  return { skybox: root }
}

function setSceneEnvironment(editor, { baseUrl, enabled = true }) {
  if (!baseUrl) return { error: '缺少 baseUrl' }
  const root = baseUrl.replace(/\/$/, '')
  editor.scene.setEnvBackground?.(Array.from({ length: 6 }, (_, i) => `${root}/${i + 1}.png`))
  editor.scene.environmentEnabled = !!enabled
  return { environment: root, enabled: !!enabled }
}

async function animateMeshTransform(editor, { id, position, rotation, scale, duration = 2, mode = 'to' }) {
  const { obj, error } = findEditable(editor.scene, id)
  if (error) return { error }
  const from = getTransformInfo(obj)
  const p = safeVec3(position)
  const rot = rotation ? safeVec3(rotation) : null
  const sc = scale ? safeVec3(scale, MIN_SCALE, MAX_SCALE) : null
  const to = {
    position: p ? { x: p[0], y: p[1], z: p[2] } : from.position,
    rotation: rot ? { x: rot[0], y: rot[1], z: rot[2] } : from.rotation,
    scale: sc ? { x: sc[0], y: sc[1], z: sc[2] } : from.scale,
  }
  const m = mode === 'from' || mode === 'fromTo' ? mode : 'to'
  await setGsapMeshAction(obj, from, to, { mode: m, query: { duration: clampN(duration, 0.1, 30), ease: 'none', repeat: 0, yoyo: false } })
  editor.transformControls?.attach?.(obj)
  return { id, animated: true, position: [obj.position.x, obj.position.y, obj.position.z] }
}

function addSpriteLabel(editor, { text, position, color, fontSize }) {
  if (!text) return { error: 'text 必填' }
  const sprite = createSpriteText({ text: String(text).slice(0, 256), color, fontSize })
  if (Array.isArray(position) && position.length === 3) sprite.position.set(...position)
  attachObject(editor, sprite)
  return { object: { id: sprite.id, type: 'Sprite', text: String(text).slice(0, 64) } }
}

function playCoreModelAnimation(editor, params = {}) {
  const { id, ...animParams } = params
  const { obj, error } = findEditable(editor.scene, id)
  if (error) return { error }
  const fn = editor.modelCores?.modelAnimationPlay
  if (!fn) return { error: 'modelAnimationPlay 不可用' }
  try {
    fn(obj, animParams)
  } catch (e) {
    return { error: `动画播放失败: ${e?.message || String(e)}` }
  }
  return { playing: true, id, params: animParams }
}

function setHandlerOptions(editor, { mode, transformMode, openKeyEnable }) {
  const h = editor.handler
  if (!h) return { error: 'handler 不可用' }
  if (mode && !HANDLER_MODES.has(mode)) return { error: `mode 需 ${[...HANDLER_MODES].join('|')}` }
  if (transformMode && !TRANSFORM_MODES.has(transformMode)) return { error: `transformMode 需 ${[...TRANSFORM_MODES].join('|')}` }
  if (mode) h.mode = mode
  if (openKeyEnable != null) h.openKeyEnable = !!openKeyEnable
  const tc = editor.transformControls
  if (transformMode && tc) {
    if (typeof tc.setMode === 'function') tc.setMode(transformMode)
    else tc.mode = transformMode
  }
  return { handlerMode: h.mode, transformMode: tc?.mode, openKeyEnable: h.openKeyEnable }
}

function setPreview(editor, { enabled }) {
  if (!editor.handler) return { error: 'handler 未就绪' }
  editor.handler.mode = enabled ? 'none' : 'transform'
  return { preview: !!enabled, handlerMode: editor.handler.mode }
}

function resolveAnimUrl(urlOrName) {
  if (urlOrName?.startsWith('http')) return urlOrName
  const list = (window.animateJsons || []).map(animJsonPath)
  return list.find(u => u.includes(urlOrName)) || null
}

async function applyTheatreAnimation(_editor, { urlOrName }) {
  const url = resolveAnimUrl(urlOrName)
  if (!url) return { error: `未找到动画「${urlOrName}」` }
  let res
  try { res = await fetch(url) } catch (e) { return { error: `网络请求失败: ${e?.message || url}` } }
  if (!res.ok) return { error: `动画加载失败: HTTP ${res.status}` }
  let data
  try { data = await res.json() } catch { return { error: '动画 JSON 解析失败' } }
  if (!data || typeof data !== 'object') return { error: '动画 JSON 无效' }
  localStorage.removeItem('theatre-0.4.persistent')
  localStorage.setItem('THREE_EDITOR_ANIMATIONS', JSON.stringify(data))
  setTimeout(() => window.location.reload(), 800)
  return { applied: url.split('/').pop(), reload: true }
}

function clearTheatreAnimation() {
  localStorage.removeItem('theatre-0.4.persistent')
  localStorage.removeItem('THREE_EDITOR_ANIMATIONS')
  setTimeout(() => window.location.reload(), 800)
  return { cleared: true, reload: true }
}

function getTheatreSheets(editor) {
  const sheets = editor.other?.animateEditor?.studio?.studioProject?.sheets
  if (!sheets) return []
  return Object.keys(sheets).map(k => ({ name: sheets[k].name || k, sequence: sheets[k].sequence }))
}

function controlTheatreSheet(editor, { index = 0, action = 'play' }) {
  const list = getTheatreSheets(editor)
  const sheet = list[index]
  if (!sheet?.sequence) return { error: `无 index=${index} 的 sheet`, total: list.length }
  if (action === 'play') sheet.sequence.play({ iterationCount: Infinity })
  else if (action === 'pause') sheet.sequence.pause()
  else if (action === 'reset') { sheet.sequence.pause(); sheet.sequence.position = 0 }
  else return { error: 'action 需 play|pause|reset' }
  return { index, action, name: sheet.name }
}

function clearEditorCache(_editor, { confirm } = {}) {
  if (!confirm) return { error: '危险操作：需 params.confirm=true 才会执行' }
  localStorage.clear()
  sessionStorage.clear()
  window.indexedDB.deleteDatabase('new_threeEditor_db')
  setTimeout(() => window.location.reload(), 800)
  return { cleared: true, reload: true }
}

const HANDLERS = {
  openCorePanel,
  openOtherPanel,
  addText3D,
  addParticleSystem,
  addDrawLine,
  deselectAll,
  setOutlineSelection,
  nudgeTransform,
  rotateObject90,
  addCss2dLabel,
  addCss3dElement,
  saveViewAngle,
  flyToViewAngle,
  listViewAngles,
  listClippingPlanes,
  addClippingPlane,
  clearClippingPlanes,
  getSceneStats,
  switchScene,
  createSceneSlot,
  deleteSceneSlot,
  setPixelRatio,
  setLogDepthBuffer,
  getShareLink,
  loadOnlineModel,
  addInnerMesh,
  addCoreLight,
  listBlendShaders,
  applyBlendShader,
  setSceneSkybox,
  setSceneEnvironment,
  animateMeshTransform,
  addSpriteLabel,
  playCoreModelAnimation,
  setHandlerOptions,
  setPreview,
  applyTheatreAnimation,
  clearTheatreAnimation,
  controlTheatreSheet,
  clearEditorCache,
}

export async function runEditorAction(editor, { action, params = {} }) {
  if (!editor?.scene) return { error: '编辑器未就绪' }
  if (!action) return { error: '缺少 action', hint: 'listEditorActions 查可用 action' }
  if (!EDITOR_ACTIONS[action]) return { error: `未知 action「${action}」`, hint: '先 listEditorActions' }
  const support = detectActionSupport(editor, action)
  if (!support.supported) {
    return {
      error: `action「${action}」当前编辑器能力不足`,
      missing: support.missing,
      hint: '先 getEditorApi 查看能力，或 listEditorActions(editor) 查看 supported 项',
    }
  }
  const fn = HANDLERS[action]
  if (!fn) return { error: `action「${action}」尚未实现` }
  try {
    return await fn(editor, params ?? {})
  } catch (err) {
    return { error: `操作失败: ${err?.message || String(err)}` }
  }
}


// ═══ L2 场景实现（改 ThreeEditor.scene 的全部逻辑）══════════════════

// L2a · 安全 · 查找 · 读场景 · 贴地
function isProtected(o) {
  return !o || o.isTransformControlsRoot || o.isHelper || PROTECTED.has(o.type) || o.isCamera
}
function isEditable(o) { return o && !isProtected(o) }
function fin(n, fb = 0) { const x = Number(n); return Number.isFinite(x) ? x : fb }
function clampN(n, lo, hi) { return Math.min(Math.max(fin(n, lo), lo), hi) }

function safeVec3(arr, lo = -MAX_POS, hi = MAX_POS) {
  if (!Array.isArray(arr) || arr.length !== 3) return null
  const out = arr.map(v => clampN(v, lo, hi))
  return out.every(Number.isFinite) ? out : null
}

function safeScaleVec(arr) {
  const v = safeVec3(arr, MIN_SCALE, MAX_SCALE)
  return v?.every(x => x !== 0) ? v : null
}

function safeColor(hex) {
  if (typeof hex !== 'string') return null
  const h = hex.startsWith('#') ? hex.slice(1) : hex
  return /^[0-9a-fA-F]{6}$/.test(h) ? `#${h.toLowerCase()}` : null
}

function safeHexInt(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return clampN(Math.floor(v), 0, 0xffffff)
  if (typeof v === 'string') {
    const c = safeColor(v.startsWith('#') ? v : `#${v.replace(/^#/, '').padStart(6, '0')}`)
    return c ? parseInt(c.slice(1), 16) : null
  }
  return null
}

function vec3Input(v, lo = -MAX_POS, hi = MAX_POS) {
  if (Array.isArray(v) && v.length === 3) return safeVec3(v, lo, hi)
  if (v && typeof v === 'object' && v.x != null) return safeVec3([v.x, v.y, v.z], lo, hi)
  return null
}

function clampParam(key, val) {
  if (typeof val !== 'number') return val
  const lim = PARAM_LIMITS[key]
  return lim ? clampN(val, lim[0], lim[1]) : val
}

function findEditable(scene, id) {
  const obj = find(scene, id)
  if (!obj) return { error: `未找到 id=${id}` }
  if (!isEditable(obj)) return { error: `id=${id} 为受保护对象（相机/辅助线等），不可修改或删除` }
  return { obj }
}

function guardTool(def) {
  const tag = def.description?.slice(0, 24) || 'tool'
  const run = def.execute
  return tool({
    ...def,
    execute: async (input) => {
      try {
        return await run(input)
      } catch (err) {
        console.warn('[AI scene]', tag, err)
        return { error: `操作失败（场景保持原状）: ${err?.message || String(err)}` }
      }
    },
  })
}
const mk = (description, inputSchema, execute) => guardTool({ description, inputSchema, execute })

function safeCall(fn, label) {
  try { fn?.() } catch (err) { console.warn(`[AI scene] ${label}:`, err) }
}

function worldPos(o) {
  try {
    o.updateWorldMatrix(true, false)
    o.getWorldPosition(_v)
    return v3(_v)
  } catch { return [0, 0, 0] }
}

function worldRotDeg(o) {
  try {
    o.updateWorldMatrix(true, false)
    _e.setFromRotationMatrix(o.matrixWorld)
    return v3({ x: _e.x * 57.2958, y: _e.y * 57.2958, z: _e.z * 57.2958 })
  } catch { return [0, 0, 0] }
}

function worldScale(o) {
  try {
    o.updateWorldMatrix(true, false)
    o.getWorldScale(_v)
    return v3(_v)
  } catch { return [1, 1, 1] }
}

function getBounds(o) {
  try {
    _box.setFromObject(o)
    if (_box.isEmpty()) return null
    const c = _box.getCenter(new THREE.Vector3())
    const s = _box.getSize(new THREE.Vector3())
    return { min: v3(_box.min), max: v3(_box.max), center: v3(c), size: v3(s) }
  } catch { return null }
}

function geomInfo(o) {
  if (!o?.isMesh || !o.geometry) return null
  const g = o.geometry
  const p = g.parameters
  if (!p) return { type: g.type, vertices: g.attributes?.position?.count }
  const info = { type: g.type }
  for (const k of ['width', 'height', 'depth', 'radius', 'radiusTop', 'radiusBottom']) {
    if (p[k] != null) info[k] = r(p[k])
  }
  return info
}

function parseGridHelper(gh) {
  const pos = gh.geometry?.attributes?.position
  if (!pos) return null
  const xs = new Set(), zs = new Set()
  for (let i = 0; i < pos.count; i++) {
    xs.add(r(pos.getX(i)))
    zs.add(r(pos.getZ(i)))
  }
  const ax = [...xs].sort((a, b) => a - b)
  const az = [...zs].sort((a, b) => a - b)
  if (!ax.length || !az.length) return null
  const size = Math.max(ax.at(-1) - ax[0], az.at(-1) - az[0])
  const divisions = Math.max(ax.length, az.length) - 1
  if (!divisions) return null
  return { size: r(size), divisions, cellSize: r(size / divisions), plane: 'xz' }
}

function gridIntersections(gh, size, divisions, y = 0, max = 500) {
  if (!divisions || divisions > 200 || !Number.isFinite(size) || size <= 0) {
    return { cellSize: 0, half: 0, total: 0, points: [], truncated: false }
  }
  const step = size / divisions
  const half = size / 2
  const points = []
  for (let i = 0; i <= divisions && points.length < max; i++) {
    for (let j = 0; j <= divisions && points.length < max; j++) {
      _v.set(-half + i * step, y, -half + j * step)
      if (gh) { gh.updateWorldMatrix(true, false); _v.applyMatrix4(gh.matrixWorld) }
      points.push(v3(_v))
    }
  }
  const total = (divisions + 1) ** 2
  return { cellSize: r(step), half: r(half), total, points, truncated: total > max }
}

function find(scene, id) {
  if (!scene || id == null) return null
  return scene.getObjectById(id) ?? null
}

function isObj(o) {
  return o && !o.isHelper && !o.isTransformControlsRoot && !SKIP.has(o.type)
}

function isHorizWorld(o) {
  const rot = worldRotDeg(o)
  if (Math.abs(Math.abs(rot[0]) - 90) < 12) return true
  const b = getBounds(o)
  return !!(b && b.size[1] < 0.05 && b.size[0] > 0.3 && b.size[2] > 0.3)
}

function isFloorLike(o) {
  const tag = `${o.name || ''}${o.designType || ''}`
  if (/地面|floor|ground|gridFloor/i.test(tag)) return true
  return o.geometry?.type === 'PlaneGeometry' && isHorizWorld(o)
}

function detectGroundSurface(editor) {
  let ref = { y: 0, source: 'world origin', id: null }
  editor.scene.traverse(o => {
    if (!isObj(o)) return
    if (!isFloorLike(o) && !o.designType?.includes('Floor')) return
    const b = getBounds(o)
    if (!b || !isHorizWorld(o)) return
    if (b.max[1] >= ref.y - 0.001) {
      ref = { y: r(b.max[1]), source: o.name || o.designType || o.type, id: o.id }
    }
  })
  return ref
}

function brief(o) {
  const cls = classifySceneObject(o)
  const b = {
    id: o.id, name: o.name || '(未命名)', type: o.designType || o.type,
    role: cls.role, category: cls.category,
    editorType: o.editorType || null, designType: o.designType || null,
    componentLabel: cls.componentLabel || null,
    visible: o.visible, position: v3(o.position), worldPosition: worldPos(o),
  }
  const bounds = getBounds(o)
  if (bounds) {
    b.bounds = {
      center: bounds.center, size: bounds.size,
      bottomY: bounds.min[1], topY: bounds.max[1],
    }
  }
  return b
}

function buildEditHints(o) {
  const cls = classifySceneObject(o)
  const hints = []
  const b = getBounds(o)
  if (b) {
    hints.push(`空间: bottomY=${r(b.min[1])} topY=${r(b.max[1])} size=${b.size.map(r).join('×')}`)
    hints.push('贴地/对齐: placeOnGround(id) 或读 inspectScene.spatial')
  }
  if (cls.role === 'component') {
    const custom = readCustomProps(o)
    const pKeys = Object.keys(custom.params || {})
    const uKeys = Object.keys(custom.uniforms || {})
    hints.push('组件/shader: 改 params/uniforms，勿用 color/metalness')
    if (pKeys.length) hints.push(`params 可改: ${pKeys.slice(0, 6).join(', ')}`)
    if (uKeys.length) hints.push(`uniforms 可改: ${uKeys.slice(0, 6).join(', ')}`)
  } else if (cls.role === 'mesh') {
    hints.push('基础 mesh: color/metalness/roughness/emissive；位置 position/placeOnGround')
  } else if (cls.role === 'light') {
    hints.push('灯光: intensity/color/castShadow；位置影响阴影方向')
  } else if (cls.role === 'floor') {
    hints.push('地面: receiveShadow + scale 正方形；shader 地面改 params/uniforms')
  }
  return hints
}

function getSceneColorContext(editor) {
  const s = editor?.scene
  if (!s) return {}
  const out = {}
  if (s.background?.isColor) out.background = `#${s.background.getHexString()}`
  if (s.fog?.color) {
    out.fog = `#${s.fog.color.getHexString()}`
    if (s.fog.near != null) out.fogRange = `near:${r(s.fog.near)} far:${r(s.fog.far ?? 1000)}`
  }
  // 灯光摘要
  const lights = []
  s.traverse(o => {
    if (!o.isLight) return
    const info = { type: o.type, intensity: r(o.intensity ?? 1) }
    if (o.color) info.color = `#${o.color.getHexString()}`
    if (o.castShadow) info.shadow = true
    lights.push(info)
  })
  if (lights.length) out.lights = lights
  // 场景主色调提取（取前5个mesh的颜色）
  const meshColors = []
  s.traverse(o => {
    if (meshColors.length >= 5 || !o.isMesh || !o.material) return
    const m = Array.isArray(o.material) ? o.material[0] : o.material
    if (m?.color) meshColors.push(`#${m.color.getHexString()}`)
  })
  if (meshColors.length) out.meshColors = meshColors
  return out
}

function snapshotLine(o) {
  const cls = classifySceneObject(o)
  const b = getBounds(o)
  const matInfo = []
  o.traverse?.(c => {
    if (!c?.isMesh || !c.material) return
    const m = Array.isArray(c.material) ? c.material[0] : c.material
    if (!m) return
    if (m.color && matInfo.length === 0) matInfo.push(`color:${m.color.getHexString()}`)
    if (m.metalness != null && m.metalness > 0) matInfo.push(`metal:${r(m.metalness)}`)
    if (m.roughness != null) matInfo.push(`rough:${r(m.roughness)}`)
    if (m.emissive && m.emissiveIntensity > 0) matInfo.push(`emit:${m.emissive.getHexString()}`)
    if (m.opacity != null && m.opacity < 1) matInfo.push(`opacity:${r(m.opacity)}`)
    if (m.wireframe) matInfo.push('wireframe')
  })
  if (o.isLight) {
    matInfo.push(`intensity:${r(o.intensity ?? 1)}`)
    if (o.color) matInfo.push(`color:${o.color.getHexString()}`)
    if (o.castShadow) matInfo.push('shadow')
  }
  const parts = [`#${o.id} ${o.name || '?'}(${cls.role})`]
  if (b) parts.push(`sz${b.size.map(x => r(x)).join('×')} y${r(b.min[1])}~${r(b.max[1])}`)
  if (matInfo.length) parts.push(matInfo.slice(0, 4).join(' '))
  return parts.join(' | ')
}

/** editObject 前校验，拦截常见盲改 */
export function validateEditInput(editor, input) {
  const o = find(editor?.scene, input?.id)
  if (!o) return { error: `未找到 id=${input?.id}` }
  const role = classifySceneObject(o).role
  const hasParams = input.params || input.uniforms
  const hasMat = input.color != null || input.metalness != null || input.roughness != null || input.emissive != null || input.opacity != null

  if (role === 'component' || role === 'floor') {
    if (hasMat && !hasParams) {
      const custom = readCustomProps(o)
      const pColor = Object.keys(custom.params || {}).filter(k => /color/i.test(k))
      const uColor = Object.keys(custom.uniforms || {}).filter(k => /color/i.test(k))
      if (pColor.length || uColor.length || custom.uniforms || custom.params) {
        return {
          error: 'shader/组件不能用 editObject.color 或 metalness，请用 params/uniforms',
          hint: '先 getObject 读 custom，只改已有 key',
          suggest: {
            ...(pColor.length ? { params: Object.fromEntries(pColor.map(k => [k, custom.params[k]])) } : {}),
            ...(uColor.length ? { uniforms: Object.fromEntries(uColor.map(k => [k, custom.uniforms[k]])) } : {}),
          },
        }
      }
    }
    if ((input.metalness != null || input.roughness != null) && !hasParams) {
      return { error: '组件无 PBR 材质通道，用 params/uniforms 改外观', hint: 'getObject → editObject.params/uniforms' }
    }
  }
  if (role === 'mesh' && hasParams && !o.designType) {
    return { error: '基础 mesh 无 params，用 color/metalness/roughness', hint: 'editObject.color 或 getObject.material' }
  }
  if (role === 'light' && (input.metalness != null || input.roughness != null)) {
    return { error: '灯光用 intensity/color/castShadow', hint: 'editObject.intensity/color' }
  }
  return null
}

function detail(o, opts = {}) {
  const d = {
    ...brief(o),
    rotation: v3({ x: o.rotation.x * 57.2958, y: o.rotation.y * 57.2958, z: o.rotation.z * 57.2958 }),
    scale: v3(o.scale),
    worldRotation: worldRotDeg(o),
    worldScale: worldScale(o),
    bounds: getBounds(o),
  }
  if (o.parent?.type !== 'Scene') {
    d.parent = { id: o.parent.id, name: o.parent.name || '(未命名)', worldPosition: worldPos(o.parent) }
  }
  const geo = geomInfo(o)
  if (geo) d.geometry = geo
  if (o.type === 'GridHelper') {
    const grid = parseGridHelper(o)
    if (grid) d.grid = { ...grid, worldPosition: worldPos(o) }
  }
  const custom = readCustomProps(o)
  if (custom.params || custom.uniforms || custom.materials || custom.schema) d.custom = custom
  o.traverse?.(c => {
    if (d.material || !c?.isMesh || !c.material) return
    const m = Array.isArray(c.material) ? c.material[0] : c.material
    if (m?.color) d.material = { color: `#${m.color.getHexString()}`, opacity: r(m.opacity ?? 1) }
  })
  if (o.isLight) d.light = { intensity: r(o.intensity ?? 1), color: o.color ? `#${o.color.getHexString()}` : undefined }
  if (o.isMesh) d.shadow = { castShadow: !!o.castShadow, receiveShadow: !!o.receiveShadow }
  if (o.renderOrder) d.renderOrder = o.renderOrder
  if (o.animations?.length) d.animations = listAnimInfo(o)
  const animPlay = readAnimationPlayParams(o)
  if (animPlay) d.animationPlay = animPlay
  if (opts.children && o.children?.length) {
    d.children = o.children.map(c => ({ id: c.id, name: c.name || '(未命名)', type: c.designType || c.type }))
  }
  d.editHints = buildEditHints(o)
  return d
}

function getGridInfo(editor, includePoints = true) {
  const grids = []
  const cfg = editor.handler?.helpers?.grid
  if (cfg) {
    const item = {
      source: 'editor', show: cfg.showGrid, size: cfg.size, divisions: cfg.divisions,
      cellSize: r(cfg.size / cfg.divisions), plane: 'xz', gridHelperId: cfg.gridHelper?.id ?? null,
    }
    if (includePoints) Object.assign(item, gridIntersections(cfg.gridHelper, cfg.size, cfg.divisions))
    grids.push(item)
  }
  editor.scene.traverse(o => {
    if (o.type !== 'GridHelper' || (cfg?.gridHelper && o.id === cfg.gridHelper.id)) return
    const parsed = parseGridHelper(o)
    if (!parsed) return
    const item = {
      source: 'scene', id: o.id, name: o.name || 'GridHelper', show: o.visible,
      worldPosition: worldPos(o), ...parsed,
    }
    if (includePoints) Object.assign(item, gridIntersections(o, parsed.size, parsed.divisions))
    grids.push(item)
  })
  return {
    grids,
    hint: '默认不含交点列表；需对齐网格时用 includePoints:true。贴地请用 getSpatialContext + placeOnGround',
  }
}

function getSpatialContext(editor, id) {
  const ground = detectGroundSurface(editor)
  const cfg = editor.handler?.helpers?.grid
  const grid = cfg ? {
    show: cfg.showGrid, size: cfg.size, divisions: cfg.divisions,
    cellSize: r(cfg.size / cfg.divisions), plane: 'xz',
  } : null
  const floors = []
  editor.scene.traverse(o => {
    if (!isObj(o)) return
    const b = getBounds(o)
    if (!b || !isFloorLike(o)) return
    floors.push({
      id: o.id, name: o.name || '(未命名)', designType: o.designType || null,
      topY: b.max[1], bottomY: b.min[1], size: b.size, horizontal: isHorizWorld(o),
      worldRotation: worldRotDeg(o),
    })
  })
  let focus = null
  if (id != null) {
    const o = find(editor.scene, id)
    if (!o) focus = { error: `未找到 id=${id}` }
    else {
      const b = getBounds(o)
      focus = {
        id, name: o.name || '(未命名)', type: o.designType || o.type,
        bounds: b, bottomY: b?.min[1], topY: b?.max[1],
        gapToGround: b ? r(ground.y - b.min[1]) : null,
        worldRotation: worldRotDeg(o), geometry: geomInfo(o),
      }
    }
  }
  return {
    axes: { up: '+Y', groundPlane: 'XZ', recommendedGroundY: ground.y, groundRef: ground },
    grid, floors: floors.slice(0, 8), focus,
    rules: {
      pivot: 'position 是轴心不是底面，bottomY=bounds.min.y',
      planeFlat: 'PlaneGeometry 默认竖立，作地面需 rotation [-90,0,0] 或 placeOnGround(flat:true)',
      groundScale: '地面已放平后 scale 必须 [S,S,1] 正方形；禁止 [S,1,1] 会变长条',
      onGround: 'placeOnGround(id) 自动算 y；或 y += recommendedGroundY - bottomY',
    },
  }
}

function placeOnGround(editor, { id, groundY, flat, x, z, refId }) {
  const { obj, error } = findEditable(editor.scene, id)
  if (error) return { error }
  let targetY = groundY
  if (targetY == null) {
    if (refId != null) {
      const ref = find(editor.scene, refId)
      const b = ref && getBounds(ref)
      targetY = b ? b.max[1] : 0
    } else {
      targetY = detectGroundSurface(editor).y
    }
  }
  if (flat) {
    let mesh = obj.geometry?.type === 'PlaneGeometry' ? obj : null
    obj.traverse?.(c => { if (!mesh && c?.isMesh && c.geometry?.type === 'PlaneGeometry') mesh = c })
    if (mesh && !isHorizWorld(mesh)) mesh.rotation.x = -Math.PI / 2
  }
  obj.updateWorldMatrix(true, true)
  const b = getBounds(obj)
  if (!b) return { error: '无法计算包围盒' }
  obj.position.y += targetY - b.min[1]
  if (x != null || z != null) {
    const nx = x != null ? clampN(x, -MAX_POS, MAX_POS) : obj.position.x
    const nz = z != null ? clampN(z, -MAX_POS, MAX_POS) : obj.position.z
    obj.position.set(nx, obj.position.y, nz)
  }
  editor.transformControls.attach(obj)
  const after = getBounds(obj)
  return {
    id: obj.id, groundY: r(targetY), bottomY: after?.min[1],
    object: detail(obj),
  }
}

// L2b · 组件识别 · params/uniforms 读写（左侧面板 designType 物体）
const _reviewedComponents = new WeakMap()

function getReviewedSet(editor) {
  if (!editor) return null
  let set = _reviewedComponents.get(editor)
  if (!set) { set = new Set(); _reviewedComponents.set(editor, set) }
  return set
}

function resolveComponentLabel(label) {
  const d = ThreeEditor.__DESIGNS__.find(x => x.label === label || x.name === label)
  return d?.label || label
}

function markComponentReviewed(editor, label) {
  getReviewedSet(editor)?.add(resolveComponentLabel(label))
}

function isComponentReviewed(editor, label) {
  return getReviewedSet(editor)?.has(resolveComponentLabel(label)) ?? false
}

function buildComponentDetail(editor, label) {
  const design = ThreeEditor.__DESIGNS__.find(d => d.label === label || d.name === label)
  if (!design) {
    return { error: `未找到组件「${label}」`, hint: '用 listResources({ query }) 搜索', components: ThreeEditor.__DESIGNS__.map(d => d.label) }
  }
  const meta = getComponentMeta(design)
  markComponentReviewed(editor, meta.label)
  return {
    ...meta,
    defaults: design.initParameters || {},
    reviewed: true,
    readyToAdd: true,
    nextStep: `addComponent({ label: "${meta.label}", position: [0,0,0] })`,
    hint: `已了解：${meta.looksLike}。确认符合需求后可 addComponent；添加后用 editObject 微调，不合适 deleteObject`,
  }
}

function attachComponentResult(design, result) {
  if (result?.error || !design) return result
  const meta = getComponentMeta(design)
  return {
    ...result,
    component: { label: meta.label, looksLike: meta.looksLike },
    next: 'editObject 调 params/uniforms；不符合预期 deleteObject',
  }
}
function findDesign(obj) {
  if (!obj?.designType) return null
  return ThreeEditor.__DESIGNS__.find(d => d.name === obj.designType)
}

function isGroundComponent(design) {
  const tag = `${design?.label || ''}${design?.name || ''}`
  return /地面|floor|ground|海面|grass|Grass/i.test(tag)
}

function inferComponentCategory(label = '', name = '') {
  const tag = `${label}${name}`
  for (const cat of ELEMENT_CATEGORIES) {
    if (cat.keywords?.test(tag)) return cat
  }
  return ELEMENT_CATEGORIES.find(c => c.id === 'other')
}

function classifySceneObject(o) {
  if (isFloorLike(o)) return { role: 'floor', category: 'ground', hint: '地面参考面，影响贴地高度' }
  if (o.isLight) return { role: 'light', category: 'light', hint: '照明，改 intensity/color/position' }
  if (o.designType) {
    const design = findDesign(o)
    const cat = inferComponentCategory(design?.label || '', o.designType)
    const looks = design ? describeComponentLooks(design).slice(0, 48) : ''
    return {
      role: 'component', category: cat.id,
      componentLabel: design?.label || o.designType,
      hint: looks ? `${looks}；setObjectParams 改 params` : `${cat.label}，用 setObjectParams 改 params/uniforms`,
    }
  }
  if (o.animations?.length) return { role: 'model', category: 'model', hint: 'GLB 模型，listAnimations → playAnimation' }
  if (o.editorType === 'isInnerMesh') return { role: 'mesh', category: 'mesh', hint: '基础几何，setProps/setMaterial' }
  if (o.type === 'Group') return { role: 'group', category: 'group', hint: '容器 Group，改子级用 getDetail.children' }
  if (o.isMesh) return { role: 'mesh', category: 'mesh', hint: 'Mesh，setProps/setMaterial' }
  if (o.isLine || o.isPoints || o.isSprite) return { role: 'primitive', category: 'primitive', hint: 'Line/Points/Sprite 图元' }
  return { role: 'other', category: 'other', hint: 'getDetail 进一步分析' }
}

function describeComponentLooks(design) {
  if (!design) return ''
  const label = design.label || design.name || ''
  if (design.aiDesc) return design.aiDesc
  if (COMPONENT_HINTS[label]) return COMPONENT_HINTS[label]
  const tag = `${label}${design.name || ''}`
  const p = design.initParameters || {}
  const parts = []
  if (/网格地面|科技地面|扫光地面|磨砂反射/.test(tag)) parts.push('XZ 平面 shader 地板/网格，不是立方体')
  else if (/grass|草地/.test(tag)) parts.push('Instanced 草叶铺满的草坪地面')
  else if (/海面|宽水流/.test(tag)) parts.push('动画水面/河流，水平大平面')
  else if (/雷达扫描|扩散波|扫光/.test(tag)) parts.push('地面或空间上的圆形扫描/波纹动效')
  else if (/光柱/.test(tag)) parts.push('垂直发光光柱，地标/强调用')
  else if (/chart|Charts|图表|柱状|折线|饼|scatter|拓扑|雷达图/.test(tag)) parts.push('3D 数据图表，需配置数据 params')
  else if (/粒子|fire|烟花|下雪|火焰|smoke|烟|蒸汽|数字雨|科技粒子/.test(tag)) parts.push('粒子/点精灵系统，大量小点而非单个 solid mesh')
  else if (/地球|3dtiles|智慧城市|大楼展开/.test(tag)) parts.push('地理/城市场景，体量大，非小装饰物')
  else if (/css2d|css3d|ui-|iframe|热点|警告|轮播|表单|评分|2dLink|2D链接|刻度轴|精灵图标|亮光标记/.test(tag)) parts.push('DOM/HTML 或 2D 标注叠在 3D 上，是 UI 不是几何体')
  else if (/天空|groundSky|roomEnv|cubeEnv/.test(tag)) parts.push('天空/环境/反射，影响整场景而非单个摆件')
  else if (/围墙|动态圆墙|路径运动|人物行走|分解还原|反射模型/.test(tag)) parts.push('围绕模型的展示/动画逻辑，不是基础几何')
  else if (/魔法阵|彩虹漩涡|黑洞|极光|蜡烛/.test(tag)) parts.push('艺术 shader 特效组')
  else if (/全景|全景视频/.test(tag)) parts.push('360° 全景视频球/环境')
  else if (/音乐播放器|audio/.test(tag)) parts.push('音频播放 UI，几乎不可见几何')
  if ('text' in p || 'content' in p || 'message' in p || 'fontSize' in p) parts.push('含文字内容参数')
  if (!parts.length) {
    const cat = inferComponentCategory(design.label, design.name)
    parts.push(`${cat.label}「${label}」`)
  }
  return parts.join('；')
}

function componentUsageHints(design) {
  const label = design.label || design.name || ''
  const meshAlt = MESH_INSTEAD[label]
  const cat = inferComponentCategory(design.label, design.name)
  const when = []
  const avoid = []
  if (meshAlt) avoid.push(`若只需简单形状，用 addMesh(${meshAlt}) 而非本组件`)
  if (cat.id === 'ground') when.push('需要 shader 地面/海面/草坪时')
  else if (cat.id === 'chart') when.push('需要数据可视化大屏时')
  else if (cat.id === 'ui') when.push('需要 3D 场景内 UI/标签/热点时')
  else if (cat.id === 'effect') when.push('需要粒子/火焰/天气等氛围特效时')
  else if (cat.id === 'geo') when.push('需要地图/城市/地理展示时')
  else when.push('明确需要此特效/功能时')
  avoid.push('不要用来代替 addMesh 基础几何（立方体/球/柱/平面）')
  if (/环境|天空|roomEnv|cubeEnv|groundSky/.test(label)) avoid.push('不是往场景里「放一个物体」')
  return { whenToUse: when.join('；'), avoidWhen: avoid.join('；') }
}

function getComponentMeta(design) {
  if (!design) return null
  const cat = inferComponentCategory(design.label, design.name)
  const keyParams = design.initParameters ? Object.keys(design.initParameters).slice(0, 8) : []
  const usage = componentUsageHints(design)
  return {
    label: design.label,
    name: design.name,
    category: cat.id,
    categoryLabel: cat.label,
    looksLike: describeComponentLooks(design),
    whenToUse: usage.whenToUse,
    avoidWhen: usage.avoidWhen,
    autoGround: isGroundComponent(design),
    keyParams,
    add: `addComponent({ label:"${design.label}", position:[0,0,0], onGround:${isGroundComponent(design)} })`,
    edit: 'setObjectParams({ id, params, uniforms, materials })',
  }
}

function searchComponents(query, limit = 10) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return { error: '请提供 query 关键词' }
  const designs = ThreeEditor.__DESIGNS__ || []
  const scored = designs.map(d => {
    const meta = getComponentMeta(d)
    const hay = `${d.label}${d.name}${meta.categoryLabel}${meta.looksLike}`.toLowerCase()
    let score = 0
    if (d.label === query || d.name === query) score += 100
    else if (d.label.toLowerCase().includes(q)) score += 60
    else if (hay.includes(q)) score += 30
    for (const word of q.split(/\s+/).filter(Boolean)) {
      if (hay.includes(word)) score += 10
    }
    return { ...meta, score }
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, limit)
  const modelHit = searchModels(query, Math.max(limit, 12))
  return {
    query,
    count: scored.length,
    matches: scored.map(({ score, ...rest }) => rest),
    modelCount: modelHit.count,
    modelMatches: modelHit.matches,
    hint: scored.length || modelHit.count
      ? '组件：从 matches 选 label → listResources({ label }) → addComponent；模型：从 modelMatches 选名称后 addModel({ urlOrName })'
      : '无匹配，换关键词或 listResources 浏览分类与模型库',
  }
}

function normalizeParamsInput(params) {
  const out = {}
  for (const [k, v] of Object.entries(params)) {
    let val = typeof v === 'string' && v.startsWith('#') && /color/i.test(k) ? hexToNum(v) : v
    if (typeof val === 'number') val = clampParam(k, val)
    out[k] = val
  }
  return out
}

function hexToNum(val) {
  if (typeof val === 'number') return val
  if (typeof val === 'string' && val.startsWith('#')) return parseInt(val.slice(1), 16)
  return val
}

function serialVal(v) {
  if (v == null || typeof v === 'string' || typeof v === 'boolean') return v
  if (typeof v === 'number') return r(v)
  if (v.isColor) return `#${v.getHexString()}`
  if (v.isVector2) return [r(v.x), r(v.y)]
  if (v.isVector3) return v3(v)
  if (v.isVector4) return [r(v.x), r(v.y), r(v.z), r(v.w)]
  if (v.isTexture) return { type: 'texture' }
  return undefined
}

const UNIFORM_TO_PARAM = {
  uGridColor: 'gridColor', uFloorColor: 'floorColor', uCrossColor: 'crossColor',
  uColor: 'color', uGridThickness: 'gridThickness', uCrossThickness: 'crossThickness', uCross: 'cross',
}

function collectUniformsFromObject(obj) {
  const out = {}
  const add = (uniforms, prefix) => {
    if (!uniforms) return
    for (const [k, e] of Object.entries(uniforms)) {
      const val = serialVal(e?.value ?? e)
      if (val !== undefined) out[prefix ? `${prefix}.${k}` : k] = val
    }
  }
  add(obj.uniforms, '')
  if (obj.material?.uniforms) add(obj.material.uniforms, '')
  obj.traverse?.(c => {
    if (c === obj || !c?.isMesh || !c.material) return
    add(c.material.uniforms, c.name || `mesh_${c.id}`)
  })
  return out
}

function readStandardMaterials(obj) {
  const mats = {}
  const add = (m, key) => {
    if (!m) return
    const info = {}
    if (m.color) info.color = `#${m.color.getHexString()}`
    if (m.opacity != null) info.opacity = r(m.opacity)
    if (m.metalness != null) info.metalness = r(m.metalness)
    if (m.roughness != null) info.roughness = r(m.roughness)
    if (m.emissive) info.emissive = `#${m.emissive.getHexString()}`
    if (m.transparent != null) info.transparent = m.transparent
    if (Object.keys(info).length) mats[key] = info
  }
  if (obj.isMesh && obj.material) add([].concat(obj.material)[0], 'self')
  obj.traverse?.(c => {
    if (c === obj || !c?.isMesh || !c.material) return
    add([].concat(c.material)[0], c.name || c.type)
  })
  return Object.keys(mats).length ? mats : null
}

function readCustomProps(obj) {
  const design = findDesign(obj)
  const custom = { designType: obj.designType || null, componentLabel: design?.label || null }
  if (design?.initParameters) custom.schema = { ...design.initParameters }
  if (obj.params && typeof obj.params === 'object') {
    custom.params = {}
    for (const [k, v] of Object.entries(obj.params)) {
      if (typeof v === 'number') custom.params[k] = r(v)
      else if (typeof v === 'string' || typeof v === 'boolean') custom.params[k] = v
    }
  }
  const uniforms = collectUniformsFromObject(obj)
  if (Object.keys(uniforms).length) custom.uniforms = uniforms
  const materials = readStandardMaterials(obj)
  if (materials) custom.materials = materials
  const extras = {}
  if (typeof obj.needsUpdate === 'boolean') extras.needsUpdate = obj.needsUpdate
  if (Object.keys(extras).length) custom.extras = extras
  let node = obj
  while (node) {
    const ap = readAnimationPlayParams(node)
    if (ap) { custom.animationPlay = ap; break }
    node = node.parent
  }
  return custom
}

function applyUniformEntry(entry, val) {
  if (entry == null || val == null) return false
  try {
    const hasWrap = entry.value !== undefined
    const v = hasWrap ? entry.value : entry
    if (v?.isColor) {
      const c = safeColor(typeof val === 'number' ? `#${val.toString(16).padStart(6, '0')}` : val)
      if (!c) return false
      v.set(c)
      return true
    }
    if (v?.isVector2 && Array.isArray(val) && val.length >= 2) {
      v.set(fin(val[0]), fin(val[1])); return true
    }
    if (v?.isVector3 && Array.isArray(val) && val.length >= 3) {
      v.set(fin(val[0]), fin(val[1]), fin(val[2])); return true
    }
    if (typeof v === 'number' && typeof val === 'number' && Number.isFinite(val)) {
      if (hasWrap) entry.value = val
      return true
    }
    if (typeof v === 'boolean' && typeof val === 'boolean') {
      if (hasWrap) entry.value = val
      return true
    }
  } catch { return false }
  return false
}

function applyUniformsOnObject(obj, uniforms) {
  if (!uniforms) return { applied: [], skipped: [] }
  const applied = [], skipped = []
  for (const [key, val] of Object.entries(uniforms)) {
    const bare = key.includes('.') ? key.split('.').pop() : key
    let hit = false
    if (obj.uniforms?.[bare]) hit = applyUniformEntry(obj.uniforms[bare], val)
    if (!hit && obj.material?.uniforms?.[bare]) hit = applyUniformEntry(obj.material.uniforms[bare], val)
    if (!hit) {
      obj.traverse?.(c => {
        if (!hit && c.material?.uniforms?.[bare]) hit = applyUniformEntry(c.material.uniforms[bare], val)
      })
    }
    if (hit) {
      applied.push(bare)
      const paramKey = UNIFORM_TO_PARAM[bare]
      if (paramKey && obj.params && paramKey in obj.params) {
        obj.params[paramKey] = typeof val === 'string' && val.startsWith('#') ? hexToNum(val) : val
      }
    } else skipped.push(key)
  }
  safeCall(() => obj.updateUniforms?.(), 'updateUniforms')
  return { applied, skipped }
}

function applyStandardMaterials(obj, materials) {
  if (!materials) return
  const apply = (m, patch) => {
    if (!m || !patch) return
    try {
      if (patch.color) { const c = safeColor(patch.color); if (c) m.color?.set(c) }
      if (patch.opacity != null) {
        m.opacity = clampN(patch.opacity, 0, 1)
        m.transparent = m.opacity < 1
      }
      if (patch.metalness != null) m.metalness = clampN(patch.metalness, 0, 1)
      if (patch.roughness != null) m.roughness = clampN(patch.roughness, 0, 1)
      if (patch.emissive) { const c = safeColor(patch.emissive); if (c) m.emissive?.set(c) }
      m.needsUpdate = true
    } catch { /* 跳过无效材质 */ }
  }
  if (materials.self && obj.material) apply([].concat(obj.material)[0], materials.self)
  obj.traverse?.(c => {
    if (!c?.isMesh || !c.material) return
    const patch = materials[c.name] || materials[c.type]
    if (patch) apply([].concat(c.material)[0], patch)
  })
}

const REBUILD_PARAMS = new Set(['count', 'elementSize', 'range', 'size', 'radius', 'height', 'segments'])

function setObjectParams(editor, { id, params, uniforms, extras, materials }) {
  const { obj, error } = findEditable(editor.scene, id)
  if (error) return { error }

  if (params) {
    if (!obj.params) return { error: '该对象没有 params，请用 setProps 或 uniforms/materials' }
    const allowed = Object.keys(obj.params)
    const unknown = Object.keys(params).filter(k => !allowed.includes(k))
    if (unknown.length) return { error: `不允许修改未知 params: ${unknown.join(', ')}`, allowed }
    const normalized = normalizeParamsInput(params)
    const design = findDesign(obj)
    if (design?.setStorage) {
      safeCall(() => design.setStorage(obj, { params: normalized }), 'setStorage')
    } else {
      for (const [k, v] of Object.entries(normalized)) obj.params[k] = v
    }
    if (params.opacity != null && obj.material) obj.material.opacity = clampN(params.opacity, 0, 1)
  }

  const uniformResult = applyUniformsOnObject(obj, uniforms)
  applyStandardMaterials(obj, materials)

  if (materials?.self?.opacity != null) {
    const op = clampN(materials.self.opacity, 0, 1)
    if (obj.material) obj.material.opacity = op
    if (obj.params && 'opacity' in obj.params) obj.params.opacity = op
  }

  if (extras) {
    for (const [k, v] of Object.entries(extras)) {
      if (!EXTRA_KEYS.has(k)) continue
      if (k === 'needsUpdate' && typeof obj.needsUpdate === 'boolean') obj.needsUpdate = !!v
    }
  }

  // 结构性 params 变更：无 setStorage 时尝试刷新
  const design = findDesign(obj)
  const needsRebuild = params && !design?.setStorage && Object.keys(params).some(k => REBUILD_PARAMS.has(k))
  if (needsRebuild && (!params.count || params.count <= MAX_COUNT)) {
    safeCall(() => obj.createElements?.(), 'createElements')
    safeCall(() => obj.updateGeometry?.(), 'updateGeometry')
  }
  if (params?.randomInterval != null) {
    safeCall(() => { obj.stopRandomize?.(); obj.startRandomize?.() }, 'randomize')
  }

  editor.transformControls.attach(obj)
  const result = { object: detail(obj), custom: readCustomProps(obj) }
  if (uniformResult.skipped.length) result.uniformSkipped = uniformResult.skipped
  return result
}


const MODEL_NAME_ALIASES = {
  狐狸: 'fox',
  狐狸模型: 'fox',
  fox模型: 'fox',
}

function cleanModelText(value = '') {
  return String(value || '')
    .trim()
    .replace(/^['"`“”‘’]+|['"`“”‘’]+$/g, '')
}

function modelStem(name = '') {
  return String(name || '').replace(/\.[^.]+$/, '')
}

function normModelToken(value = '') {
  return cleanModelText(value).toLowerCase().replace(/[\s_-]+/g, '')
}

function modelMatchTokens(value = '') {
  const raw = cleanModelText(value)
  const stripped = raw.replace(/(模型|model|加载|导入|添加|加个|来个|请|帮我|一下|一个|这只|这个)/gi, '')
  const tokens = new Set([
    normModelToken(raw),
    normModelToken(modelStem(raw)),
    normModelToken(stripped),
    normModelToken(modelStem(stripped)),
  ].filter(Boolean))

  for (const token of [...tokens]) {
    const alias = MODEL_NAME_ALIASES[token]
    if (!alias) continue
    tokens.add(normModelToken(alias))
    tokens.add(normModelToken(modelStem(alias)))
  }

  return [...tokens]
}

function modelEntries() {
  return (window.models || []).map((url) => {
    const name = String(url || '').split('/').pop()
    const stem = modelStem(name)
    return {
      name,
      stem,
      url,
      nameNorm: normModelToken(name),
      stemNorm: normModelToken(stem),
      urlNorm: normModelToken(url),
    }
  })
}

function scoreModelEntry(entry, tokens) {
  let score = 0
  for (const token of tokens) {
    if (!token) continue
    if (entry.nameNorm === token) score = Math.max(score, 130)
    else if (entry.stemNorm === token) score = Math.max(score, 120)
    else if (entry.urlNorm.endsWith(token)) score = Math.max(score, 100)
    else if (entry.nameNorm.includes(token)) score = Math.max(score, 80)
    else if (entry.stemNorm.includes(token)) score = Math.max(score, 70)
    else if (entry.urlNorm.includes(token)) score = Math.max(score, 60)
  }
  return score
}

function findModelMatches(urlOrName, limit = 8) {
  const tokens = modelMatchTokens(urlOrName)
  if (!tokens.length) return []
  return modelEntries()
    .map((entry) => ({ entry, score: scoreModelEntry(entry, tokens) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name))
    .slice(0, limit)
    .map(item => item.entry)
}

function listModels() {
  return modelEntries().map(({ name, stem, url }) => ({ name, stem, url }))
}

function searchModels(query, limit = 12) {
  const q = cleanModelText(query)
  if (!q) return { query, count: 0, matches: [] }
  const matches = findModelMatches(q, limit)
  return {
    query,
    count: matches.length,
    matches: matches.map(m => m.name),
  }
}

function listScenes() {
  return (window.editorJsons || []).map(v => ({ name: v.split('/').pop().replace('.json', ''), path: scenePath(v) }))
}

function resolveModelUrl(urlOrName) {
  const raw = cleanModelText(urlOrName)
  if (!raw || /^https?:\/\//i.test(raw)) return null
  const exact = modelEntries().find(m => m.url === raw || m.name === raw)
  if (exact) return exact.url
  const [best] = findModelMatches(raw, 1)
  return best?.url || null
}

// L2c · 物体增删改（setProps / addMesh / addComponent / addModel / addLight）
function setProps(editor, { id, name, visible, position, rotation, scale, color, opacity, intensity, castShadow, receiveShadow, renderOrder }) {
  const { obj, error } = findEditable(editor.scene, id)
  if (error) return { error }
  if (name != null) obj.name = String(name).slice(0, 128)
  if (visible != null) obj.visible = !!visible
  if (position) {
    const p = vec3Input(position)
    if (!p) return { error: 'position 无效，需 3 个有限数值' }
    obj.position.set(...p)
  }
  if (rotation) {
    const rot = safeVec3(rotation, -3600, 3600)
    if (!rot) return { error: 'rotation 无效' }
    obj.rotation.set(...rot.map(d => d * Math.PI / 180))
  }
  if (scale) {
    const s = safeScaleVec(scale)
    if (!s) return { error: 'scale 无效，不能为 0 且需在合理范围内' }
    obj.scale.set(...s)
  }
  if (intensity != null && obj.isLight) obj.intensity = clampN(intensity, 0, MAX_INTENSITY)
  if (renderOrder != null) obj.renderOrder = clampN(renderOrder, -1000, 1000)
  if (castShadow != null || receiveShadow != null) {
    if (castShadow != null && obj.isLight) obj.castShadow = !!castShadow
    obj.traverse?.(c => {
      if (!c.isMesh) return
      if (castShadow != null) c.castShadow = !!castShadow
      if (receiveShadow != null) c.receiveShadow = !!receiveShadow
    })
  }
  const hex = color ? safeColor(color.startsWith('#') ? color : `#${color}`) : null
  if (color && !hex) return { error: 'color 无效，需 #rrggbb 格式' }
  if (hex && obj.isLight && obj.color) obj.color.set(hex)
  if (hex || opacity != null) {
    obj.traverse?.(c => {
      if (!c?.isMesh || !c.material) return
      ;[].concat(c.material).forEach(m => {
        try {
          if (hex && m.color) m.color.set(hex)
          if (opacity != null) { m.opacity = clampN(opacity, 0, 1); m.transparent = m.opacity < 1 }
          m.needsUpdate = true
        } catch { /* skip */ }
      })
    })
  }
  editor.transformControls.attach(obj)
  return { object: detail(obj) }
}

function selectObject(editor, id) {
  const obj = find(editor.scene, id)
  if (!obj) return { error: `未找到 id=${id}` }
  if (isProtected(obj)) return { error: `id=${id} 为受保护对象，不可选中操作` }
  editor.transformControls.attach(obj)
  return { id, name: obj.name || '(未命名)', selected: true }
}

function deleteObject(editor, id) {
  const { obj, error } = findEditable(editor.scene, id)
  if (error) return { error }
  if (editor.transformControls.object?.id === id) editor.transformControls.detach()
  disposeObject3D(obj)
  editor.scene.remove(obj)
  return { deleted: id, name: obj.name || '(未命名)', disposed: true }
}

function disposeObject3D(obj) {
  obj.traverse?.(c => {
    safeCall(() => c.geometry?.dispose(), 'disposeGeometry')
    const mats = c.material ? [].concat(c.material) : []
    for (const m of mats) {
      if (!m) continue
      for (const k of Object.keys(m)) {
        if (m[k]?.isTexture) safeCall(() => m[k].dispose(), 'disposeTexture')
      }
      safeCall(() => m.dispose?.(), 'disposeMaterial')
    }
  })
}

function addLight(editor, type, position = [0, 5, 0]) {
  const map = {
    '环境光': () => new THREE.AmbientLight(0xffffff, 1),
    '平行光': () => new THREE.DirectionalLight(0xffffff, 1),
    '点光源': () => new THREE.PointLight(0xffffff, 1, 0, 0),
    '聚光灯': () => new THREE.SpotLight(0xffffff, 1, 0, Math.PI / 6, 0, 0),
    '半球光': () => new THREE.HemisphereLight(0xffffff, 0x000000, 1),
    '平面光': () => new THREE.RectAreaLight(0xffffff, 1, 100, 100),
  }
  const fn = map[type]
  if (!fn) return { error: `未知灯光「${type}」`, types: LIGHT_TYPES }
  const pos = safeVec3(position) || [0, 5, 0]
  const light = fn()
  if (light.target) editor.scene.add(light.target)
  light.editorType = 'isLight'
  light.name = type
  light.position.set(...pos)
  if (type === '平行光' || type === '聚光灯') {
    light.castShadow = true
    if (light.shadow?.mapSize) light.shadow.mapSize.set(2048, 2048)
  }
  attachObject(editor, light)
  const out = { object: detail(light) }
  if (type === '平行光' || type === '聚光灯') {
    out.hint = '已开 castShadow；完整阴影用 enableShadows()，勿用 setEnvironment'
  }
  return out
}

function addNativeLight(editor, { type = 'DirectionalLight', position, color, intensity }) {
  const hex = color != null ? safeHexInt(color) : 0xffffff
  if (color != null && hex == null) return { error: 'color 无效，需 #rrggbb 或数字' }
  const i = clampN(intensity ?? 1, 0, MAX_INTENSITY)
  let light
  switch (type) {
    case 'AmbientLight': light = new THREE.AmbientLight(hex, i); break
    case 'DirectionalLight': light = new THREE.DirectionalLight(hex, i); break
    case 'PointLight': light = new THREE.PointLight(hex, i, 0, 0); break
    case 'SpotLight': light = new THREE.SpotLight(hex, i, 0, Math.PI / 6, 0, 0); break
    case 'HemisphereLight': light = new THREE.HemisphereLight(hex, 0x000000, i); break
    case 'RectAreaLight': light = new THREE.RectAreaLight(hex, i, 100, 100); break
    default: return { error: `未知灯光「${type}」`, types: NATIVE_LIGHT_TYPES }
  }
  if (light.target) editor.scene.add(light.target)
  light.editorType = 'isLight'
  light.name = type
  light.position.set(...(safeVec3(position) || [0, 5, 0]))
  attachObject(editor, light)
  return { object: detail(light) }
}

async function addMesh(editor, type, position = [0, 0, 0], color = '#ffffff', name, flyTo = false, opts = {}) {
  const geoFn = MESH_TYPES[type]
  if (!geoFn) return { error: `未知几何体「${type}」`, types: Object.keys(MESH_TYPES) }
  const hex = safeColor(color.startsWith('#') ? color : `#${color}`) || '#ffffff'
  const pos = safeVec3(position) || [0, 0, 0]
  const isGroundPlane = type === '平面' && (opts.onGround || opts.flat || opts.size != null)
  const geo = isGroundPlane
    ? new THREE.PlaneGeometry(
        clampN(opts.size ?? editor.handler?.helpers?.grid?.size ?? 50, 1, 500),
        clampN(opts.size ?? editor.handler?.helpers?.grid?.size ?? 50, 1, 500),
      )
    : geoFn()
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: hex }))
  mesh.editorType = 'isInnerMesh'
  mesh.name = String(name || type).slice(0, 128)
  mesh.position.set(...pos)
  if (opts.rotation) {
    const rot = safeVec3(opts.rotation, -3600, 3600)
    if (rot) mesh.rotation.set(...rot.map(d => d * Math.PI / 180))
  }
  if (opts.onGround || opts.flat) {
    editor.scene.add(mesh)
    const res = placeOnGround(editor, { id: mesh.id, flat: opts.flat ?? type === '平面' })
    if (res.error) return res
    editor.transformControls.attach(mesh)
    if (flyTo) await flyToObject(editor, mesh, 0.3)
    return { object: res.object, placed: { groundY: res.groundY, bottomY: res.bottomY } }
  }
  attachObject(editor, mesh)
  if (flyTo) await flyToObject(editor, mesh, 0.3)
  return { object: detail(mesh) }
}

async function addMeshes(editor, items) {
  const objects = []
  for (const { type, position, color, name } of items) {
    const res = await addMesh(editor, type, position, color ?? '#ffffff', name, false)
    if (res.object) objects.push(res.object)
    else return res
  }
  return { count: objects.length, objects }
}

async function addComponent(editor, label, position, flyTo = false, onGround) {
  const design = ThreeEditor.__DESIGNS__.find(d => d.label === label || d.name === label)
  if (!design) return { error: `未找到组件「${label}」`, hint: '用 listResources({ query:"关键词" }) 搜索，勿凭名字猜测' }
  if (!isComponentReviewed(editor, label)) {
    return {
      error: `请先 listResources({ label: "${resolveComponentLabel(label)}" }) 了解 looksLike/defaults，确认后再添加`,
      workflow: ['listResources({ label }) → 了解组件', 'addComponent → 添加到场景尝试', 'editObject 微调 或 deleteObject 删除'],
    }
  }
  const pos = safeVec3(position)
  if (!pos) return { error: 'position 无效' }
  let mesh
  try {
    mesh = await design.create(null, editor, editor)
  } catch (e) {
    return { error: `组件创建失败: ${e?.message || String(e)}` }
  }
  if (!mesh) return { error: '组件创建失败' }
  mesh.editorType = 'isDesignMesh'
  mesh.designType = design.name
  editor.scene.add(mesh)
  mesh.position.set(...pos)
  const shouldGround = onGround ?? isGroundComponent(design)
  if (shouldGround) {
    const res = placeOnGround(editor, { id: mesh.id, flat: true })
    if (res.error) return res
    editor.transformControls.attach(mesh)
    if (flyTo) await flyToObject(editor, mesh, 0.3)
    return attachComponentResult(design, { object: res.object, placed: { groundY: res.groundY, bottomY: res.bottomY } })
  }
  editor.transformControls.attach(mesh)
  if (flyTo) await flyToObject(editor, mesh, 0.3)
  return attachComponentResult(design, { object: detail(mesh) })
}

function addModel(editor, urlOrName, position = [0, 0, 0], flyTo = false, anim = {}, onGround = true) {
  const raw = cleanModelText(urlOrName)
  if (/^https?:\/\//i.test(raw)) {
    return {
      error: 'addModel 仅支持编辑器本地模型库名称，不接受外部 URL',
      hint: '先用 listResources({ query }) 找到本地模型名（如 Fox.glb）再 addModel；在线 URL 请明确要求后走 runEditorAction(loadOnlineModel)',
    }
  }
  const url = resolveModelUrl(raw)
  if (!url) {
    const suggestions = findModelMatches(raw, 8).map(m => m.name)
    return {
      error: `未找到模型「${urlOrName}」`,
      hint: '先用 listResources({ query: "fox" }) 或 listResources() 查看 models，再把名称传给 addModel',
      candidates: suggestions,
    }
  }
  const pos = safeVec3(position) || [0, 0, 0]
  return new Promise(resolve => {
    try {
      const { loaderService } = editor.modelCores.loadModel(url)
      loaderService.complete = async model => {
        try {
          model.position.set(...pos)
          ensureAnimationPlayParams(model)
          if (onGround) {
            const pg = placeOnGround(editor, { id: model.id })
            if (pg.error) { resolve(pg); return }
          }
          attachObject(editor, model)
          if (flyTo) await flyToObject(editor, model, 0.3)
          const result = { object: detail(model), url, animationPlay: readAnimationPlayParams(model) }
          if (model.animations?.length) {
            const resolved = resolveAnimIndices(model, anim)
            const hasAnimOpts = anim.initPlay != null || anim.loop != null || anim.speed != null
              || anim.startTime != null || resolved.length
            if (hasAnimOpts) {
              syncAnimParams(model, resolved, anim.speed, anim.loop, anim.startTime, anim.initPlay)
              result.animationPlay = readAnimationPlayParams(model)
            }
            if (anim.initPlay && !resolved.length) {
              result.playHint = 'initPlay 需配合 index/indices/name/names'
            } else if (resolved.length && (anim.initPlay || anim.index != null || anim.indices?.length || anim.name || anim.names?.length)) {
              const playRes = playModelAnimation(editor, { id: model.id, ...anim, loop: anim.loop ?? true })
              if (playRes.error) result.playError = playRes.error
              else result.playing = playRes.playing
              result.animationPlay = readAnimationPlayParams(model)
            }
          }
          resolve(result)
        } catch (e) {
          resolve({ error: `模型加载后处理失败: ${e?.message || String(e)}` })
        }
      }
      loaderService.error = (e) => resolve({ error: `模型加载失败: ${e?.message || url}` })
    } catch (e) {
      resolve({ error: `模型加载失败: ${e?.message || String(e)}` })
    }
  })
}

async function loadScene(editor, nameOrPath) {
  let path = nameOrPath
  if (!nameOrPath.includes('/')) {
    const item = (window.editorJsons || []).find(v => v.includes(nameOrPath))
    if (!item) return { error: `未找到场景「${nameOrPath}」`, scenes: listScenes().map(s => s.name) }
    path = scenePath(item)
  }
  try {
    const res = await fetch(path)
    if (!res.ok) return { error: `场景加载失败: HTTP ${res.status}` }
    const data = await res.json()
    editor.resetEditorStorage(data)
    return { loaded: path.split('/').pop(), objects: listObjects(editor) }
  } catch (e) {
    return { error: `场景加载失败: ${e?.message || String(e)}` }
  }
}

function isFinitePos(v) {
  return v && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z)
}

function boundsFrame(obj) {
  const b = getBounds(obj)
  if (!b) return null
  const [cx, cy, cz] = b.center
  const maxDim = Math.max(b.size[0], b.size[1], b.size[2], 0.01)
  const dist = clampN(maxDim * 4, 2, 80)
  return {
    maxView: { x: cx + dist * 0.55, y: cy + dist * 0.35, z: cz + dist * 0.55 },
    target: { x: cx, y: cy, z: cz },
    source: 'bounds',
  }
}

function resolveCameraFrame(editor, obj) {
  if (!obj) return null
  try {
    const views = getObjectViews(obj, editor.camera)
    if (isFinitePos(views?.maxView) && isFinitePos(views?.target)) {
      return { maxView: views.maxView, target: views.target, source: 'getObjectViews' }
    }
  } catch { /* fallback */ }
  return boundsFrame(obj)
}

function resolveSceneFrame(editor) {
  const objs = collectObjects(editor, {}).filter(o => !o.isLight)
  if (!objs.length) return null
  _box.makeEmpty()
  for (const o of objs) {
    try { _box.expandByObject(o) } catch { /* skip */ }
  }
  if (_box.isEmpty()) return null
  const c = _box.getCenter(_v)
  const s = _box.getSize(new THREE.Vector3())
  const maxDim = Math.max(s.x, s.y, s.z, 0.01)
  const dist = clampN(maxDim * 2.2, 3, 100)
  return {
    maxView: { x: c.x + dist * 0.6, y: c.y + dist * 0.4, z: c.z + dist * 0.6 },
    target: { x: c.x, y: c.y, z: c.z },
    source: 'sceneBounds',
  }
}

async function flyToObject(editor, obj, duration = 0.5) {
  const frame = resolveCameraFrame(editor, obj)
  if (!frame) return { error: '无法计算相机视角（物体无包围盒）' }
  try {
    if (!editor.camera || !editor.controls) return { error: '相机/轨道控制器未就绪' }
    const d = clampN(duration, 0.1, 5)
    await Promise.all([
      createGsapAnimation(editor.camera.position, frame.maxView, { duration: d }),
      createGsapAnimation(editor.controls.target, frame.target, { duration: d }),
    ])
    editor.controls.update?.()
    return { focused: true, objectId: obj.id, source: frame.source, target: v3(_v.set(frame.target.x, frame.target.y, frame.target.z)) }
  } catch (e) {
    return { error: `运镜失败: ${e?.message || String(e)}` }
  }
}

async function focusObject(editor, id, duration = 0.5) {
  const { obj, error } = findEditable(editor.scene, id)
  if (error) return { error }
  const res = await flyToObject(editor, obj, duration)
  if (res?.error) return res
  return { focused: id, name: obj.name || '(未命名)', ...res }
}

/** 无指定物体时框选整个场景 */
export async function focusScene(editor, duration = 0.5) {
  const frame = resolveSceneFrame(editor)
  if (!frame) return { error: '场景无可见物体，无法运镜' }
  try {
    if (!editor.camera || !editor.controls) return { error: '相机/轨道控制器未就绪' }
    const d = clampN(duration, 0.1, 5)
    await Promise.all([
      createGsapAnimation(editor.camera.position, frame.maxView, { duration: d }),
      createGsapAnimation(editor.controls.target, frame.target, { duration: d }),
    ])
    editor.controls.update?.()
    return { focused: true, mode: 'scene', source: frame.source, target: v3(_v.set(frame.target.x, frame.target.y, frame.target.z)) }
  } catch (e) {
    return { error: `运镜失败: ${e?.message || String(e)}` }
  }
}

/** 阴影四要素：渲染器 + 主光源 + cast/receive */
export function enableSceneShadows(editor, { castIds = [], receiveIds = [] } = {}) {
  const out = { steps: [] }
  const r = editor?.renderer
  if (!r) return { error: 'renderer 未就绪' }
  if (r.shadowMap) {
    r.shadowMap.enabled = true
    out.steps.push('renderer.shadowMap.enabled')
  }
  let mainLight = null
  editor.scene?.traverse(o => {
    if (mainLight || !o.isLight) return
    if (o.type === 'DirectionalLight' || o.type === 'SpotLight') mainLight = o
  })
  if (mainLight) {
    mainLight.castShadow = true
    if (mainLight.shadow?.mapSize) mainLight.shadow.mapSize.set(2048, 2048)
    if (mainLight.type === 'DirectionalLight' && mainLight.shadow?.camera) {
      const c = mainLight.shadow.camera
      c.near = 0.5
      c.far = 60
      c.left = c.bottom = -30
      c.right = c.top = 30
      c.updateProjectionMatrix?.()
    }
    out.steps.push(`#${mainLight.id} ${mainLight.name || mainLight.type} castShadow`)
  } else {
    out.warn = '无平行光/聚光灯，addLight 平行光后再开阴影'
  }
  const apply = (ids, key) => {
    for (const id of ids) {
      const res = setProps(editor, { id, [key]: true })
      if (!res.error) out.steps.push(`#${id} ${key}`)
    }
  }
  apply(receiveIds, 'receiveShadow')
  apply(castIds, 'castShadow')
  if (!castIds.length && !receiveIds.length) {
    for (const o of collectObjects(editor, { deep: true })) {
      if (o.isLight || isProtected(o)) continue
      if (isFloorLike(o)) setProps(editor, { id: o.id, receiveShadow: true })
      else if (o.isMesh) setProps(editor, { id: o.id, castShadow: true })
    }
    out.steps.push('auto cast/receive')
  }
  out.ok = out.steps.length > 0
  return out
}

async function focusView(editor, position, target, duration = 0.5) {
  const p = safeVec3(position)
  const t = safeVec3(target)
  if (!p || !t) return { error: 'position/target 无效' }
  const d = clampN(duration, 0.1, 5)
  try {
    await Promise.all([
      createGsapAnimation(editor.camera.position, { x: p[0], y: p[1], z: p[2] }, { duration: d }),
      createGsapAnimation(editor.controls.target, { x: t[0], y: t[1], z: t[2] }, { duration: d }),
    ])
  } catch { return { error: '视角切换失败' } }
  return { focused: true, position: p, target: t }
}

// ── Three.js 原生操作 ──

function resolveMeshTarget(obj, meshName) {
  if (!obj) return null
  if (!meshName) return obj.isMesh ? obj : null
  let found = null
  obj.traverse(c => { if (!found && c.isMesh && c.name === meshName) found = c })
  return found
}

function gp(p, key, def, lo, hi) {
  return clampN(p[key] ?? def, lo, hi)
}

function parsePath3D(points, max = MAX_CURVE_POINTS) {
  if (!Array.isArray(points) || points.length < 2) return { error: 'points 至少 2 个点' }
  if (points.length > max) return { error: `points 最多 ${max} 个` }
  const out = []
  for (const p of points) {
    const v = vec3Input(p)
    if (!v) return { error: 'points 含无效坐标' }
    out.push(new THREE.Vector3(...v))
  }
  return { vectors: out }
}

function parseProfile2D(points, max = MAX_CURVE_POINTS) {
  if (!Array.isArray(points) || points.length < 2) return { error: 'profile 至少 2 个点' }
  if (points.length > max) return { error: `profile 最多 ${max} 个点` }
  const out = []
  for (const p of points) {
    if (!Array.isArray(p) || p.length < 2) return { error: 'profile 格式 [[x,y],...]' }
    out.push(new THREE.Vector2(clampN(p[0], -MAX_POS, MAX_POS), clampN(p[1], -MAX_POS, MAX_POS)))
  }
  return { vectors: out }
}

function buildNativeGeometry(type, params = {}) {
  const p = params
  switch (type) {
    case 'BoxGeometry':
      return new THREE.BoxGeometry(gp(p, 'width', 1, 0.01, 500), gp(p, 'height', 1, 0.01, 500), gp(p, 'depth', 1, 0.01, 500))
    case 'SphereGeometry':
      return new THREE.SphereGeometry(gp(p, 'radius', 0.5, 0.01, 500), gp(p, 'widthSegments', 32, 3, 128), gp(p, 'heightSegments', 16, 2, 128))
    case 'PlaneGeometry':
      return new THREE.PlaneGeometry(gp(p, 'width', 1, 0.01, 500), gp(p, 'height', 1, 0.01, 500), gp(p, 'widthSegments', 1, 1, 128), gp(p, 'heightSegments', 1, 1, 128))
    case 'CylinderGeometry':
      return new THREE.CylinderGeometry(gp(p, 'radiusTop', 0.5, 0.01, 500), gp(p, 'radiusBottom', 0.5, 0.01, 500), gp(p, 'height', 1, 0.01, 500), gp(p, 'radialSegments', 32, 3, 128))
    case 'ConeGeometry':
      return new THREE.ConeGeometry(gp(p, 'radius', 0.5, 0.01, 500), gp(p, 'height', 1, 0.01, 500), gp(p, 'radialSegments', 32, 3, 128))
    case 'TorusGeometry':
      return new THREE.TorusGeometry(gp(p, 'radius', 0.5, 0.01, 500), gp(p, 'tube', 0.2, 0.01, 200), gp(p, 'radialSegments', 16, 3, 128), gp(p, 'tubularSegments', 32, 3, 128))
    case 'TorusKnotGeometry':
      return new THREE.TorusKnotGeometry(gp(p, 'radius', 0.4, 0.01, 500), gp(p, 'tube', 0.1, 0.01, 200), gp(p, 'tubularSegments', 64, 3, 256), gp(p, 'radialSegments', 8, 3, 64))
    case 'IcosahedronGeometry':
      return new THREE.IcosahedronGeometry(gp(p, 'radius', 0.5, 0.01, 500), gp(p, 'detail', 0, 0, 8))
    case 'OctahedronGeometry':
      return new THREE.OctahedronGeometry(gp(p, 'radius', 0.5, 0.01, 500), gp(p, 'detail', 0, 0, 8))
    case 'DodecahedronGeometry':
      return new THREE.DodecahedronGeometry(gp(p, 'radius', 0.5, 0.01, 500), gp(p, 'detail', 0, 0, 8))
    case 'TetrahedronGeometry':
      return new THREE.TetrahedronGeometry(gp(p, 'radius', 0.5, 0.01, 500), gp(p, 'detail', 0, 0, 8))
    case 'CapsuleGeometry':
      return new THREE.CapsuleGeometry(gp(p, 'radius', 0.5, 0.01, 500), gp(p, 'length', 1, 0.01, 500), gp(p, 'capSegments', 4, 1, 32), gp(p, 'radialSegments', 8, 3, 64))
    case 'RingGeometry':
      return new THREE.RingGeometry(gp(p, 'innerRadius', 0.3, 0.01, 500), gp(p, 'outerRadius', 0.5, 0.01, 500), gp(p, 'thetaSegments', 32, 3, 128))
    case 'CircleGeometry':
      return new THREE.CircleGeometry(gp(p, 'radius', 0.5, 0.01, 500), gp(p, 'segments', 32, 3, 128))
    case 'LatheGeometry': {
      const parsed = parseProfile2D(p.points)
      if (parsed.error) return null
      return new THREE.LatheGeometry(parsed.vectors, gp(p, 'segments', 32, 3, 128), gp(p, 'phiStart', 0, -Math.PI * 2, Math.PI * 2), gp(p, 'phiLength', Math.PI * 2, 0, Math.PI * 2))
    }
    case 'TubeGeometry': {
      const parsed = parsePath3D(p.points)
      if (parsed.error) return null
      const curve = new THREE.CatmullRomCurve3(parsed.vectors)
      return new THREE.TubeGeometry(curve, gp(p, 'tubularSegments', 64, 8, 256), gp(p, 'radius', 0.2, 0.01, 50), gp(p, 'radialSegments', 8, 3, 64), false)
    }
    default:
      return null
  }
}

function materialOptsFromParams(params = {}) {
  const opts = {}
  if (params.color != null) {
    const c = safeColor(typeof params.color === 'string' && !params.color.startsWith('#') ? `#${params.color}` : String(params.color))
    if (c) opts.color = c
  }
  if (params.emissive != null) {
    const c = safeColor(typeof params.emissive === 'string' && !params.emissive.startsWith('#') ? `#${params.emissive}` : String(params.emissive))
    if (c) opts.emissive = c
  }
  if (params.opacity != null) {
    opts.opacity = clampN(params.opacity, 0, 1)
    opts.transparent = opts.opacity < 1
  }
  if (params.metalness != null) opts.metalness = clampN(params.metalness, 0, 1)
  if (params.roughness != null) opts.roughness = clampN(params.roughness, 0, 1)
  if (params.wireframe != null) opts.wireframe = !!params.wireframe
  if (params.flatShading != null) opts.flatShading = !!params.flatShading
  if (params.side != null) {
    opts.side = typeof params.side === 'string' ? (SIDE_MAP[params.side] ?? THREE.FrontSide) : clampN(params.side, 0, 2)
  }
  if (params.vertexColors != null) opts.vertexColors = !!params.vertexColors
  return opts
}

function buildNativeMaterial(type, params = {}) {
  const map = {
    MeshBasicMaterial: THREE.MeshBasicMaterial,
    MeshStandardMaterial: THREE.MeshStandardMaterial,
    MeshPhongMaterial: THREE.MeshPhongMaterial,
    MeshLambertMaterial: THREE.MeshLambertMaterial,
    MeshNormalMaterial: THREE.MeshNormalMaterial,
    MeshPhysicalMaterial: THREE.MeshPhysicalMaterial,
    MeshToonMaterial: THREE.MeshToonMaterial,
    MeshDepthMaterial: THREE.MeshDepthMaterial,
  }
  const Cls = map[type]
  if (!Cls) return null
  return new Cls(materialOptsFromParams(params))
}

function createGroup(editor, { name, position, parentId } = {}) {
  const group = new THREE.Group()
  group.name = String(name || 'Group').slice(0, 128)
  const pos = safeVec3(position) || [0, 0, 0]
  group.position.set(...pos)
  let parent = editor.scene
  if (parentId != null) {
    const p = find(editor.scene, parentId)
    if (!p) return { error: `未找到 parentId=${parentId}` }
    if (!isEditable(p)) return { error: `parentId=${parentId} 不可作为父节点` }
    parent = p
  }
  parent.add(group)
  editor.transformControls.attach(group)
  return { object: detail(group) }
}

function reparentObject(editor, { id, parentId }) {
  const { obj, error } = findEditable(editor.scene, id)
  if (error) return { error }
  let parent = editor.scene
  if (parentId != null) {
    const p = find(editor.scene, parentId)
    if (!p) return { error: `未找到 parentId=${parentId}` }
    if (!isEditable(p)) return { error: `parentId=${parentId} 不可作为父节点` }
    parent = p
  }
  parent.attach(obj)
  editor.transformControls.attach(obj)
  return { object: detail(obj), parentId: parent.id ?? null }
}

function cloneObject(editor, { id, name, position, parentId } = {}) {
  const { obj, error } = findEditable(editor.scene, id)
  if (error) return { error }
  const cloned = obj.clone(true)
  if (name) cloned.name = String(name).slice(0, 128)
  else cloned.name = `${obj.name || 'Object'}_copy`.slice(0, 128)
  if (obj.editorType === 'isInnerMesh') cloned.editorType = 'isInnerMesh'
  const pos = vec3Input(position)
  if (pos) cloned.position.set(...pos)
  let parent = obj.parent || editor.scene
  if (parentId != null) {
    const p = find(editor.scene, parentId)
    if (!p) return { error: `未找到 parentId=${parentId}` }
    if (!isEditable(p)) return { error: `parentId=${parentId} 不可作为父节点` }
    parent = p
  }
  parent.add(cloned)
  editor.transformControls.attach(cloned)
  return { object: detail(cloned), clonedFrom: id }
}

function lookAtObject(editor, { id, target, targetId }) {
  const { obj, error } = findEditable(editor.scene, id)
  if (error) return { error }
  const tp = new THREE.Vector3()
  if (targetId != null) {
    const t = find(editor.scene, targetId)
    if (!t) return { error: `未找到 targetId=${targetId}` }
    t.updateWorldMatrix(true, false)
    t.getWorldPosition(tp)
  } else {
    const t = vec3Input(target)
    if (!t) return { error: 'target 无效，需 [x,y,z] 或 targetId' }
    tp.set(...t)
  }
  obj.lookAt(tp)
  editor.transformControls.attach(obj)
  return { object: detail(obj) }
}

function setMaterial(editor, { id, meshName, materialType, ...rest }) {
  const { obj, error } = findEditable(editor.scene, id)
  if (error) return { error }
  const mesh = resolveMeshTarget(obj, meshName)
  if (!mesh?.isMesh) return { error: meshName ? `未找到子 mesh「${meshName}」` : '对象不是 Mesh，可传 meshName 指定子网格' }
  const params = { ...rest }
  if (materialType) {
    const mat = buildNativeMaterial(materialType, params)
    if (!mat) return { error: `未知材质类型「${materialType}」`, types: MATERIAL_TYPES }
    mesh.material = mat
  } else {
    const mats = [].concat(mesh.material)
    for (const m of mats) {
      const opts = materialOptsFromParams(params)
      if (opts.color && m.color) m.color.set(opts.color)
      if (opts.emissive && m.emissive) m.emissive.set(opts.emissive)
      if (opts.opacity != null) { m.opacity = opts.opacity; m.transparent = opts.transparent ?? m.opacity < 1 }
      if (opts.metalness != null && 'metalness' in m) m.metalness = opts.metalness
      if (opts.roughness != null && 'roughness' in m) m.roughness = opts.roughness
      if (opts.wireframe != null) m.wireframe = opts.wireframe
      if (opts.flatShading != null) m.flatShading = opts.flatShading
      if (opts.side != null) m.side = opts.side
      if (opts.vertexColors != null) m.vertexColors = opts.vertexColors
      m.needsUpdate = true
    }
  }
  editor.transformControls.attach(obj)
  return { object: detail(obj) }
}

function replaceGeometry(editor, { id, meshName, geometryType, params }) {
  const { obj, error } = findEditable(editor.scene, id)
  if (error) return { error }
  const mesh = resolveMeshTarget(obj, meshName)
  if (!mesh?.isMesh) return { error: meshName ? `未找到子 mesh「${meshName}」` : '对象不是 Mesh' }
  const geo = buildNativeGeometry(geometryType, params)
  if (!geo) return { error: `未知几何体「${geometryType}」`, types: GEOMETRY_TYPES }
  safeCall(() => mesh.geometry?.dispose(), 'disposeGeometry')
  mesh.geometry = geo
  editor.transformControls.attach(obj)
  return { object: detail(obj) }
}

// L2d · Three.js 原生（createMesh / setMaterial / 线点云 / 贴图 / 天空盒…）
async function createMesh(editor, { geometryType, geometryParams, materialType, materialParams, position, rotation, name, parentId, onGround, flat, flyTo }) {
  const geo = buildNativeGeometry(geometryType, geometryParams)
  if (!geo) return { error: `未知几何体「${geometryType}」`, types: GEOMETRY_TYPES }
  const matType = materialType || 'MeshStandardMaterial'
  const mat = buildNativeMaterial(matType, materialParams || { color: '#ffffff' })
  if (!mat) return { error: `未知材质「${matType}」`, types: MATERIAL_TYPES }
  const mesh = new THREE.Mesh(geo, mat)
  mesh.editorType = 'isInnerMesh'
  mesh.name = String(name || geometryType).slice(0, 128)
  const pos = safeVec3(position) || [0, 0, 0]
  mesh.position.set(...pos)
  if (rotation) {
    const rot = safeVec3(rotation, -3600, 3600)
    if (rot) mesh.rotation.set(...rot.map(d => d * Math.PI / 180))
  }
  let parent = editor.scene
  if (parentId != null) {
    const p = find(editor.scene, parentId)
    if (!p) return { error: `未找到 parentId=${parentId}` }
    if (!isEditable(p)) return { error: `parentId=${parentId} 不可作为父节点` }
    parent = p
  }
  parent.add(mesh)
  if (onGround || flat) {
    const res = placeOnGround(editor, { id: mesh.id, flat: !!flat || geometryType === 'PlaneGeometry' })
    if (res.error) return res
    editor.transformControls.attach(mesh)
    if (flyTo) await flyToObject(editor, mesh, 0.3)
    return { object: res.object, placed: { groundY: res.groundY, bottomY: res.bottomY } }
  }
  editor.transformControls.attach(mesh)
  if (flyTo) await flyToObject(editor, mesh, 0.3)
  return { object: detail(mesh) }
}

function addLine(editor, { points, color, name, closed, linewidth }) {
  if (!Array.isArray(points) || points.length < 2) return { error: 'points 至少 2 个点' }
  if (points.length > 500) return { error: 'points 最多 500 个' }
  const verts = []
  for (const p of points) {
    const v = vec3Input(p)
    if (!v) return { error: 'points 含无效坐标' }
    verts.push(...v)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
  const hex = safeColor(color?.startsWith?.('#') ? color : `#${color || 'ffffff'}`) || '#ffffff'
  const mat = new THREE.LineBasicMaterial({ color: hex, linewidth: clampN(linewidth ?? 1, 1, 10) })
  const line = closed && points.length >= 3 ? new THREE.LineLoop(geo, mat) : new THREE.Line(geo, mat)
  line.name = String(name || 'Line').slice(0, 128)
  line.editorType = 'isInnerMesh'
  editor.scene.add(line)
  editor.transformControls.attach(line)
  return { object: detail(line) }
}

function addPoints(editor, { points, color, size, name }) {
  if (!Array.isArray(points) || points.length < 1) return { error: 'points 至少 1 个点' }
  if (points.length > 5000) return { error: 'points 最多 5000 个' }
  const verts = []
  for (const p of points) {
    const v = vec3Input(p)
    if (!v) return { error: 'points 含无效坐标' }
    verts.push(...v)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
  const hex = safeColor(color?.startsWith?.('#') ? color : `#${color || 'ffffff'}`) || '#ffffff'
  const mat = new THREE.PointsMaterial({ color: hex, size: clampN(size ?? 0.1, 0.01, 50) })
  const pts = new THREE.Points(geo, mat)
  pts.name = String(name || 'Points').slice(0, 128)
  pts.editorType = 'isInnerMesh'
  editor.scene.add(pts)
  editor.transformControls.attach(pts)
  return { object: detail(pts) }
}

async function createBufferMesh(editor, { positions, indices, colors, materialType, materialParams, name, position, parentId, onGround, flat, flyTo }) {
  if (!Array.isArray(positions) || positions.length < 9) return { error: 'positions 至少 3 个顶点(9 个数)' }
  if (positions.length % 3 !== 0) return { error: 'positions 长度须为 3 的倍数' }
  if (positions.length > 15000) return { error: 'positions 最多 5000 顶点' }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  if (colors != null) {
    if (!Array.isArray(colors) || colors.length !== positions.length) return { error: 'colors 长度须与 positions 相同' }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  }
  if (indices != null) {
    if (!Array.isArray(indices) || !indices.length) return { error: 'indices 须为非空数组' }
    if (indices.length > 50000) return { error: 'indices 过多' }
    geo.setIndex(indices)
  }
  const matType = materialType || 'MeshStandardMaterial'
  const mat = buildNativeMaterial(matType, materialParams || { color: '#ffffff' })
  if (!mat) return { error: `未知材质「${matType}」`, types: MATERIAL_TYPES }
  const mesh = new THREE.Mesh(geo, mat)
  mesh.editorType = 'isInnerMesh'
  mesh.name = String(name || 'BufferMesh').slice(0, 128)
  mesh.position.set(...(safeVec3(position) || [0, 0, 0]))
  let parent = editor.scene
  if (parentId != null) {
    const p = find(editor.scene, parentId)
    if (!p) return { error: `未找到 parentId=${parentId}` }
    if (!isEditable(p)) return { error: `parentId=${parentId} 不可作为父节点` }
    parent = p
  }
  parent.add(mesh)
  if (onGround || flat) {
    const res = placeOnGround(editor, { id: mesh.id, flat: !!flat })
    if (res.error) return res
    editor.transformControls.attach(mesh)
    if (flyTo) await flyToObject(editor, mesh, 0.3)
    return { object: res.object, placed: { groundY: res.groundY, bottomY: res.bottomY }, vertexCount: positions.length / 3 }
  }
  editor.transformControls.attach(mesh)
  if (flyTo) await flyToObject(editor, mesh, 0.3)
  return { object: detail(mesh), vertexCount: positions.length / 3 }
}

function addSprite(editor, { text, textureUrl, position, color, fontSize, name }) {
  if (!text && !textureUrl) return { error: 'text 或 textureUrl 至少填一个' }
  const pos = safeVec3(position) || [0, 1, 0]
  if (textureUrl) {
    if (!textureUrl.startsWith('http')) return { error: 'textureUrl 需为 http(s) 地址' }
    return new Promise(resolve => {
      new THREE.TextureLoader().load(
        textureUrl,
        tex => {
          const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }))
          sprite.name = String(name || 'Sprite').slice(0, 128)
          sprite.position.set(...pos)
          attachObject(editor, sprite)
          resolve({ object: detail(sprite), textureUrl })
        },
        undefined,
        err => resolve({ error: `纹理加载失败: ${err?.message || textureUrl}` }),
      )
    })
  }
  const sprite = createSpriteText({ text: String(text).slice(0, 256), color, fontSize })
  sprite.name = String(name || String(text).slice(0, 16)).slice(0, 128)
  sprite.position.set(...pos)
  attachObject(editor, sprite)
  return { object: detail(sprite), text: String(text).slice(0, 64) }
}

async function createInstancedMesh(editor, { geometryType, geometryParams, materialType, materialParams, count, instances, name, position, parentId, flyTo }) {
  const n = clampN(count ?? 1, 1, MAX_INSTANCES)
  const geo = buildNativeGeometry(geometryType, geometryParams || {})
  if (!geo) return { error: `geometry 无效「${geometryType}」`, types: GEOMETRY_TYPES, hint: 'LatheGeometry/TubeGeometry 需 geometryParams.points' }
  const matType = materialType || 'MeshStandardMaterial'
  const mat = buildNativeMaterial(matType, materialParams || { color: '#ffffff' })
  if (!mat) return { error: `未知材质「${matType}」`, types: MATERIAL_TYPES }
  const mesh = new THREE.InstancedMesh(geo, mat, n)
  mesh.editorType = 'isInnerMesh'
  mesh.name = String(name || 'InstancedMesh').slice(0, 128)
  mesh.position.set(...(safeVec3(position) || [0, 0, 0]))
  const dummy = new THREE.Object3D()
  const list = Array.isArray(instances) ? instances.slice(0, n) : []
  for (let i = 0; i < n; i++) {
    const inst = list[i] || {}
    dummy.position.set(...(safeVec3(inst.position) || [0, 0, 0]))
    dummy.rotation.set(0, 0, 0)
    dummy.scale.set(1, 1, 1)
    if (inst.rotation) {
      const rot = safeVec3(inst.rotation, -3600, 3600)
      if (rot) dummy.rotation.set(...rot.map(d => d * Math.PI / 180))
    }
    if (inst.scale != null) {
      const s = safeScaleVec(Array.isArray(inst.scale) ? inst.scale : null)
      if (s) dummy.scale.set(...s)
      else if (typeof inst.scale === 'number') dummy.scale.setScalar(clampN(inst.scale, MIN_SCALE, MAX_SCALE))
    }
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
  }
  mesh.instanceMatrix.needsUpdate = true
  let parent = editor.scene
  if (parentId != null) {
    const p = find(editor.scene, parentId)
    if (!p) return { error: `未找到 parentId=${parentId}` }
    if (!isEditable(p)) return { error: `parentId=${parentId} 不可作为父节点` }
    parent = p
  }
  parent.add(mesh)
  editor.transformControls.attach(mesh)
  if (flyTo) await flyToObject(editor, mesh, 0.3)
  return { object: detail(mesh), count: n }
}

async function createLatheMesh(editor, { profile, segments, materialType, materialParams, name, position, parentId, onGround, flyTo }) {
  const geo = buildNativeGeometry('LatheGeometry', { points: profile, segments })
  if (!geo) return { error: 'profile 无效，需 [[x,y],...] 至少 2 点' }
  const mat = buildNativeMaterial(materialType || 'MeshStandardMaterial', materialParams || { color: '#ffffff' })
  if (!mat) return { error: '材质无效', types: MATERIAL_TYPES }
  const mesh = new THREE.Mesh(geo, mat)
  mesh.editorType = 'isInnerMesh'
  mesh.name = String(name || 'LatheMesh').slice(0, 128)
  mesh.position.set(...(safeVec3(position) || [0, 0, 0]))
  let parent = editor.scene
  if (parentId != null) {
    const p = find(editor.scene, parentId)
    if (!p) return { error: `未找到 parentId=${parentId}` }
    if (!isEditable(p)) return { error: `parentId=${parentId} 不可作为父节点` }
    parent = p
  }
  parent.add(mesh)
  if (onGround) {
    const res = placeOnGround(editor, { id: mesh.id })
    if (res.error) return res
    editor.transformControls.attach(mesh)
    if (flyTo) await flyToObject(editor, mesh, 0.3)
    return { object: res.object, placed: { groundY: res.groundY, bottomY: res.bottomY } }
  }
  editor.transformControls.attach(mesh)
  if (flyTo) await flyToObject(editor, mesh, 0.3)
  return { object: detail(mesh) }
}

async function addTubeMesh(editor, { points, radius, tubularSegments, radialSegments, materialType, materialParams, name, position, parentId, flyTo }) {
  const geo = buildNativeGeometry('TubeGeometry', { points, radius, tubularSegments, radialSegments })
  if (!geo) return { error: 'points 无效，需 [[x,y,z],...] 至少 2 点' }
  const mat = buildNativeMaterial(materialType || 'MeshStandardMaterial', materialParams || { color: '#ffffff' })
  if (!mat) return { error: '材质无效', types: MATERIAL_TYPES }
  const mesh = new THREE.Mesh(geo, mat)
  mesh.editorType = 'isInnerMesh'
  mesh.name = String(name || 'TubeMesh').slice(0, 128)
  mesh.position.set(...(safeVec3(position) || [0, 0, 0]))
  let parent = editor.scene
  if (parentId != null) {
    const p = find(editor.scene, parentId)
    if (!p) return { error: `未找到 parentId=${parentId}` }
    if (!isEditable(p)) return { error: `parentId=${parentId} 不可作为父节点` }
    parent = p
  }
  parent.add(mesh)
  editor.transformControls.attach(mesh)
  if (flyTo) await flyToObject(editor, mesh, 0.3)
  return { object: detail(mesh) }
}

function updateMeshGeometry(editor, { id, meshName, computeNormals, center, computeBounds }) {
  const { obj, error } = findEditable(editor.scene, id)
  if (error) return { error }
  const mesh = resolveMeshTarget(obj, meshName)
  if (!mesh?.geometry) return { error: meshName ? `未找到子 mesh「${meshName}」` : '对象无 geometry' }
  const geo = mesh.geometry
  const done = []
  if (computeNormals) { geo.computeVertexNormals(); done.push('normals') }
  if (center) { geo.center(); done.push('center') }
  if (computeBounds) { geo.computeBoundingBox(); geo.computeBoundingSphere(); done.push('bounds') }
  if (!done.length) return { error: '至少指定 computeNormals / center / computeBounds 之一' }
  editor.transformControls.attach(obj)
  return { id: obj.id, updated: done }
}

function addMeshWireframe(editor, { id, meshName, mode = 'edges', color, thresholdAngle, name }) {
  const { obj, error } = findEditable(editor.scene, id)
  if (error) return { error }
  const mesh = resolveMeshTarget(obj, meshName)
  if (!mesh?.geometry) return { error: meshName ? `未找到子 mesh「${meshName}」` : '对象无 geometry' }
  const hex = safeColor(color?.startsWith?.('#') ? color : `#${color || 'ffffff'}`) || '#ffffff'
  const geo = mode === 'wireframe'
    ? new THREE.WireframeGeometry(mesh.geometry)
    : new THREE.EdgesGeometry(mesh.geometry, clampN(thresholdAngle ?? 15, 1, 90))
  const line = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: hex }))
  line.name = String(name || `${mesh.name || 'Mesh'}_${mode}`).slice(0, 128)
  line.editorType = 'isInnerMesh'
  mesh.add(line)
  editor.transformControls.attach(obj)
  return { object: detail(line), parentId: mesh.id, mode }
}

function setSceneProps(editor, { background, fog }) {
  const scene = editor.scene
  const out = {}
  if (background !== undefined) {
    if (background === null || background === 'none') {
      scene.background = null
      out.background = null
    } else {
      const c = safeColor(typeof background === 'string' && !background.startsWith('#') ? `#${background}` : String(background))
      if (!c) return { error: 'background 无效，需 #rrggbb 或 null' }
      scene.background = new THREE.Color(c)
      out.background = c
    }
  }
  if (fog !== undefined) {
    if (fog === null || fog.type === 'none') {
      scene.fog = null
      out.fog = null
    } else {
      const fc = safeColor(typeof fog.color === 'string' && !fog.color?.startsWith('#') ? `#${fog.color}` : String(fog.color || '#cccccc'))
      if (!fc) return { error: 'fog.color 无效' }
      if (fog.type === 'FogExp2') {
        scene.fog = new THREE.FogExp2(fc, clampN(fog.density ?? 0.00025, 0, 0.01))
      } else {
        scene.fog = new THREE.Fog(fc, clampN(fog.near ?? 1, 0.01, 1e4), clampN(fog.far ?? 1000, 1, 1e6))
      }
      out.fog = { type: scene.fog.constructor.name, color: fc }
    }
  }
  return out
}

function applyTexture(editor, { id, url, map, meshName }) {
  const { obj, error } = findEditable(editor.scene, id)
  if (error) return { error }
  const channel = map || 'map'
  if (!TEXTURE_MAPS.includes(channel)) return { error: `不支持的 map: ${channel}`, allowed: TEXTURE_MAPS }
  const mesh = resolveMeshTarget(obj, meshName)
  if (!mesh?.material) return { error: meshName ? `未找到子 mesh「${meshName}」` : '对象无 material' }
  if (!url?.startsWith('http')) return { error: 'url 需为 http(s) 地址' }
  return new Promise(resolve => {
    new THREE.TextureLoader().load(
      url,
      tex => {
        [].concat(mesh.material).forEach(m => { m[channel] = tex; m.needsUpdate = true })
        editor.transformControls.attach(obj)
        resolve({ object: detail(obj), texture: { url, map: channel } })
      },
      undefined,
      err => resolve({ error: `纹理加载失败: ${err?.message || url}` }),
    )
  })
}

function setLightProps(editor, { id, target, castShadow, distance, angle, penumbra, decay, shadowBias, shadowMapSize }) {
  const { obj, error } = findEditable(editor.scene, id)
  if (error) return { error }
  if (!obj.isLight) return { error: '对象不是灯光，用 addLight 添加' }
  if (target && obj.target) {
    const t = vec3Input(target)
    if (!t) return { error: 'target 无效' }
    if (!obj.target.parent) editor.scene.add(obj.target)
    obj.target.position.set(...t)
  }
  if (castShadow != null) obj.castShadow = !!castShadow
  if (distance != null && 'distance' in obj) obj.distance = clampN(distance, 0, MAX_POS)
  if (angle != null && 'angle' in obj) obj.angle = clampN(angle, 0, Math.PI)
  if (penumbra != null && 'penumbra' in obj) obj.penumbra = clampN(penumbra, 0, 1)
  if (decay != null && 'decay' in obj) obj.decay = clampN(decay, 0, 10)
  if (shadowBias != null && obj.shadow) obj.shadow.bias = clampN(shadowBias, -0.01, 0.01)
  if (shadowMapSize != null && obj.shadow?.mapSize) {
    const s = clampN(shadowMapSize, 256, 4096)
    obj.shadow.mapSize.set(s, s)
  }
  editor.transformControls.attach(obj)
  return { object: detail(obj) }
}

function setSky(editor, name) {
  const set = SKIES.find(s => s.name === name)
  if (!set) return { error: '未知天空盒', names: SKIES.map(s => s.name) }
  if (!set.url) { editor.scene.background = null; return { sky: name } }
  editor.scene.setSceneBackground(Array.from({ length: 6 }, (_, i) => `${set.url}${i + 1}.png`))
  return { sky: name }
}

function setEnv(editor, name) {
  const set = SKIES.find(s => s.name === name && s.url)
  if (!set) return { error: '未知环境贴图', names: SKIES.filter(s => s.url).map(s => s.name) }
  editor.scene.setEnvBackground(Array.from({ length: 6 }, (_, i) => `${set.url}${i + 1}.png`))
  editor.scene.environmentEnabled = true
  return { env: name }
}

function refreshEditorGrid(editor) {
  const g = editor.handler?.helpers?.grid
  if (!g) return
  const scene = editor.scene
  if (g.gridHelper) {
    scene.remove(g.gridHelper)
    g.gridHelper.geometry?.dispose()
    const m = g.gridHelper.material
    ;[].concat(m).forEach(x => x?.dispose?.())
    g.gridHelper = null
  }
  if (g.showGrid) {
    g.gridHelper = new THREE.GridHelper(g.size, g.divisions, g.colorCenterLine ?? 0x444444, g.colorGrid ?? 0x888888)
    scene.add(g.gridHelper)
  }
}

function applyHelpersPatch(editor, { grid, axes, box3 } = {}) {
  const h = editor.handler?.helpers
  if (!h) return { error: '编辑器 helpers 未就绪' }
  let needGridRefresh = false
  const g = h.grid
  const ax = h.axes
  const b = h.box3
  if (grid && g) {
    if (grid.showGrid != null) { g.showGrid = !!grid.showGrid; if (g.showGrid) needGridRefresh = true }
    if (grid.size != null) { g.size = clampN(grid.size, 1, 10000); needGridRefresh = true }
    if (grid.divisions != null) { g.divisions = clampN(grid.divisions, 1, 200); needGridRefresh = true }
    if (grid.colorCenterLine != null) {
      const c = safeHexInt(grid.colorCenterLine)
      if (c != null) { g.colorCenterLine = c; needGridRefresh = true }
    }
    if (grid.colorGrid != null) {
      const c = safeHexInt(grid.colorGrid)
      if (c != null) { g.colorGrid = c; needGridRefresh = true }
    }
  }
  if (axes && ax) {
    if (axes.showAxes != null) ax.showAxes = !!axes.showAxes
    if (axes.axesLength != null) ax.axesLength = clampN(axes.axesLength, 1, 10000)
  }
  if (box3 && b) {
    if (box3.useBox3 != null) b.useBox3 = !!box3.useBox3
    if (box3.color != null) {
      const c = safeHexInt(box3.color)
      if (c != null) b.color = c
    }
  }
  if (needGridRefresh) safeCall(() => refreshEditorGrid(editor), 'refreshGrid')
  return null
}

function readHelpersSnapshot(editor) {
  const g = editor.handler?.helpers?.grid
  const ax = editor.handler?.helpers?.axes
  const b = editor.handler?.helpers?.box3
  return {
    grid: g?.showGrid ?? null,
    axes: ax?.showAxes ?? null,
    size: g?.size != null ? r(g.size) : null,
    divisions: g?.divisions ?? null,
    cellSize: g?.size && g?.divisions ? r(g.size / g.divisions) : null,
    colorCenterLine: g?.colorCenterLine ?? null,
    colorGrid: g?.colorGrid ?? null,
    axesLength: ax?.axesLength != null ? r(ax.axesLength) : null,
    useBox3: b?.useBox3 ?? null,
    box3Color: b?.color ?? null,
  }
}

function setHelpers(editor, input = {}) {
  const { grid, axes, size, divisions, colorCenterLine, colorGrid, axesLength, useBox3, box3Color } = input
  const helpers = {}
  if (grid != null || size != null || divisions != null || colorCenterLine != null || colorGrid != null) {
    helpers.grid = {}
    if (grid != null) helpers.grid.showGrid = !!grid
    if (size != null) helpers.grid.size = size
    if (divisions != null) helpers.grid.divisions = divisions
    if (colorCenterLine != null) helpers.grid.colorCenterLine = colorCenterLine
    if (colorGrid != null) helpers.grid.colorGrid = colorGrid
  }
  if (axes != null || axesLength != null) {
    helpers.axes = {}
    if (axes != null) helpers.axes.showAxes = !!axes
    if (axesLength != null) helpers.axes.axesLength = axesLength
  }
  if (useBox3 != null || box3Color != null) {
    helpers.box3 = {}
    if (useBox3 != null) helpers.box3.useBox3 = !!useBox3
    if (box3Color != null) helpers.box3.color = box3Color
  }
  const err = applyHelpersPatch(editor, helpers)
  if (err) return err
  return readHelpersSnapshot(editor)
}

const AI_ANIM = Symbol('aiAnim')

function listAnimInfo(model) {
  return model.animations.map((clip, index) => ({
    index,
    name: clip.name || `animation_${index}`,
    duration: r(clip.duration),
  }))
}

function ensureAnimationPlayParams(model) {
  if (!model.animations?.length) return null
  if (!model.animationPlayParams) {
    model.animationPlayParams = {
      initPlay: false, speed: 1, loop: false, startTime: 0,
      actionIndexs: new Array(model.animations.length).fill(false),
      frameCallback: () => {},
    }
  } else if (model.animationPlayParams.actionIndexs?.length !== model.animations.length) {
    model.animationPlayParams.actionIndexs = new Array(model.animations.length).fill(false)
  }
  return model.animationPlayParams
}

function readAnimationPlayParams(model) {
  if (!model?.animations?.length) return null
  const p = ensureAnimationPlayParams(model)
  return {
    initPlay: !!p.initPlay,
    speed: r(p.speed ?? 1),
    loop: !!p.loop,
    startTime: r(p.startTime ?? 0),
    clips: model.animations.map((clip, i) => ({
      index: i,
      name: clip.name || `animation_${i}`,
      duration: r(clip.duration),
      play: !!p.actionIndexs?.[i],
    })),
  }
}

function findAnimRoot(scene, id) {
  let node = id != null ? find(scene, id) : null
  while (node) {
    if (node.animations?.length) return node
    node = node.parent
  }
  return null
}

function resolveAnimIndices(model, { index, indices, name, names } = {}) {
  const n = model.animations.length
  const out = new Set()
  if (index != null && index >= 0 && index < n) out.add(index)
  indices?.forEach(i => { if (i >= 0 && i < n) out.add(i) })
  if (name != null) {
    const i = model.animations.findIndex(c => c.name === name)
    if (i >= 0) out.add(i)
  }
  names?.forEach(nm => {
    const i = model.animations.findIndex(c => c.name === nm)
    if (i >= 0) out.add(i)
  })
  return [...out]
}

function ensureAnimRuntime(editor, model) {
  let anim = model[AI_ANIM]
  if (anim) return anim
  const clock = new THREE.Clock()
  const mixer = new THREE.AnimationMixer(model)
  const tick = () => {
    const a = model[AI_ANIM]
    if (!a?.actions.length) return
    try { a.mixer.update(a.clock.getDelta()) } catch { /* skip */ }
  }
  editor.scene.addUpdateListener?.(tick)
  anim = { mixer, clock, actions: [], tick }
  model[AI_ANIM] = anim
  return anim
}

function syncAnimParams(model, indices, speed, loop, startTime, initPlay) {
  const p = ensureAnimationPlayParams(model)
  if (!p) return
  p.actionIndexs = model.animations.map((_, i) => indices.includes(i))
  if (speed != null) p.speed = clampN(speed, -10, 10)
  if (loop != null) p.loop = !!loop
  if (startTime != null) p.startTime = clampN(startTime, 0, 1e4)
  if (initPlay != null) p.initPlay = !!initPlay
}

function setAnimationPlayParams(editor, input) {
  const { id, initPlay, speed, loop, startTime, play, index, indices, name, names } = input
  const err = findEditable(editor.scene, id).error
  if (err) return { error: err }
  const model = findAnimRoot(editor.scene, id)
  if (!model) return { error: '该对象没有 GLB/FBX 自带动画' }
  const p = ensureAnimationPlayParams(model)
  if (speed != null) p.speed = clampN(speed, -10, 10)
  if (loop != null) p.loop = !!loop
  if (startTime != null) p.startTime = clampN(startTime, 0, 1e4)
  if (initPlay != null) p.initPlay = !!initPlay
  const hasPick = index != null || indices?.length || name || names?.length
  if (hasPick) {
    const resolved = resolveAnimIndices(model, { index, indices, name, names })
    p.actionIndexs = model.animations.map((_, i) => resolved.includes(i))
  }
  const shouldPlay = play === true || (p.initPlay && p.actionIndexs.some(Boolean))
  if (shouldPlay && p.actionIndexs.some(Boolean)) {
    const playRes = playModelAnimation(editor, {
      id: model.id,
      indices: p.actionIndexs.map((on, i) => on ? i : -1).filter(i => i >= 0),
      speed: p.speed, loop: p.loop, startTime: p.startTime,
    })
    if (playRes.error) return playRes
    return { id: model.id, animationPlay: readAnimationPlayParams(model), playing: playRes.playing }
  }
  return { id: model.id, animationPlay: readAnimationPlayParams(model) }
}

// L2e · GLB/FBX 模型动画
function listAnimations(editor, id) {
  if (id != null) {
    const model = findAnimRoot(editor.scene, id)
    if (!model) return { error: `id=${id} 没有自带动画`, hint: '不传 id 可扫描整个场景' }
    return { id: model.id, name: model.name || '(未命名)', animations: listAnimInfo(model), animationPlay: readAnimationPlayParams(model) }
  }
  const models = []
  editor.scene.traverse(o => {
    if (!o.animations?.length || models.some(m => m.id === o.id)) return
    models.push({ id: o.id, name: o.name || '(未命名)', animations: listAnimInfo(o), animationPlay: readAnimationPlayParams(o) })
  })
  return { models }
}

function playModelAnimation(editor, { id, index, indices, name, names, loop = true, speed = 1, startTime = 0 }) {
  const err = findEditable(editor.scene, id).error
  if (err) return { error: err }
  const model = findAnimRoot(editor.scene, id)
  if (!model) return { error: '该对象没有 GLB/FBX 自带动画', hint: '先用 listAnimations 查看' }
  const resolved = resolveAnimIndices(model, { index, indices, name, names })
  if (!resolved.length) {
    return { error: '未指定有效动画', animations: listAnimInfo(model), hint: '用 index/indices 或 name/names' }
  }
  const spd = clampN(speed, -10, 10)
  const st = clampN(startTime, 0, 1e4)
  const anim = ensureAnimRuntime(editor, model)
  anim.actions.forEach(a => { try { a.stop() } catch {} })
  anim.actions = []
  const playing = []
  const infos = listAnimInfo(model)
  for (const i of resolved) {
    const clip = model.animations[i]
    if (!clip) continue
    try {
      const action = anim.mixer.clipAction(clip)
      action.loop = loop ? THREE.LoopRepeat : THREE.LoopOnce
      action.clampWhenFinished = !loop
      action.timeScale = spd
      action.time = st
      action.play()
      anim.actions.push(action)
      playing.push(infos[i])
    } catch { /* skip bad clip */ }
  }
  if (!playing.length) return { error: '动画播放失败' }
  syncAnimParams(model, resolved, spd, loop, st, true)
  return { id: model.id, playing, loop: !!loop, speed: spd, animationPlay: readAnimationPlayParams(model) }
}

function stopModelAnimation(editor, { id }) {
  const err = findEditable(editor.scene, id).error
  if (err) return { error: err }
  const model = findAnimRoot(editor.scene, id)
  if (!model) return { error: `id=${id} 没有动画可停止` }
  const anim = model[AI_ANIM]
  if (anim) {
    anim.actions.forEach(a => { try { a.stop() } catch {} })
    anim.actions = []
  }
  syncAnimParams(model, [], 1, false, 0, false)
  return { id: model.id, stopped: true, animationPlay: readAnimationPlayParams(model) }
}

// L2f · 编辑器配置 · GUI 面板 · 导出截图
export function getEditorSettings(editor) {
  const saved = editor.saveSceneEdit?.()
  if (!saved) return { error: '编辑器未就绪' }
  const out = {}
  for (const k of EDITOR_SETTING_KEYS) if (saved[k]) out[k] = saved[k]
  return out
}

function patchSceneSettings(scene, p) {
  if (p.backgroundBlurriness != null) scene.backgroundBlurriness = clampN(p.backgroundBlurriness, 0, 1)
  if (p.backgroundIntensity != null) scene.backgroundIntensity = clampN(p.backgroundIntensity, 0, 10)
  if (p.environmentEnabled != null) scene.environmentEnabled = !!p.environmentEnabled
}

function patchCameraSettings(cam, p) {
  if (p.fov != null) cam.fov = clampN(p.fov, 1, 179)
  if (p.near != null) cam.near = clampN(p.near, 0.001, 1000)
  if (p.far != null) cam.far = clampN(p.far, 1, 1e7)
  if (cam.near >= cam.far) return { error: 'perspectiveCamera: near 必须小于 far' }
  if (p.zoom != null) cam.zoom = clampN(p.zoom, 0.01, 10)
  if (p.filmOffset != null) cam.filmOffset = clampN(p.filmOffset, -10, 10)
  if (p.filmGauge != null) cam.filmGauge = clampN(p.filmGauge, 1, 100)
  if (p.position) {
    const pos = vec3Input(p.position)
    if (!pos) return { error: 'perspectiveCamera.position 无效' }
    cam.position.set(...pos)
  }
  safeCall(() => cam.updateProjectionMatrix?.(), 'updateProjectionMatrix')
  return null
}

function patchRendererSettings(r, p) {
  if (p.outputColorSpace != null) {
    if (!OUTPUT_COLOR_SPACES.has(p.outputColorSpace)) return { error: `webglRenderer.outputColorSpace 无效: ${p.outputColorSpace}` }
    r.outputColorSpace = p.outputColorSpace
  }
  if (p.toneMapping != null) r.toneMapping = clampN(p.toneMapping, 0, 7)
  if (p.toneMappingExposure != null) r.toneMappingExposure = clampN(p.toneMappingExposure, 0, 10)
  if (p.color != null) {
    const c = safeHexInt(p.color)
    if (c != null) r.setClearColor?.(c, r.getClearAlpha?.() ?? 0)
  }
  if (p.opacity != null) r.setClearAlpha?.(clampN(p.opacity, 0, 1))
  if (p.shadowMap) {
    if (p.shadowMap.enabled != null) r.shadowMap.enabled = !!p.shadowMap.enabled
    if (p.shadowMap.type != null) r.shadowMap.type = clampN(p.shadowMap.type, 0, 2)
  }
  if (p.sortObjects != null) r.sortObjects = !!p.sortObjects
  if (p.localClippingEnabled != null) r.localClippingEnabled = !!p.localClippingEnabled
  if (p.autoClear != null) r.autoClear = !!p.autoClear
  if (p.autoClearColor != null) r.autoClearColor = !!p.autoClearColor
  p.renderListCompare?.forEach(item => {
    if (!RENDER_LIST_NAMES.has(item.name)) return
    const hit = r.renderListCompare?.find(x => x.name === item.name)
    if (hit && item.enabled != null) hit.enabled = !!item.enabled
  })
  safeCall(() => r.refreshRenderList?.(), 'refreshRenderList')
  return null
}

function patchControlsSettings(c, p) {
  const setB = (k) => { if (p[k] != null) c[k] = !!p[k] }
  const setN = (k, lo, hi) => { if (p[k] != null) c[k] = clampN(p[k], lo, hi) }
  setB('autoRotate'); setN('autoRotateSpeed', 0, 30)
  setB('enableDamping'); setN('dampingFactor', 0, 1)
  setN('minDistance', 0, MAX_POS); setN('maxDistance', 0, MAX_POS)
  if (p.maxAzimuthAngle != null) c.maxAzimuthAngle = clampN(p.maxAzimuthAngle, -Math.PI * 4, Math.PI * 4)
  if (p.minAzimuthAngle != null) c.minAzimuthAngle = clampN(p.minAzimuthAngle, -Math.PI * 4, Math.PI * 4)
  setN('maxPolarAngle', 0, Math.PI * 2); setN('minPolarAngle', 0, Math.PI * 2)
  setN('maxTargetRadius', 0, MAX_POS); setN('minTargetRadius', 0, MAX_POS)
  setB('enablePan'); setN('panSpeed', 0, 10)
  setB('enableRotate'); setN('rotateSpeed', 0, 10)
  setB('enableZoom'); setN('zoomSpeed', 0, 10)
  setB('zoomToCursor')
  if (p.target) {
    const t = vec3Input(p.target)
    if (!t) return { error: 'orbitControls.target 无效' }
    c.target.set(...t)
  }
  safeCall(() => c.update?.(), 'controls.update')
  return null
}

function patchTransformControlsSettings(tc, p) {
  if (p.mode != null) {
    if (!TC_MODES.has(p.mode)) return { error: `transformControls.mode 无效: ${p.mode}` }
    tc.mode = p.mode
  }
  if (p.space != null) {
    if (!TC_SPACES.has(p.space)) return { error: `transformControls.space 无效: ${p.space}` }
    tc.space = p.space
  }
  if (p.size != null) tc.size = clampN(p.size, 0.1, 5)
  if (p.showX != null) tc.showX = !!p.showX
  if (p.showY != null) tc.showY = !!p.showY
  if (p.showZ != null) tc.showZ = !!p.showZ
  if ('translationSnap' in p) tc.translationSnap = p.translationSnap === null ? null : clampN(p.translationSnap, 0, 100)
  if ('rotationSnap' in p) tc.rotationSnap = p.rotationSnap === null ? null : clampN(p.rotationSnap, 0, Math.PI)
  if ('scaleSnap' in p) tc.scaleSnap = p.scaleSnap === null ? null : clampN(p.scaleSnap, 0, 10)
  return null
}

function patchHandlerSettings(editor, p) {
  const h = editor.handler
  if (!h) return { error: '编辑器 handler 未就绪' }
  if (p.mode != null) {
    if (!HANDLER_MODES.has(p.mode)) return { error: `handler.mode 无效: ${p.mode}` }
    h.mode = p.mode
  }
  if (p.selectChildEnabled != null) h.selectChildEnabled = !!p.selectChildEnabled
  if (p.selectChildLevel != null) h.selectChildLevel = clampN(p.selectChildLevel, 1, 10)
  if (p.stats) {
    if (p.stats.showStats != null) h.stats.showStats = !!p.stats.showStats
    if (p.stats.statsMode != null) h.stats.statsMode = clampN(p.stats.statsMode, 0, 2)
  }
  if (p.helpers) {
    const err = applyHelpersPatch(editor, p.helpers)
    if (err) return err
  }
  return null
}

function patchOtherSettings(editor, p) {
  const other = editor.other
  if (!other) return { error: '编辑器 other 未就绪' }
  if (p.clipping?.size != null) {
    if (!other.clipping) other.clipping = { size: 20, clipList: [] }
    other.clipping.size = clampN(p.clipping.size, 0.1, 1000)
  }
  return null
}

function patchEffectComposerSettings(ec, p) {
  const skipped = []
  if (p.renderWay != null) {
    if (!RENDER_WAYS.has(p.renderWay)) {
      skipped.push(`renderWay:${p.renderWay}`)
    } else {
      ec.renderWay = p.renderWay
    }
  }
  const ep = ec?.effectPass
  if (!ep) return skipped
  for (const [key, val] of Object.entries(p)) {
    if (key === 'renderWay' || val == null || typeof val !== 'object') continue
    if (!EFFECT_PASS_KEYS.has(key)) { skipped.push(key); continue }
    const pass = ep[key]
    if (!pass) { skipped.push(key); continue }
    try {
      if (val.enabled != null) pass.enabled = !!val.enabled
      if (val.order != null) pass.order = clampN(val.order, 0, 100)
      pass.originInfo?.setStorage?.(pass, val)
    } catch { skipped.push(key) }
  }
  safeCall(() => ec.refreshPassSort?.(), 'refreshPassSort')
  return skipped
}

function setEditorSettings(editor, input) {
  const keys = Object.keys(input)
  const unknown = keys.filter(k => !EDITOR_SETTING_KEYS.includes(k))
  if (unknown.length) return { error: `未知配置段: ${unknown.join(', ')}`, allowed: EDITOR_SETTING_KEYS }
  if (!keys.length) return { error: '未提供任何配置' }

  if (input.scene) patchSceneSettings(editor.scene, input.scene)
  let err = input.perspectiveCamera ? patchCameraSettings(editor.camera, input.perspectiveCamera) : null
  if (err) return err
  err = input.webglRenderer ? patchRendererSettings(editor.renderer, input.webglRenderer) : null
  if (err) return err
  err = input.orbitControls ? patchControlsSettings(editor.controls, input.orbitControls) : null
  if (err) return err
  err = input.transformControls ? patchTransformControlsSettings(editor.transformControls, input.transformControls) : null
  if (err) return err
  err = input.handler ? patchHandlerSettings(editor, input.handler) : null
  if (err) return err
  err = input.other ? patchOtherSettings(editor, input.other) : null
  if (err) return err
  const passSkipped = input.effectComposer
    ? patchEffectComposerSettings(editor.effectComposer, input.effectComposer)
    : []
  const result = getEditorSettings(editor)
  if (passSkipped.length) result.passSkipped = passSkipped
  return result
}

// ── ThreeEditor / lib API ──

export function getEditorApi(editor) {
  const hh = editor.handler?.handlerHistory
  const r = editor.renderer
  const actionInfo = listEditorActions(editor)
  const blendShader = getBlendShaderCapability(editor)
  return {
    threeEditor: {
      core: ['scene', 'camera', 'renderer', 'controls', 'transformControls', 'effectComposer', 'css3DRender', 'css2DRender', 'stats', 'DOM'],
      methods: ['saveSceneEdit', 'resetEditorStorage', 'openControlPanel', 'getSceneEditorImage', 'getSceneEvent', 'setOutlinePass', 'setCss2dDOM', 'setCss3dDOM', 'renderSceneResize'],
      cores: ['modelCores', 'shaderCores', 'handler', 'other', 'innerCores', 'lightCores', 'drawCores', 'textCores', 'particleCores', 'designCores'].filter(k => editor[k]),
      panelApi: {
        basic: BASIC_PANELS,
        object: Object.entries(OBJECT_PANELS).map(([key, name]) => ({ key, name })),
      },
    },
    lib: {
      exports: ['getObjectViews', 'getObjectBox3', 'createGsapAnimation', 'restoreHistoryHandler', 'getMaterials', 'objectChangeTransform', 'cloneObjectMaterial', 'createSpriteText', 'setGsapMeshAction'],
      usedByAi: ['getObjectViews', 'createGsapAnimation', 'restoreHistoryHandler', 'getObjectBox3', 'getMaterials', 'createSpriteText', 'setGsapMeshAction'],
    },
    sceneApi: {
      attach_add: 'scene.attach_add(obj) = add + transformControls.attach，与 GUI 一致',
      setSceneBackground: '六面 skybox；runEditorAction setSceneSkybox 或 setSky',
      setEnvBackground: 'IBL 环境；runEditorAction setSceneEnvironment 或 setEnv',
    },
    threeJsNative: {
      tools: NATIVE_TOOL_NAMES,
      lightTypes: NATIVE_LIGHT_TYPES,
      geometries: GEOMETRY_TYPES,
      materials: MATERIAL_TYPES,
      hint: 'listCatalog.threeJs 查类名；原生优先于 runEditorAction',
    },
    tools: {
      openControlBoard: 'openEditorPanel({ openMain: true })',
      openRendererPanel: 'openEditorPanel({ panel: "渲染配置" })',
      openCorePanel: 'runEditorAction({ action: "openCorePanel", params: { panel: "textCores" } })',
      openTheatrePanel: 'runEditorAction({ action: "openOtherPanel", params: { panel: "编辑动画" } })',
      innerMesh: 'addMesh(中文几何) 或 runEditorAction addInnerMesh(geometryType 类名)',
      blendShader: 'runEditorAction listBlendShaders → applyBlendShader({ id, shaderName })',
      coreModelLoad: 'addModel 或 runEditorAction loadOnlineModel（modelCores + attach_add）',
      anyCapability: 'listEditorActions → runEditorAction({ action, params })',
      changeRendererValues: 'setEditorSettings({ webglRenderer: {...} })',
      undo: 'undoEditor()',
      save: 'saveEditorScene()',
      screenshot: 'captureScreenshot({ download: true })',
    },
    actionCatalog: `listEditorActions 共 ${actionInfo.total} 个 runEditorAction，可用 ${actionInfo.available} 个`,
    actionSupport: {
      total: actionInfo.total,
      available: actionInfo.available,
      requirementCoverage: actionInfo.requirementCoverage,
      unsupported: actionInfo.actions.filter(a => !a.supported).map(a => ({ name: a.name, missing: a.missing || [] })),
    },
    blendShader,
    runtime: {
      selectedId: editor.transformControls?.object?.id ?? null,
      handlerMode: editor.handler?.mode ?? null,
      transformMode: editor.transformControls?.mode ?? null,
      guiReady: !!editor.GUI,
      guiFolders: editor.GUI?.children?.map(f => f._title).filter(Boolean) ?? [],
      renderer: r ? {
        shadowMap: !!r.shadowMap?.enabled,
        toneMapping: r.toneMapping,
        toneMappingExposure: r.toneMappingExposure,
        outputColorSpace: r.outputColorSpace,
      } : null,
      history: hh ? { undoStack: hh.list?.length ?? 0, redoStack: hh.reList?.length ?? 0, index: hh.index } : null,
      sceneName: localStorage.getItem('new_sceneName') || null,
    },
    settingsSections: EDITOR_SETTING_KEYS,
  }
}

export function openEditorPanel(editor, { panel, openMain = true } = {}) {
  if (!editor.GUI) return { error: '编辑器 GUI 未就绪' }
  if (openMain && editor.GUI.children.length <= 1) editor.openControlPanel?.()
  if (!panel) {
    return {
      opened: openMain ? '控制板(操作/场景/核心/其他)' : null,
      basicPanels: BASIC_PANELS,
      hint: '传 panel:"渲染配置" 打开渲染器配置浮动窗；改数值也可用 setEditorSettings',
    }
  }
  const api = editor.panelApi?.basicPanelApi
  if (!api) return { error: 'panelApi 不可用' }
  const openers = {
    '渲染配置': () => api.setWebGLRendererPanel(editor.renderer, editor.GUI.addDragFolder('渲染配置')),
    '相机配置': () => api.setPerspectiveCameraPanel(editor.camera, editor.GUI.addDragFolder('相机配置')),
    '轨道配置': () => api.setOrbitControlsPanel(editor.controls, editor.GUI.addDragFolder('轨道配置')),
    '变换配置': () => api.setTransformControlsPanel(editor.transformControls, editor.GUI.addDragFolder('变换配置')),
    '环境配置': () => api.setScenePanel(editor.scene, editor.GUI.addDragFolder('环境配置')),
    '后期处理': () => api.setEffectComposerPanel(editor.effectComposer, editor.GUI.addDragFolder('后期处理')),
  }
  const open = openers[panel]
  if (!open) return { error: `未知 panel「${panel}」`, panels: BASIC_PANELS }
  open()
  return { opened: panel, type: 'floating_gui' }
}

function openObjectPanel(editor, { id, panel = 'materialConf' }) {
  const { obj, error } = findEditable(editor.scene, id)
  if (error) return { error }
  if (!OBJECT_PANELS[panel]) return { error: `未知 panel「${panel}」`, panels: Object.keys(OBJECT_PANELS) }
  if (!editor.handler?.setActivePanel) return { error: 'setActivePanel 不可用' }
  if (!editor.GUI) return { error: 'GUI 未就绪' }
  if (editor.GUI.children.length <= 1) editor.openControlPanel?.()
  editor.transformControls.attach(obj)
  editor.handler.setActivePanel({}, { key: panel })
  return { opened: OBJECT_PANELS[panel], panel, id: obj.id, name: obj.name || '(未命名)' }
}

function undoEditor(editor) {
  const hh = editor.handler?.handlerHistory
  if (!hh) return { error: '撤销栈不可用' }
  const idx = hh.index
  restoreHistoryHandler(hh, 'z')
  return { undone: hh.index !== idx, index: hh.index, undoStack: hh.list?.length ?? 0 }
}

function redoEditor(editor) {
  const hh = editor.handler?.handlerHistory
  if (!hh) return { error: '重做栈不可用' }
  const idx = hh.index
  restoreHistoryHandler(hh, 'y')
  return { redone: hh.index !== idx, index: hh.index, redoStack: hh.reList?.length ?? 0 }
}

function saveEditorScene(editor, { sceneName } = {}) {
  const data = editor.saveSceneEdit?.()
  if (!data) return { error: 'saveSceneEdit 不可用' }
  const name = String(sceneName || localStorage.getItem('new_sceneName') || '三维测试').slice(0, 64)
  localStorage.setItem(`${name}-newEditor`, JSON.stringify(data))
  localStorage.setItem('new_sceneName', name)
  return { saved: name }
}

function exportSceneJson(editor, { download = true, sceneName } = {}) {
  const data = editor.saveSceneEdit?.()
  if (!data) return { error: 'saveSceneEdit 不可用' }
  const name = sceneName || localStorage.getItem('new_sceneName') || '场景'
  if (download) {
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${name}.json`
    link.click()
    URL.revokeObjectURL(link.href)
  }
  return { exported: name, keys: Object.keys(data), downloaded: download }
}

function exportSceneGlb(editor, { sceneName } = {}) {
  const exportObjects = []
  editor.scene.children.forEach(child => {
    if (
      child.isTransformControls || child.type === 'TransformControls' || child.type === 'TransformControlsPlane'
      || child.isHelper || child.type.includes('Helper') || !child.visible
    ) return
    if ((child.isMesh || child.isGroup || child.isObject3D || child.isLine) && !child.isLight && !child.isPoints) {
      exportObjects.push(child)
    }
  })
  if (!exportObjects.length) return { error: '场景中没有可导出的模型' }
  const exportScene = new THREE.Scene()
  exportObjects.forEach(obj => exportScene.add(obj.clone(true)))
  const name = sceneName || localStorage.getItem('new_sceneName') || '场景'
  return new Promise(resolve => {
    new GLTFExporter().parse(
      exportScene,
      result => {
        const blob = new Blob([result instanceof ArrayBuffer ? result : JSON.stringify(result)], {
          type: result instanceof ArrayBuffer ? 'model/gltf-binary' : 'model/gltf+json',
        })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `${name}.glb`
        link.click()
        URL.revokeObjectURL(link.href)
        resolve({ exported: `${name}.glb`, objectCount: exportObjects.length })
      },
      err => resolve({ error: `GLB 导出失败: ${err?.message || String(err)}` }),
      { binary: true, embedImages: true },
    )
  })
}

function captureScreenshot(editor, { download = true, quality = 0.8 } = {}) {
  const base64 = editor.getSceneEditorImage?.(['image/png', String(clampN(quality, 0.1, 1))])
  if (!base64) return { error: 'getSceneEditorImage 不可用' }
  const name = localStorage.getItem('new_sceneName') || '场景'
  if (download) {
    const link = document.createElement('a')
    link.href = base64
    link.download = `${name}.png`
    link.click()
  }
  return { captured: true, downloaded: download, format: 'png' }
}

function setEditorMode(editor, { handlerMode, transformMode, preview } = {}) {
  const h = editor.handler
  const tc = editor.transformControls
  if (!h || !tc) return { error: 'handler/transformControls 未就绪' }
  if (handlerMode != null) {
    if (!HANDLER_MODES.has(handlerMode)) return { error: `handlerMode 无效: ${handlerMode}`, allowed: [...HANDLER_MODES] }
    h.mode = handlerMode
  }
  if (transformMode != null) {
    if (!TC_MODES.has(transformMode)) return { error: `transformMode 无效: ${transformMode}`, allowed: [...TC_MODES] }
    tc.setMode(transformMode)
    if (h.mode !== 'transform' && h.mode !== 'select' && h.mode !== 'none') h.mode = 'transform'
    else if (transformMode && h.mode === 'none') h.mode = 'transform'
  }
  if (preview != null) {
    h.mode = preview ? 'none' : (transformMode ? 'transform' : h.mode === 'none' ? 'transform' : h.mode)
  }
  return { handlerMode: h.mode, transformMode: tc.mode, preview: preview ?? undefined }
}

function getObjectMaterials(editor, { id }) {
  const o = find(editor.scene, id)
  if (!o) return { error: `未找到 id=${id}` }
  const mats = getMaterials(o)
  const list = mats.map((m, i) => ({
    index: i,
    type: m?.type,
    color: m?.color ? `#${m.color.getHexString()}` : undefined,
    opacity: m?.opacity != null ? r(m.opacity) : undefined,
    wireframe: m?.wireframe,
  }))
  return { id, name: o.name || '(未命名)', count: list.length, materials: list }
}

function getObjectBox3Info(editor, { id }) {
  const o = find(editor.scene, id)
  if (!o) return { error: `未找到 id=${id}` }
  const b = getObjectBox3(o)
  return {
    id, name: o.name || '(未命名)',
    center: v3(b.center), radius: r(b.radius),
    min: v3(b.min), max: v3(b.max),
  }
}

// L2g · 场景查询 · 编排（listResources / inspectScene / buildScene）
const vec3 = z.tuple([z.number(), z.number(), z.number()]).optional()
const vec3req = z.tuple([z.number(), z.number(), z.number()])
const profile2d = z.array(z.tuple([z.number(), z.number()])).min(2).max(MAX_CURVE_POINTS)
const path3d = z.array(vec3req).min(2).max(MAX_CURVE_POINTS)
const geoParams = z.record(z.string(), z.union([z.number(), z.array(z.union([z.number(), z.array(z.number())]))])).optional()
const matParams = z.object({
  color: z.string().optional(), emissive: z.string().optional(),
  opacity: z.number().min(0).max(1).optional(),
  metalness: z.number().min(0).max(1).optional(),
  roughness: z.number().min(0).max(1).optional(),
  wireframe: z.boolean().optional(),
  flatShading: z.boolean().optional(),
  vertexColors: z.boolean().optional(),
  side: z.union([z.enum(['FrontSide', 'BackSide', 'DoubleSide']), z.number().int().min(0).max(2)]).optional(),
}).optional()
const vec3flex = z.union([
  z.tuple([z.number(), z.number(), z.number()]),
  z.object({ x: z.number(), y: z.number(), z: z.number() }),
]).optional()
const hexColor = z.union([z.number(), z.string()])
const passPatch = z.object({
  enabled: z.boolean().optional(),
  order: z.number().optional(),
}).catchall(z.union([z.number(), z.boolean(), z.string()]))

function matchObjectFilter(o, { name, type, lightsOnly, designType } = {}) {
  if (lightsOnly && !o.isLight) return false
  if (name && !(o.name || '').includes(name)) return false
  if (designType && o.designType !== designType && !(o.name || '').includes(designType)) return false
  if (type) {
    const t = o.designType || o.type
    if (t !== type && o.type !== type && o.editorType !== type) return false
  }
  return true
}

function collectObjects(editor, opts = {}) {
  const { deep, name, type, lightsOnly, designType } = typeof opts === 'boolean' ? { deep: opts } : opts
  const raw = deep
    ? (() => { const out = []; editor.scene.traverse(o => { if (isObj(o)) out.push(o) }); return out })()
    : editor.scene.children.filter(isObj)
  return raw.filter(o => matchObjectFilter(o, { name, type, lightsOnly, designType }))
}

function summarizeObjects(raw) {
  const s = { total: raw.length, floors: 0, lights: 0, designs: 0, models: 0, meshes: 0, byRole: {}, byCategory: {} }
  for (const o of raw) {
    if (isFloorLike(o)) s.floors++
    else if (o.isLight) s.lights++
    else if (o.designType) s.designs++
    else if (o.animations?.length) s.models++
    else if (o.editorType === 'isInnerMesh') s.meshes++
    const cls = classifySceneObject(o)
    s.byRole[cls.role] = (s.byRole[cls.role] || 0) + 1
    s.byCategory[cls.category] = (s.byCategory[cls.category] || 0) + 1
  }
  return s
}

function buildElementCatalog(full = false) {
  const designs = ThreeEditor.__DESIGNS__ || []
  const byCategory = {}
  const components = designs.map(d => {
    const meta = getComponentMeta(d)
    if (!byCategory[meta.category]) byCategory[meta.category] = { label: meta.categoryLabel, items: [] }
    byCategory[meta.category].items.push(full ? meta : meta.label)
    return full ? meta : meta.label
  })
  const base = {
    count: designs.length,
    meshUsage: MESH_USAGE,
    objectTypes: OBJECT_TYPES_GUIDE,
    componentGuide: '流程：listResources({ label }) 了解 looksLike → addComponent 添加尝试 → editObject 微调',
    categories: Object.fromEntries(
      Object.entries(byCategory).map(([id, v]) => [id, { label: v.label, items: v.items }]),
    ),
  }
  if (!full) return base
  return { ...base, components }
}

export function listResources(editor, { label, query } = {}) {
  if (label) return buildComponentDetail(editor, label)
  if (query) return searchComponents(query)
  const cat = buildElementCatalog(false)
  const allModels = listModels()
  const shaderBlend = getBlendShaderCapability(editor)
  return {
    meshes: Object.keys(MESH_USAGE),
    lights: LIGHT_TYPES,
    components: cat.categories,
    modelCount: allModels.length,
    models: allModels.map(m => m.name),
    skies: SKIES.map(s => s.name),
    palettes: COLOR_PALETTES.map(p => p.name),
    advancedTools: [...NATIVE_TOOL_NAMES.slice(0, 14), 'runEditorAction', 'listEditorActions'],
    shaderBlend: {
      supported: shaderBlend.supported,
      shaders: shaderBlend.shaders.slice(0, 20),
      ...(shaderBlend.supported ? {} : { missing: shaderBlend.missing }),
      actions: ['listBlendShaders', 'applyBlendShader'],
    },
    tips: {
      component: '流程：listResources({ label }) → addComponent → editObject；简单几何用 addMesh',
      model: '优先使用编辑器本地模型：listResources 或 listResources({ query }) 找名称，然后 addModel({ urlOrName })',
      mesh: 'addMesh + editObject；立方体/球/柱/平面见 meshUsage',
      scene: 'buildScene 一键搭建（含阴影+运镜）',
      shadows: SHADOW_GUIDE,
      search: 'listResources({ query }) 同时搜索组件与模型；组件需先 listResources({ label }) 再 addComponent',
      edit: EDIT_WORKFLOW,
      advanced: 'runAdvanced({ tool, input })；混合着色器用 runEditorAction(listBlendShaders/applyBlendShader)',
    },
  }
}

export function getLiveContext(editor) {
  if (!editor?.scene) return { ready: false }
  const raw = collectObjects(editor, {})
  const summary = summarizeObjects(raw)
  const ground = detectGroundSurface(editor)
  const sel = editor.transformControls?.object
  const selected = sel && !isProtected(sel)
    ? { id: sel.id, name: sel.name || '(未命名)', role: classifySceneObject(sel).role, line: snapshotLine(sel) }
    : null
  const snapshot = raw.slice(0, 8).map(snapshotLine)
  const shadowsOn = !!editor.renderer?.shadowMap?.enabled
  const colors = getSceneColorContext(editor)
  const cam = editor.camera?.position
  const cameraAt = cam ? v3(cam) : null
  const hints = []
  if (!shadowsOn && summary.total >= 2) hints.push('要阴影用 enableShadows()，勿用 setEnvironment')
  if (summary.total > 12) hints.push('对象偏多，优先微调现有物体')
  if ((summary.byRole?.component || 0) > 4) hints.push('组件多，改外观用 params/uniforms')
  if (summary.total > 0) hints.push('看不清时 focusCamera() 框选全场景')
  return { ready: true, count: summary.total, groundY: ground.y, roles: summary.byRole, selected, snapshot, shadowsOn, colors, cameraAt, hints }
}

export async function buildScene(editor, { palette: paletteName } = {}) {
  const palette = (paletteName && COLOR_PALETTES.find(p => p.name === paletteName))
    || COLOR_PALETTES[Math.floor(Math.random() * COLOR_PALETTES.length)]
  const created = []

  const ground = await addMesh(editor, '平面', [0, 0, 0], palette.ground, '地面', false, { size: 30, onGround: true, flat: true })
  if (ground.error) return ground
  const groundId = ground.object?.id
  if (groundId) created.push({ role: 'ground', id: groundId })

  setSceneProps(editor, { background: palette.background, fog: { color: palette.fog, near: 10, far: 45 } })

  addLight(editor, '环境光', [0, 3, 0])
  const key = addLight(editor, '平行光', [6, 10, 4])
  if (key.object?.id) setProps(editor, { id: key.object.id, intensity: 1.1 })

  const hero = await addMesh(editor, '球体', [0, 0, 0], palette.primary, '主体', false, { onGround: true })
  const heroId = hero.object?.id
  if (heroId) {
    setProps(editor, { id: heroId, scale: [1.2, 1.2, 1.2], castShadow: true })
    created.push({ role: 'hero', id: heroId })
  }

  const prop = await addMesh(editor, '二十面体', [2.5, 0, 1.5], palette.secondary, '装饰', false, { onGround: true })
  const propId = prop.object?.id
  if (propId) {
    setProps(editor, { id: propId, scale: [0.5, 0.5, 0.5], castShadow: true })
    created.push({ role: 'prop', id: propId })
  }

  const shadows = enableSceneShadows(editor, {
    receiveIds: groundId ? [groundId] : [],
    castIds: [heroId, propId].filter(Boolean),
  })

  if (heroId) {
    await focusObject(editor, heroId, 0.7)
  } else {
    await focusScene(editor, 0.7)
  }

  return {
    palette: palette.name,
    created,
    shadows,
    message: '已搭建：地面+主光+主体+1装饰，阴影已开，相机已对准主体',
  }
}

export function inspectScene(editor, { id, name, type, designType, deep, includeObjects = true } = {}) {
  const out = {
    selectedId: editor.transformControls.object?.id ?? null,
    spatial: getSpatialContext(editor, id),
  }
  if (id != null) {
    const o = find(editor.scene, id)
    if (o) out.focus = { object: detail(o, { children: true }) }
  }
  if (!includeObjects) return out
  const raw = collectObjects(editor, { deep, name, type, designType })
  out.summary = summarizeObjects(raw)
  out.objects = raw.slice(0, LIST_CAP).map(brief)
  if (raw.length > LIST_CAP) out.truncated = true
  return out
}

export function listObjects(editor, opts = {}) {
  return collectObjects(editor, opts).map(brief)
}

// L3 · 全量 AI 工具（60+，Zod 参数校验；日常经 runAdvanced 或 createSceneTools 间接调用）
const _toolsCache = new WeakMap()
function allSceneTools(editor) {
  let t = _toolsCache.get(editor)
  if (!t) { t = createAllSceneTools(editor); _toolsCache.set(editor, t) }
  return t
}

function createAllSceneTools(editor) {
  return {
    placeOnGround: mk('将物体底面贴到地面。自动算 y；平面可 flat:true 放平', z.object({
        id: z.number(),
        groundY: z.number().optional().describe('目标地面高度，默认取 getSpatialContext.recommendedGroundY'),
        flat: z.boolean().optional().describe('PlaneGeometry 放平为 XZ 地面，rotation [-90,0,0]'),
        x: z.number().optional(),
        z: z.number().optional(),
        refId: z.number().optional().describe('参考另一物体顶面作为 groundY'),
      }), (input) => placeOnGround(editor, input)),
    getDetail: mk('获取对象完整属性：空间信息 + custom(params/uniforms/materials)', z.object({
        id: z.number(),
        children: z.boolean().optional().describe('是否包含直接子节点列表'),
      }), ({ id, children }) => {
        const o = find(editor.scene, id)
        return o ? { object: detail(o, { children: !!children }) } : { error: `未找到 id=${id}` }
      }),
    setObjectParams: mk('修改组件 params/uniforms/material。组件会走 setStorage 与 GUI 一致', z.object({
        id: z.number(),
        params: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).optional()
          .describe('组件 params，如 count/speed/size/gridColor'),
        uniforms: z.record(z.string(), z.union([z.number(), z.string(), z.boolean(), z.array(z.number())])).optional()
          .describe('shader uniform，如 uGridColor/animationSpeed/offsetX'),
        extras: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).optional()
          .describe('对象级属性，如 needsUpdate'),
        materials: z.record(z.string(), z.object({
          color: z.string().optional(), opacity: z.number().optional(),
          metalness: z.number().optional(), roughness: z.number().optional(), emissive: z.string().optional(),
        }).optional()).optional().describe('标准材质，key 为 self 或子 mesh 名称'),
      }), (input) => setObjectParams(editor, input)),
    listComponentSchema: mk('单个组件详情（等同 listResources({ label })，查阅后才可 addComponent）', z.object({ label: z.string().describe('组件 label，如 网格地面、柱状图') }), ({ label }) => buildComponentDetail(editor, label)),
    listAnimations: mk('列出 GLB/FBX 模型自带动画 clips；不传 id 则扫描场景中所有含动画的模型', z.object({
        id: z.number().optional().describe('模型对象 id，来自 listObjects'),
      }), ({ id }) => listAnimations(editor, id)),
    playAnimation: mk('播放模型自带动画。用 index/indices 或 name/names 指定 clip', z.object({
        id: z.number(),
        index: z.number().int().min(0).optional().describe('单个动画索引，来自 listAnimations'),
        indices: z.array(z.number().int().min(0)).optional().describe('多个动画索引'),
        name: z.string().optional().describe('单个动画名称'),
        names: z.array(z.string()).optional().describe('多个动画名称'),
        loop: z.boolean().optional().describe('是否循环，默认 true'),
        speed: z.number().min(-10).max(10).optional().describe('播放速度，默认 1'),
        startTime: z.number().min(0).max(10000).optional().describe('起始时间(秒)，默认 0'),
      }), (input) => playModelAnimation(editor, input)),
    stopAnimation: mk('停止模型自带动画播放', z.object({ id: z.number() }), ({ id }) => stopModelAnimation(editor, { id })),
    setAnimationPlayParams: mk('设置模型 animationPlayParams（初始加载播放、速度、循环、选中 clips），与编辑器动画面板一致', z.object({
        id: z.number(),
        initPlay: z.boolean().optional().describe('初始/自动播放开关'),
        speed: z.number().min(-10).max(10).optional(),
        loop: z.boolean().optional(),
        startTime: z.number().min(0).max(10000).optional().describe('开始时间(秒)'),
        play: z.boolean().optional().describe('立即按当前参数播放'),
        index: z.number().int().min(0).optional(),
        indices: z.array(z.number().int().min(0)).optional(),
        name: z.string().optional(),
        names: z.array(z.string()).optional(),
      }), (input) => setAnimationPlayParams(editor, input)),
    runEditorAction: mk('执行 listEditorActions 中的任意 action，覆盖编辑器尚未专用工具化的能力', z.object({
        action: z.string().describe('action 名，来自 listEditorActions'),
        params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()]))])).optional(),
      }), ({ action, params }) => runEditorAction(editor, { action, params: params || {} })),
    openEditorPanel: mk('打开编辑器 GUI 浮动窗。panel=渲染配置|相机配置|轨道配置|变换配置|环境配置|后期处理；不传 panel 则打开控制板', z.object({
        panel: z.enum(BASIC_PANELS).optional().describe('子配置窗名称，如 渲染配置'),
        openMain: z.boolean().optional().describe('是否同时打开控制板四宫格，默认 true'),
      }), (input) => openEditorPanel(editor, input)),
    openObjectPanel: mk('打开选中对象的 GUI 配置窗（等同右键菜单）：basicConf/materialConf/shaderConf/relatedConf', z.object({
        id: z.number(),
        panel: z.enum(Object.keys(OBJECT_PANELS)).optional().describe('默认 materialConf'),
      }), ({ id, panel }) => openObjectPanel(editor, { id, panel: panel || 'materialConf' })),
    setEditorMode: mk('切换编辑器交互模式：handlerMode(transform/select/none)、transformMode(translate/rotate/scale)、preview 预览', z.object({
        handlerMode: z.enum([...HANDLER_MODES]).optional(),
        transformMode: z.enum([...TC_MODES]).optional(),
        preview: z.boolean().optional().describe('true 时 handler.mode=none（不折叠侧栏）'),
      }), (input) => setEditorMode(editor, input)),
    undoEditor: mk('撤销上一步变换操作（等同 Ctrl+Z）', z.object({}), () => undoEditor(editor)),
    redoEditor: mk('重做变换操作（等同 Ctrl+Y）', z.object({}), () => redoEditor(editor)),
    saveEditorScene: mk('保存当前场景到 localStorage（等同顶部「保存」）', z.object({
        sceneName: z.string().optional().describe('场景名，默认当前场景'),
      }), (input) => saveEditorScene(editor, input)),
    captureScreenshot: mk('截取当前视口 PNG（等同相机按钮），默认自动下载', z.object({
        download: z.boolean().optional().describe('默认 true'),
        quality: z.number().min(0.1).max(1).optional(),
      }), (input) => captureScreenshot(editor, input)),
    exportSceneJson: mk('导出 saveSceneEdit JSON 模板文件', z.object({
        download: z.boolean().optional(),
        sceneName: z.string().optional(),
      }), (input) => exportSceneJson(editor, input)),
    exportSceneGlb: mk('导出场景可见模型为 GLB 文件', z.object({ sceneName: z.string().optional() }), (input) => exportSceneGlb(editor, input)),
    getObjectBox3Info: mk('lib.getObjectBox3：精确包围盒 center/radius/min/max', z.object({ id: z.number() }), ({ id }) => getObjectBox3Info(editor, { id })),
    getObjectMaterials: mk('lib.getMaterials：列出对象及子节点上的材质摘要', z.object({ id: z.number() }), ({ id }) => getObjectMaterials(editor, { id })),
    getEditorSettings: mk('读取 saveSceneEdit 持久化配置。runtime 状态用 getEditorApi', z.object({}), () => getEditorSettings(editor)),
    setEditorSettings: mk('修改 saveSceneEdit 配置段。改渲染器数值无需 openEditorPanel；要弹 GUI 用 openEditorPanel({ panel:"渲染配置" })', z.object({
        scene: z.object({
          backgroundBlurriness: z.number().min(0).max(1).optional(),
          backgroundIntensity: z.number().min(0).max(10).optional(),
          environmentEnabled: z.boolean().optional(),
        }).optional(),
        perspectiveCamera: z.object({
          fov: z.number().min(1).max(179).optional(),
          near: z.number().min(0.001).max(1000).optional(),
          far: z.number().min(1).max(1e7).optional(),
          zoom: z.number().min(0.01).max(10).optional(),
          filmOffset: z.number().min(-10).max(10).optional(),
          filmGauge: z.number().min(1).max(100).optional(),
          position: vec3flex,
        }).optional(),
        webglRenderer: z.object({
          outputColorSpace: z.enum(['srgb', 'srgb-linear', 'display-p3', 'linear-srgb']).optional(),
          toneMapping: z.number().int().min(0).max(7).optional(),
          toneMappingExposure: z.number().min(0).max(10).optional(),
          color: hexColor.optional().describe('清屏色，十六进制整数或 #rrggbb'),
          opacity: z.number().min(0).max(1).optional().describe('清屏透明度'),
          shadowMap: z.object({ enabled: z.boolean().optional(), type: z.number().int().min(0).max(2).optional() }).optional(),
          sortObjects: z.boolean().optional(),
          localClippingEnabled: z.boolean().optional(),
          autoClear: z.boolean().optional(),
          autoClearColor: z.boolean().optional(),
          renderListCompare: z.array(z.object({
            name: z.enum(['stats', 'controls', 'scene', 'css3DRender', 'css2DRender']),
            enabled: z.boolean().optional(),
          })).optional(),
        }).optional(),
        orbitControls: z.object({
          autoRotate: z.boolean().optional(),
          autoRotateSpeed: z.number().min(0).max(30).optional(),
          enableDamping: z.boolean().optional(),
          dampingFactor: z.number().min(0).max(1).optional(),
          minDistance: z.number().optional(),
          maxDistance: z.number().optional(),
          maxTargetRadius: z.number().optional(),
          minTargetRadius: z.number().optional(),
          enablePan: z.boolean().optional(),
          panSpeed: z.number().optional(),
          enableRotate: z.boolean().optional(),
          rotateSpeed: z.number().optional(),
          enableZoom: z.boolean().optional(),
          zoomSpeed: z.number().optional(),
          zoomToCursor: z.boolean().optional(),
          target: vec3flex,
        }).optional(),
        transformControls: z.object({
          mode: z.enum(['translate', 'rotate', 'scale']).optional(),
          space: z.enum(['world', 'local']).optional(),
          size: z.number().optional(),
          showX: z.boolean().optional(),
          showY: z.boolean().optional(),
          showZ: z.boolean().optional(),
          translationSnap: z.number().min(0).max(100).nullable().optional(),
          rotationSnap: z.number().min(0).max(Math.PI).nullable().optional(),
          scaleSnap: z.number().min(0).max(10).nullable().optional(),
        }).optional(),
        effectComposer: z.object({
          renderWay: z.enum(['effectComposer', 'webglRenderer']).optional(),
          fxaaPass: passPatch.optional(),
          outlinePass: passPatch.optional(),
          outputPass: passPatch.optional(),
          saoPass: passPatch.optional(),
          screenMaskPass: passPatch.optional(),
          ssrPass: passPatch.optional(),
          unrealBloomPass: passPatch.optional(),
        }).optional(),
        handler: z.object({
          mode: z.enum(['transform', 'select', 'none']).optional().describe('编辑器交互模式'),
          selectChildEnabled: z.boolean().optional(),
          selectChildLevel: z.number().int().min(1).max(10).optional(),
          stats: z.object({
            showStats: z.boolean().optional(),
            statsMode: z.number().int().min(0).max(2).optional(),
          }).optional(),
          helpers: z.object({
            grid: z.object({
              showGrid: z.boolean().optional(),
              size: z.number().min(1).max(10000).optional(),
              divisions: z.number().int().min(1).max(200).optional(),
              colorCenterLine: hexColor.optional(),
              colorGrid: hexColor.optional(),
            }).optional(),
            axes: z.object({
              showAxes: z.boolean().optional(),
              axesLength: z.number().min(1).max(10000).optional(),
            }).optional(),
            box3: z.object({
              useBox3: z.boolean().optional(),
              color: hexColor.optional(),
            }).optional(),
          }).optional(),
        }).optional(),
        other: z.object({
          clipping: z.object({ size: z.number().min(0.1).max(1000).optional() }).optional(),
        }).optional(),
      }), (input) => setEditorSettings(editor, input)),
    setProps: mk('修改对象属性（含灯光 intensity、阴影、renderOrder）', z.object({
        id: z.number(), name: z.string().optional(), visible: z.boolean().optional(),
        position: vec3flex, rotation: vec3, scale: vec3,
        color: z.string().optional(), opacity: z.number().min(0).max(1).optional(),
        intensity: z.number().min(0).max(MAX_INTENSITY).optional().describe('灯光强度'),
        castShadow: z.boolean().optional(),
        receiveShadow: z.boolean().optional(),
        renderOrder: z.number().int().min(-1000).max(1000).optional(),
      }), (input) => setProps(editor, input)),
    selectObject: mk('选中对象，不移动相机', z.object({ id: z.number() }), ({ id }) => selectObject(editor, id)),
    deleteObject: mk('从场景删除对象并 dispose 几何/材质/纹理', z.object({ id: z.number() }), ({ id }) => deleteObject(editor, id)),
    addModel: mk('加载编辑器本地 GLB/FBX 模型。默认贴地且 flyTo 飞到模型', z.object({
      urlOrName: z.string().describe('本地模型文件名，来自 listResources.models，如 Fox.glb'),
        position: vec3.describe('位置，默认 [0,0,0]'),
        flyTo: z.boolean().optional().describe('加载后飞过去，默认 true'),
        onGround: z.boolean().optional().describe('加载后自动贴地，默认 true'),
        initPlay: z.boolean().optional().describe('初始加载播放，需配合 index/indices'),
        index: z.number().int().min(0).optional().describe('加载后播放的动画索引'),
        indices: z.array(z.number().int().min(0)).optional(),
        loop: z.boolean().optional().describe('是否循环，默认 true'),
        speed: z.number().min(-10).max(10).optional().describe('播放速度，默认 1'),
      }), ({ urlOrName, position, flyTo, onGround, initPlay, index, indices, loop, speed }) =>
        addModel(editor, urlOrName, position ?? [0, 0, 0], flyTo !== false, { initPlay, index, indices, loop, speed }, onGround !== false)),
    addComponent: mk('添加组件。须先 listResources({ label })；默认 flyTo 飞到组件', z.object({
        label: z.string().describe('已查阅过的组件 label'),
        position: vec3req,
        flyTo: z.boolean().optional().describe('添加后飞过去，默认 true'),
        onGround: z.boolean().optional().describe('自动贴地，地面类默认 true'),
      }), ({ label, position, flyTo, onGround }) => addComponent(editor, label, position, flyTo !== false, onGround)),
    addLight: mk('添加灯光。平行光/聚光灯默认 castShadow；完整阴影用 enableShadows()', z.object({
        type: z.enum(LIGHT_TYPES), position: vec3.describe('默认 [0,5,0]'),
      }), ({ type, position }) => addLight(editor, type, position ?? [0, 5, 0])),
    addMesh: mk('添加基础几何体。默认 flyTo 飞到新物体；地面: type=平面 + onGround + flat', z.object({
        type: z.enum(Object.keys(MESH_TYPES)).describe('几何体类型，来自 listResources'),
        position: vec3.describe('位置，默认 [0,0,0]'),
        color: z.string().optional().describe('颜色，默认 #ffffff'),
        name: z.string().optional().describe('对象名称'),
        size: z.number().min(1).max(500).optional().describe('平面边长(正方形)，仅 type=平面 且作地面时用'),
        rotation: vec3.optional().describe('欧拉角(度)，平面作地面常用 [-90,0,0]'),
        onGround: z.boolean().optional().describe('添加后自动贴地'),
        flat: z.boolean().optional().describe('PlaneGeometry 放平，等同 placeOnGround(flat:true)'),
        flyTo: z.boolean().optional().describe('添加后飞过去，默认 true'),
      }), ({ type, position, color, name, size, rotation, onGround, flat, flyTo }) =>
        addMesh(editor, type, position ?? [0, 0, 0], color ?? '#ffffff', name, flyTo !== false, { size, rotation, onGround, flat })),
    addMeshes: mk('批量添加几何体，适合网格交点批量放置（最多 50 个）', z.object({
        items: z.array(z.object({
          type: z.enum(Object.keys(MESH_TYPES)),
          position: vec3req,
          color: z.string().optional(),
          name: z.string().optional(),
        })).min(1).max(50),
      }), ({ items }) => addMeshes(editor, items)),
    createGroup: mk('Three.js 原生：创建 Group 容器，可指定 parentId 挂到已有节点下', z.object({
        name: z.string().optional(),
        position: vec3,
        parentId: z.number().optional().describe('父节点 id，默认加到 scene 根'),
      }), (input) => createGroup(editor, input)),
    reparentObject: mk('Three.js 原生：改变父节点，Object3D.attach 保持世界变换不变', z.object({
        id: z.number(),
        parentId: z.number().nullable().optional().describe('新父 id，null/省略=移到 scene 根'),
      }), ({ id, parentId }) => reparentObject(editor, { id, parentId: parentId ?? null })),
    cloneObject: mk('Three.js 原生：深拷贝对象(含子节点/几何/材质)，可指定新位置与父节点', z.object({
        id: z.number(),
        name: z.string().optional(),
        position: vec3flex,
        parentId: z.number().optional(),
      }), (input) => cloneObject(editor, input)),
    lookAt: mk('Three.js 原生：Object3D.lookAt，使 -Z 轴指向目标点或目标对象', z.object({
        id: z.number(),
        target: vec3flex.describe('世界坐标目标点'),
        targetId: z.number().optional().describe('或指向某对象的世界位置'),
      }), (input) => lookAtObject(editor, input)),
    createMesh: mk('Three.js 原生：用 geometryType/materialType 类名创建 Mesh，比 addMesh 更灵活', z.object({
        geometryType: z.enum(GEOMETRY_TYPES),
        geometryParams: geoParams.describe('数值参数；LatheGeometry.points=[[x,y],...]；TubeGeometry.points=[[x,y,z],...]'),
        materialType: z.enum(MATERIAL_TYPES).optional().describe('默认 MeshStandardMaterial'),
        materialParams: matParams,
        position: vec3, rotation: vec3, name: z.string().optional(),
        parentId: z.number().optional(),
        onGround: z.boolean().optional(), flat: z.boolean().optional(), flyTo: z.boolean().optional(),
      }), (input) => createMesh(editor, input)),
    setMaterial: mk('Three.js 原生：切换材质类型或改 wireframe/side/metalness 等 PBR 属性', z.object({
        id: z.number(),
        meshName: z.string().optional().describe('Group 内子 mesh 名称'),
        materialType: z.enum(MATERIAL_TYPES).optional().describe('传入则整体替换材质'),
        color: z.string().optional(), emissive: z.string().optional(),
        opacity: z.number().min(0).max(1).optional(),
        metalness: z.number().min(0).max(1).optional(),
        roughness: z.number().min(0).max(1).optional(),
        wireframe: z.boolean().optional(),
        flatShading: z.boolean().optional(),
        vertexColors: z.boolean().optional(),
        side: z.union([z.enum(['FrontSide', 'BackSide', 'DoubleSide']), z.number().int().min(0).max(2)]).optional(),
      }), (input) => setMaterial(editor, input)),
    replaceGeometry: mk('Three.js 原生：替换 Mesh 几何体(释放旧 geometry)，用 Three.js Geometry 类名+参数', z.object({
        id: z.number(),
        meshName: z.string().optional(),
        geometryType: z.enum(GEOMETRY_TYPES),
        params: geoParams,
      }), ({ id, meshName, geometryType, params }) => replaceGeometry(editor, { id, meshName, geometryType, params })),
    addLine: mk('Three.js 原生：BufferGeometry + Line/LineLoop，points 为 [[x,y,z],...]', z.object({
        points: z.array(vec3req).min(2).max(500),
        color: z.string().optional(),
        name: z.string().optional(),
        closed: z.boolean().optional().describe('true 时用 LineLoop'),
        linewidth: z.number().min(1).max(10).optional(),
      }), (input) => addLine(editor, input)),
    addPoints: mk('Three.js 原生：点云 Points + PointsMaterial', z.object({
        points: z.array(vec3req).min(1).max(5000),
        color: z.string().optional(),
        size: z.number().min(0.01).max(50).optional(),
        name: z.string().optional(),
      }), (input) => addPoints(editor, input)),
    setSceneProps: mk('Three.js 原生：scene.background 纯色、scene.fog(Fog/FogExp2)，与 setSky 互补', z.object({
        background: z.union([z.string(), z.null()]).optional().describe('#rrggbb 或 null 清除'),
        fog: z.union([
          z.null(),
          z.object({
            type: z.enum(['Fog', 'FogExp2', 'none']).optional(),
            color: z.string().optional(),
            near: z.number().optional(),
            far: z.number().optional(),
            density: z.number().optional(),
          }),
        ]).optional(),
      }), (input) => setSceneProps(editor, input)),
    applyTexture: mk('Three.js 原生：TextureLoader 加载远程贴图并赋给 material.map 等通道', z.object({
        id: z.number(),
        url: z.string().describe('http(s) 纹理 URL'),
        map: z.enum(TEXTURE_MAPS).optional().describe('默认 map'),
        meshName: z.string().optional(),
      }), (input) => applyTexture(editor, input)),
    setLightProps: mk('Three.js 原生：灯光 target/castShadow/distance/angle/penumbra/shadow 参数', z.object({
        id: z.number(),
        target: vec3flex.describe('平行光/聚光灯照射目标点'),
        castShadow: z.boolean().optional(),
        distance: z.number().min(0).optional(),
        angle: z.number().min(0).max(3.14).optional(),
        penumbra: z.number().min(0).max(1).optional(),
        decay: z.number().min(0).max(10).optional(),
        shadowBias: z.number().min(-0.01).max(0.01).optional(),
        shadowMapSize: z.number().int().min(256).max(4096).optional(),
      }), (input) => setLightProps(editor, input)),
    createBufferMesh: mk('Three.js 原生：BufferGeometry 自定义顶点网格，positions 为 [x,y,z,...] 扁平数组', z.object({
        positions: z.array(z.number()).min(9).max(15000),
        indices: z.array(z.number().int().min(0)).max(50000).optional(),
        colors: z.array(z.number()).optional().describe('与 positions 等长，顶点色'),
        materialType: z.enum(MATERIAL_TYPES).optional(),
        materialParams: z.object({
          color: z.string().optional(), opacity: z.number().min(0).max(1).optional(),
          metalness: z.number().min(0).max(1).optional(), roughness: z.number().min(0).max(1).optional(),
          wireframe: z.boolean().optional(),
        }).optional(),
        name: z.string().optional(), position: vec3, parentId: z.number().optional(),
        onGround: z.boolean().optional(), flat: z.boolean().optional(), flyTo: z.boolean().optional(),
      }), (input) => createBufferMesh(editor, input)),
    addNativeLight: mk('Three.js 原生：用 API 类名添加灯光(AmbientLight/DirectionalLight/...)，配合 setLightProps', z.object({
        type: z.enum(NATIVE_LIGHT_TYPES).optional().describe('默认 DirectionalLight'),
        position: vec3, color: z.string().optional(), intensity: z.number().min(0).max(MAX_INTENSITY).optional(),
      }), (input) => addNativeLight(editor, input)),
    addSprite: mk('Three.js 原生：Sprite 文字标签或贴图精灵', z.object({
        text: z.string().optional(), textureUrl: z.string().optional().describe('http(s) 贴图 URL'),
        position: vec3, color: z.string().optional(), fontSize: z.number().optional(), name: z.string().optional(),
      }), (input) => addSprite(editor, input)),
    createInstancedMesh: mk('Three.js 原生：InstancedMesh 批量渲染相同几何，count 最多 2000', z.object({
        geometryType: z.enum(GEOMETRY_TYPES),
        geometryParams: geoParams.optional(),
        materialType: z.enum(MATERIAL_TYPES).optional(),
        materialParams: matParams,
        count: z.number().int().min(1).max(MAX_INSTANCES),
        instances: z.array(z.object({
          position: vec3, rotation: vec3, scale: z.union([vec3, z.number()]).optional(),
        })).max(MAX_INSTANCES).optional(),
        name: z.string().optional(), position: vec3, parentId: z.number().optional(), flyTo: z.boolean().optional(),
      }), (input) => createInstancedMesh(editor, input)),
    createLatheMesh: mk('Three.js 原生：LatheGeometry 旋转体，profile=[[x,y],...] 轮廓点', z.object({
        profile: profile2d,
        segments: z.number().int().min(3).max(128).optional(),
        materialType: z.enum(MATERIAL_TYPES).optional(),
        materialParams: matParams,
        name: z.string().optional(), position: vec3, parentId: z.number().optional(),
        onGround: z.boolean().optional(), flyTo: z.boolean().optional(),
      }), (input) => createLatheMesh(editor, input)),
    addTubeMesh: mk('Three.js 原生：CatmullRomCurve3 + TubeGeometry 管道网格', z.object({
        points: path3d,
        radius: z.number().min(0.01).max(50).optional(),
        tubularSegments: z.number().int().min(8).max(256).optional(),
        radialSegments: z.number().int().min(3).max(64).optional(),
        materialType: z.enum(MATERIAL_TYPES).optional(),
        materialParams: matParams,
        name: z.string().optional(), position: vec3, parentId: z.number().optional(), flyTo: z.boolean().optional(),
      }), (input) => addTubeMesh(editor, input)),
    updateMeshGeometry: mk('Three.js 原生：BufferGeometry 后处理 computeVertexNormals/center/包围盒', z.object({
        id: z.number(), meshName: z.string().optional(),
        computeNormals: z.boolean().optional(),
        center: z.boolean().optional(),
        computeBounds: z.boolean().optional(),
      }), (input) => updateMeshGeometry(editor, input)),
    addMeshWireframe: mk('Three.js 原生：EdgesGeometry/WireframeGeometry 线框叠加', z.object({
        id: z.number(), meshName: z.string().optional(),
        mode: z.enum(['edges', 'wireframe']).optional(),
        color: z.string().optional(),
        thresholdAngle: z.number().min(1).max(90).optional(),
        name: z.string().optional(),
      }), (input) => addMeshWireframe(editor, input)),
    listScenes: mk('列出可加载的配置案例场景', z.object({}), () => ({ scenes: listScenes() })),
    loadScene: mk('【慎用】加载配置案例，会替换当前场景。用户明确要求时才调用', z.object({ name: z.string().describe('场景名，来自 listScenes') }), ({ name }) => loadScene(editor, name)),
    listSkies: mk('列出天空盒/环境贴图选项', z.object({}), () => ({ skies: SKIES.map(s => s.name) })),
    setSky: mk('设置天空盒背景', z.object({ name: z.string().describe('来自 listSkies') }), ({ name }) => setSky(editor, name)),
    setEnv: mk('设置环境反射贴图', z.object({ name: z.string().describe('蓝天/晴天/森林') }), ({ name }) => setEnv(editor, name)),
    setHelpers: mk('网格/坐标轴/包围盒辅助：显示、尺寸、颜色、长度', z.object({
        grid: z.boolean().optional(),
        axes: z.boolean().optional(),
        size: z.number().min(1).max(10000).optional().describe('网格总尺寸'),
        divisions: z.number().int().min(1).max(200).optional().describe('网格分割数'),
        colorCenterLine: hexColor.optional().describe('网格中心线颜色'),
        colorGrid: hexColor.optional().describe('网格线颜色'),
        axesLength: z.number().min(1).max(10000).optional().describe('坐标轴长度'),
        useBox3: z.boolean().optional().describe('显示选中包围盒'),
        box3Color: hexColor.optional().describe('包围盒颜色'),
      }), (input) => setHelpers(editor, input)),
    focusObject: mk('选中并飞过去', z.object({ id: z.number(), duration: z.number().min(0.1).max(5).optional() }), ({ id, duration }) => focusObject(editor, id, duration ?? 0.5)),
    focusView: mk('相机飞到指定位置和目标', z.object({
        position: vec3req, target: vec3req, duration: z.number().min(0.1).max(5).optional(),
      }), ({ position, target, duration }) => focusView(editor, position, target, duration ?? 0.5)),
  }
}

export { mk, vec3, vec3req, allSceneTools }
