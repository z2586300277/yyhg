import * as THREE from 'three'


// 聊天 AI
export const CFG_KEY = 'AI_scene_config'
export const LAYOUT_KEY = 'AI_panel_layout'
export const CHATS_KEY = 'AI_chats'
export const DEFAULT_AI_CONFIG = {
  baseURL: 'https://api.deepseek.com/anthropic',
  apiKey: '',
  model: 'deepseek-v4-flash',
}
export const MAX_HISTORY = 12
export const MAX_STEPS = 12
export const TOOL_STATUS = {
  inspectScene: '看场景', listResources: '查资源', openPanel: '开面板', getObject: '读对象', editObject: '改对象',
  addMesh: '加几何', addComponent: '加组件', addModel: '加模型', addLight: '加灯光',
  createMesh: '原生建模', setMaterial: '原生材质', setSceneProps: '原生场景',
  addNativeLight: '原生灯光', setLightProps: '灯光调参', applyTexture: '贴图',
  cloneObject: '克隆对象', lookAt: '朝向目标',
  deleteObject: '删除', placeOnGround: '贴地', setEnvironment: '设氛围', enableShadows: '开阴影',
  playAnimation: '播动画', history: '撤销/重做', buildScene: '搭建场景', runAdvanced: '高级操作',
}
export const CURATED = new Set([
  'inspectScene', 'listResources', 'openPanel', 'getObject', 'editObject',
  'addMesh', 'addComponent', 'addModel', 'addLight',
  'createMesh', 'setMaterial', 'setSceneProps', 'addNativeLight', 'setLightProps', 'applyTexture', 'cloneObject', 'lookAt',
  'deleteObject', 'placeOnGround', 'setEnvironment', 'enableShadows', 'focusCamera',
  'playAnimation', 'history', 'buildScene', 'runAdvanced',
])
export const ADVANCED_HINT = 'runEditorAction,openEditorPanel,exportSceneGlb,createInstancedMesh,createLatheMesh,addTubeMesh,...'

/** 阴影四要素（缺一无效） */
export const SHADOW_GUIDE = '① renderer.shadowMap ② 平行光 castShadow ③ mesh castShadow ④ 地面 receiveShadow；只用 enableShadows，不要用 setEnvironment 开阴影'

/** 搭建原则 */
export const SCENE_COMPOSE_GUIDE = '少而精：主体1+装饰0~2；每添加后 focusCamera 飞到新物体；禁止无脑堆元素；相机距离约为主体尺寸3~8倍'

// 路径
export const assetPrefix = __isProduction__ ? '/threejs-editor-beta/' : '/'
export const animJsonPath = (v) => assetPrefix + v
export const scenePath = (v) => assetPrefix + v

// 数值限制
export const PROTECTED = new Set(['PerspectiveCamera', 'OrthographicCamera', 'AxesHelper', 'GridHelper', 'Box3Helper'])
export const SKIP = new Set(['PerspectiveCamera', 'AxesHelper', 'GridHelper', 'Box3Helper'])
export const MAX_POS = 1e5
export const MIN_SCALE = 0.001
export const MAX_SCALE = 1e3
export const MAX_INTENSITY = 100
export const MAX_COUNT = 5000
export const MAX_INSTANCES = 2000
export const MAX_CURVE_POINTS = 256
export const MAX_DRAW_POINTS = 500
export const LIST_CAP = 24
export const EXTRA_KEYS = new Set(['needsUpdate'])
export const PARAM_LIMITS = {
  count: [1, MAX_COUNT], elementSize: [0.01, 50], range: [1, 500], size: [0.1, 500],
  radius: [0.01, 50], height: [0.01, 100], segments: [3, 128], speed: [0, 10],
  speedVariation: [0, 5], opacity: [0, 1], randomInterval: [50, 10000],
  gridThickness: [0, 0.1], crossThickness: [0, 0.1], cross: [0, 1], gridScale: [1, 200],
}

// 编辑器 action / 面板
export const OTHER_PANELS = ['编辑动画', '视角动画', '变换动画', '裁剪场景']
export const LIGHT_ZH = {
  '环境光': 'AmbientLight', '平行光': 'DirectionalLight', '点光源': 'PointLight',
  '聚光灯': 'SpotLight', '半球光': 'HemisphereLight', '平面光': 'RectAreaLight',
}
export const HANDLER_MODES = new Set(['transform', 'select', 'none'])
export const TC_MODES = new Set(['translate', 'rotate', 'scale'])
export const TRANSFORM_MODES = TC_MODES
export const TC_SPACES = new Set(['world', 'local'])
export const EDITOR_SETTING_KEYS = ['scene', 'perspectiveCamera', 'webglRenderer', 'orbitControls', 'transformControls', 'effectComposer', 'handler', 'other']
export const EFFECT_PASS_KEYS = new Set(['fxaaPass', 'outlinePass', 'outputPass', 'saoPass', 'screenMaskPass', 'ssrPass', 'unrealBloomPass'])
export const RENDER_WAYS = new Set(['effectComposer', 'webglRenderer'])
export const OUTPUT_COLOR_SPACES = new Set(['srgb', 'srgb-linear', 'display-p3', 'linear-srgb'])
export const RENDER_LIST_NAMES = new Set(['stats', 'controls', 'scene', 'css3DRender', 'css2DRender'])
export const BASIC_PANELS = ['渲染配置', '相机配置', '轨道配置', '变换配置', '环境配置', '后期处理']
export const OBJECT_PANELS = {
  basicConf: '基础配置', materialConf: '材质配置', shaderConf: '着色配置', relatedConf: '相关配置',
}

// 场景资源
export const LIGHT_TYPES = ['环境光', '平行光', '点光源', '聚光灯', '半球光', '平面光']
export const NATIVE_LIGHT_TYPES = ['AmbientLight', 'DirectionalLight', 'PointLight', 'SpotLight', 'HemisphereLight', 'RectAreaLight']
export const NATIVE_TOOL_NAMES = [
  'createMesh', 'createBufferMesh', 'createInstancedMesh', 'createLatheMesh', 'addTubeMesh',
  'createGroup', 'reparentObject', 'cloneObject', 'lookAt',
  'setMaterial', 'replaceGeometry', 'applyTexture', 'updateMeshGeometry', 'addMeshWireframe',
  'addLine', 'addPoints', 'addSprite', 'addNativeLight', 'setLightProps', 'setSceneProps', 'setProps',
]
export const MESH_TYPES = {
  '立方体': () => new THREE.BoxGeometry(1, 1, 1),
  '球体': () => new THREE.SphereGeometry(0.5, 32, 16),
  '圆柱': () => new THREE.CylinderGeometry(0.5, 0.5, 1, 32),
  '圆锥': () => new THREE.ConeGeometry(0.5, 1, 32),
  '圆环': () => new THREE.TorusGeometry(0.5, 0.2, 16, 32),
  '平面': () => new THREE.PlaneGeometry(1, 1),
  '二十面体': () => new THREE.IcosahedronGeometry(0.5),
  '八面体': () => new THREE.OctahedronGeometry(0.5),
  '十二面体': () => new THREE.DodecahedronGeometry(0.5),
  '圆扭结': () => new THREE.TorusKnotGeometry(0.4, 0.1, 64, 8),
}
export const MESH_USAGE = {
  '立方体': '建筑块、平台、箱体、台阶', '球体': '装饰球、天体、节点、hero 主体',
  '圆柱': '柱子、树干、塔身', '圆锥': '屋顶、树形、标记锥', '圆环': '光环、轨道、装饰环',
  '平面': '地面/墙面/背景板（地面需 flat+onGround）', '二十面体': '低多边形装饰、晶体',
  '八面体': '宝石、钻石形装饰', '十二面体': '骰子、几何装饰', '圆扭结': '艺术装饰、复杂曲线主体',
}
export const SKIES = [
  { name: '蓝天', url: 'https://z2586300277.github.io/three-editor/dist/files/scene/skyBox0/' },
  { name: '晴天', url: 'https://z2586300277.github.io/3d-file-server/files/sky/skyBox1/' },
  { name: '森林', url: 'https://z2586300277.github.io/three-editor/dist/files/scene/skyBox8/' },
  { name: '清除', url: '' },
]
export const MATERIAL_TYPES = ['MeshBasicMaterial', 'MeshStandardMaterial', 'MeshPhongMaterial', 'MeshLambertMaterial', 'MeshNormalMaterial', 'MeshPhysicalMaterial', 'MeshToonMaterial', 'MeshDepthMaterial']
export const GEOMETRY_TYPES = ['BoxGeometry', 'SphereGeometry', 'PlaneGeometry', 'CylinderGeometry', 'ConeGeometry', 'TorusGeometry', 'TorusKnotGeometry', 'IcosahedronGeometry', 'OctahedronGeometry', 'DodecahedronGeometry', 'TetrahedronGeometry', 'CapsuleGeometry', 'RingGeometry', 'CircleGeometry', 'LatheGeometry', 'TubeGeometry']
export const TEXTURE_MAPS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap']
export const SIDE_MAP = { FrontSide: THREE.FrontSide, BackSide: THREE.BackSide, DoubleSide: THREE.DoubleSide }
export const COLOR_PALETTES = [
  { name: '黄昏暖调', background: '#1a1423', fog: '#2d3436', ground: '#4a4a4a', primary: '#e17055', secondary: '#636e72', accent: '#fdcb6e' },
  { name: '森林清晨', background: '#dfe6e9', fog: '#b2bec3', ground: '#636e72', primary: '#00b894', secondary: '#55efc4', accent: '#fdcb6e' },
  { name: '海洋暮色', background: '#0c2461', fog: '#1e3799', ground: '#487eb0', primary: '#4bcffa', secondary: '#0fbcf9', accent: '#f8c291' },
  { name: '极简中性', background: '#f5f6fa', fog: '#dcdde1', ground: '#7f8fa6', primary: '#273c75', secondary: '#718093', accent: '#e1b12c' },
  { name: '霓虹赛博', background: '#0a0a1a', fog: '#1a1a2e', ground: '#16213e', primary: '#e94560', secondary: '#0f3460', accent: '#00fff5' },
]
export const ELEMENT_CATEGORIES = [
  { id: 'ground', label: '地面/环境底', keywords: /地面|floor|ground|海面|grass|Grass|sky|天空|groundSky|roomEnv|cubeEnv|磨砂反射/ },
  { id: 'effect', label: '粒子/特效', keywords: /粒子|火焰|烟花|下雪|喷水|烟|smoke|fire|zhengqi|极光|黑洞|魔法|扩散|彩虹|ice|蜡烛/ },
  { id: 'chart', label: '数据图表', keywords: /chart|Charts|图表|柱状|折线|饼|scatter|radar|拓扑/ },
  { id: 'ui', label: 'UI/标注', keywords: /css2d|css3d|ui-|iframe|热点|警告|亮光|精灵|刻度|2dLink|评分|轮播|表单/ },
  { id: 'geo', label: '地理/地图', keywords: /地球|3dtiles|智慧城市|levelBuild|全景|viewAngle/ },
  { id: 'light_fx', label: '光效/扫描', keywords: /光柱|扫光|雷达|扫描|扩散波/ },
  { id: 'model_fx', label: '模型/展示', keywords: /反射模型|分解|锥子|高斯|人物行走|路径运动|围墙|动态圆墙/ },
  { id: 'physics', label: '物理/交互', keywords: /cannon|物理|eventCall|audio/ },
  { id: 'water', label: '水体/流体', keywords: /宽水流|海面/ },
  { id: 'other', label: '其他组件', keywords: null },
]
export const OBJECT_TYPES_GUIDE = {
  component: { 来源: '左侧面板 addComponent', 识别: '有 designType', 修改: 'setObjectParams(params/uniforms/materials)', 注意: '含 shader/动画逻辑，勿只改 position' },
  mesh: { 来源: 'addMesh 基础几何', 识别: 'editorType=isInnerMesh 或无 designType 的 Mesh', 修改: 'setProps / setMaterial' },
  model: { 来源: 'addModel', 识别: '含 animations 或 GLB/FBX', 修改: 'setProps + playAnimation' },
  light: { 来源: 'addLight / addNativeLight', 识别: 'isLight', 修改: 'setProps / setLightProps' },
  floor: { 来源: '平面或地面组件', 识别: 'isFloorLike 或地面类 designType', 修改: 'placeOnGround 参考；scale 保持正方形', 注意: '决定 recommendedGroundY' },
  group: { 来源: 'createGroup / 组件容器', 识别: 'type=Group', 修改: 'setProps；子物体 getDetail.children' },
}

/** 英文名/易混淆组件：一句话说明真实外观（其余由 core 启发式生成） */
export const COMPONENT_HINTS = {
  ice: '冰晶冰霜 shader 特效面片，不是实心冰块',
  cubeEnv: '立方体环境贴图，影响整场景反射/IBL，不是可见物体',
  cubeEnvMap: '环境立方体贴图容器，用于反射，本身不是模型',
  roomEnv: '室内 HDR 环境，改变场景光照与反射',
  groundSky: '地面渐变+天空一体的环境底，占大面积',
  iframe: '3D 里嵌入网页 iframe 面板',
  '3dtiles模型': '加载 3D Tiles 倾斜摄影/城市瓦片，大体量地理数据',
  高斯点云: '3D Gaussian Splat 点云展示，不是 mesh 模型',
  锥子: '带尖锥的展示用模型组，不是 addMesh 圆锥',
  雷达图: 'ECharts 雷达图数据面板，不是地面扫描特效',
  雷达扫描: '地面圆形扫描扇形动画，像雷达波',
  记录场景视角组件: '保存/切换相机视角书签，不是可见物体',
  组件事件映射: '给组件绑点击等事件，无可视外观',
  动画定位: '相机动画定位辅助，不是场景装饰',
  cannon物理引擎: '开启 Cannon 物理演示，会改变物体运动',
}

/** 简单需求应优先 addMesh 而非误用组件 */
export const MESH_INSTEAD = {
  锥子: '圆锥', 围墙: '多个立方体/平面组合', 球体文字: '球体+需文字时用 runAdvanced',
}

/** 技术美术编辑准则（改前必读 getObject） */
export const SPATIAL_EDIT_GUIDE = 'position 是轴心非底面；改前先读 bounds.bottomY/size；贴地 placeOnGround；平面地面 scale 保持 [S,S,1]'
export const COLOR_EDIT_GUIDE = '改色先看场景 background/fog 与 listResources.palettes 色板，同场景不超过3主色；组件色在 params/uniforms 不在 color'
export const SHADER_EDIT_GUIDE = 'shader/组件：只改 getObject.custom 里已有的 params/uniforms key，一次改一类；禁止盲改 position/color/metalness'
export const EDIT_WORKFLOW = 'editObject 前必须 getObject(id) → 按 editHints 改对应字段 → 改完 focusCamera 确认'

/** 每轮问答的大师思维（先思考再动手） */
export const MASTER_THINKING = `每轮回答前按此顺序思考（回复里用一两句体现，不要空喊口号）：
① 听懂：用户真正想看到/感受到什么？（不是字面堆对象）
② 看见：结合下方场景快照——现在有什么、选中谁、相机能不能看清
③ 选法：用最少步骤、最对的 Three.js 手段（mesh/组件/灯光/环境/shader 参数）
④ 负责：改完用户视口能立刻感到变化吗？需要 focusCamera 吗？阴影/色彩/比例协调吗？
⑤ 说清楚：按 REPLY_FORMAT 回复；不确定先问，绝不瞎改`

/** 每轮回复格式（用户读视口，不读代码） */
export const REPLY_FORMAT = `【理解】一句话：用户要什么效果
【做法】用什么手段、为什么（1-2句，再调工具）
【结果】做完后视口里能看到什么（工具执行后补全；若未做操作则说明原因）`

// 几何/向量工具
export const r = (n) => +n.toFixed(2)
export const v3 = (v) => [r(v.x), r(v.y), r(v.z)]
export const _v = new THREE.Vector3()
export const _e = new THREE.Euler()
export const _box = new THREE.Box3()

