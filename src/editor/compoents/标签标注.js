import * as THREE from 'three'
import gsap from 'gsap'
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { ElMessage } from 'element-plus'
import { getObjectViews } from '../lib'

const STYLE_ID = 'tag-label-style-v1'

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .tag-label-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      pointer-events: auto;
      cursor: default;
      font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
    }
    .tag-label {
      display: inline-flex;
      align-items: stretch;
      user-select: none;
      filter: drop-shadow(0 0 14px rgba(55, 160, 255, 0.5));
    }
    .tag-label-icon {
      flex: 0 0 auto;
      width: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px 0 0 8px;
      border: 1px solid rgba(130, 210, 255, 0.55);
      border-right: none;
      background: linear-gradient(180deg, #3da3ff 0%, #1a6fd4 100%);
      box-shadow: inset 0 0 12px rgba(180, 230, 255, 0.25);
    }
    .tag-label-icon svg {
      width: 22px;
      height: 22px;
      display: block;
    }
    .tag-label-text {
      display: flex;
      align-items: center;
      padding: 8px 16px 8px 12px;
      min-height: 40px;
      box-sizing: border-box;
      white-space: nowrap;
      font-size: var(--tag-font-size, 18px);
      font-weight: 700;
      font-style: italic;
      color: #ffffff;
      letter-spacing: 0.06em;
      text-shadow: 0 0 10px rgba(120, 200, 255, 0.45);
      border-radius: 0 8px 8px 0;
      border: 1px solid rgba(110, 190, 255, 0.42);
      border-left: none;
      background: linear-gradient(
        90deg,
        rgba(28, 110, 190, 0.82) 0%,
        rgba(18, 72, 140, 0.62) 100%
      );
      backdrop-filter: blur(6px);
      cursor: pointer;
    }
    .tag-label-stem {
      width: 2px;
      height: 10px;
      margin-top: 2px;
      background: linear-gradient(180deg, rgba(80, 170, 255, 0.85), rgba(45, 130, 220, 0.5));
      box-shadow: 0 0 6px rgba(70, 160, 255, 0.45);
    }
    .tag-label-arrow {
      width: 0;
      height: 0;
      border-left: 9px solid transparent;
      border-right: 9px solid transparent;
      border-top: 12px solid #3da3ff;
      filter: drop-shadow(0 2px 8px rgba(55, 160, 255, 0.65));
    }
    .tag-label-editor {
      display: none;
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
      min-width: 200px;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid rgba(110, 190, 255, 0.5);
      background: linear-gradient(155deg, rgba(12, 28, 48, 0.96), rgba(8, 18, 32, 0.94));
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
      backdrop-filter: blur(8px);
    }
    .tag-label-editor.is-open {
      display: flex;
    }
    .tag-label-input {
      pointer-events: auto;
      width: 100%;
      box-sizing: border-box;
      padding: 8px 10px;
      border-radius: 6px;
      border: 1px solid rgba(120, 200, 255, 0.45);
      background: rgba(6, 16, 28, 0.9);
      color: #eaf6ff;
      font-size: 15px;
      font-weight: 600;
      outline: none;
    }
    .tag-label-input:focus {
      border-color: rgba(90, 180, 255, 0.85);
      box-shadow: 0 0 0 2px rgba(61, 163, 255, 0.25);
    }
    .tag-label-editor-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .tag-label-btn {
      pointer-events: auto;
      padding: 5px 12px;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
      color: #fff;
    }
    .tag-label-btn-save {
      background: linear-gradient(180deg, #3da3ff, #1a6fd4);
    }
    .tag-label-btn-cancel {
      background: rgba(80, 90, 110, 0.75);
    }
  `
  document.head.appendChild(style)
}

const LAYERS_SVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M4 8h16v3H4V8zm0 5h16v3H4v-3zm0 5h10v3H4v-3z" fill="#ffffff"/>
</svg>`

function persistScene() {
  const editor = window.threeEditor
  if (!editor?.saveSceneEdit) return
  const sceneName = localStorage.getItem('new_sceneName')
  if (!sceneName) return
  localStorage.setItem(sceneName + '-newEditor', JSON.stringify(editor.saveSceneEdit()))
}

function getEditor() {
  return window.threeEditor || window.editor || null
}

function isPreviewMode() {
  return getEditor()?.handler?.mode === 'none'
}

function isFiniteVec(v) {
  return v && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z)
}

/** CSS2D 无包围盒时，用锚点世界坐标计算机位 */
function resolveTagCameraFrame(mesh, camera) {
  const saved = mesh.userData.params?.view
  if (saved?.position?.length === 3 && saved?.target?.length === 3) {
    const [px, py, pz] = saved.position
    const [tx, ty, tz] = saved.target
    return {
      maxView: { x: px, y: py, z: pz },
      target: { x: tx, y: ty, z: tz },
    }
  }

  try {
    const views = getObjectViews(mesh, camera)
    if (isFiniteVec(views?.maxView) && isFiniteVec(views?.target)) {
      return { maxView: views.maxView, target: views.target }
    }
  } catch {
    /* CSS2D 常无有效包围盒，走锚点回退 */
  }

  const anchor = new THREE.Vector3()
  mesh.getWorldPosition(anchor)

  const dist = Math.max(camera.position.distanceTo(anchor) * 0.45, 14)
  const dir = new THREE.Vector3()
  camera.getWorldDirection(dir)
  dir.normalize().negate()

  const maxView = anchor.clone().add(dir.multiplyScalar(dist))
  maxView.y += dist * 0.22

  return {
    maxView: { x: maxView.x, y: maxView.y, z: maxView.z },
    target: { x: anchor.x, y: anchor.y, z: anchor.z },
  }
}

function flyToTagView(mesh) {
  const editor = getEditor()
  const controls = editor?.controls
  const camera = controls?.object ?? editor?.camera
  if (!camera || !controls) return

  const frame = resolveTagCameraFrame(mesh, camera)
  if (!frame) return

  const tweenOpts = {
    duration: 0.9,
    ease: 'power2.inOut',
    onUpdate: () => controls.update?.(),
  }

  gsap.to(camera.position, {
    ...tweenOpts,
    x: frame.maxView.x,
    y: frame.maxView.y,
    z: frame.maxView.z,
  })
  gsap.to(controls.target, {
    ...tweenOpts,
    x: frame.target.x,
    y: frame.target.y,
    z: frame.target.z,
  })
}

export default {
  name: '标签标注',
  label: '标签标注',

  create(storage, editorCtx = {}, cores) {
    const c = cores ?? editorCtx
    const transformControls = c?.transformControls

    ensureStyle()

    const params = {
      text: storage?.text ?? '三楼机房',
      fontSize: storage?.fontSize ?? '18px',
      iconColor: storage?.iconColor ?? '#ffffff',
      view: storage?.view ?? null,
    }

    const wrap = document.createElement('div')
    wrap.className = 'tag-label-wrap'

    const pill = document.createElement('div')
    pill.className = 'tag-label'

    const iconBox = document.createElement('div')
    iconBox.className = 'tag-label-icon'
    iconBox.innerHTML = LAYERS_SVG

    const textEl = document.createElement('div')
    textEl.className = 'tag-label-text'
    textEl.textContent = params.text
    textEl.style.setProperty('--tag-font-size', params.fontSize)

    pill.append(iconBox, textEl)

    const stem = document.createElement('div')
    stem.className = 'tag-label-stem'

    const arrow = document.createElement('div')
    arrow.className = 'tag-label-arrow'
    arrow.title = '单击可移动位置'

    const editorBox = document.createElement('div')
    editorBox.className = 'tag-label-editor'
    const input = document.createElement('input')
    input.className = 'tag-label-input'
    input.type = 'text'
    input.maxLength = 64
    const actions = document.createElement('div')
    actions.className = 'tag-label-editor-actions'
    const saveBtn = document.createElement('button')
    saveBtn.type = 'button'
    saveBtn.className = 'tag-label-btn tag-label-btn-save'
    saveBtn.textContent = '保存'
    const cancelBtn = document.createElement('button')
    cancelBtn.type = 'button'
    cancelBtn.className = 'tag-label-btn tag-label-btn-cancel'
    cancelBtn.textContent = '取消'
    actions.append(saveBtn, cancelBtn)
    editorBox.append(input, actions)

    wrap.append(pill, stem, arrow, editorBox)

    const mesh = new CSS2DObject(wrap)
    mesh.name = String(storage?.name || params.text)
    params.text = mesh.name
    textEl.textContent = mesh.name
    mesh.userData.params = params

    const syncText = (name) => {
      const t = String(name || params.text).trim() || '标签'
      mesh.name = t
      params.text = t
      textEl.textContent = t
    }

    const setEditMode = (open) => {
      params.editMode = open
      pill.style.display = open ? 'none' : 'inline-flex'
      stem.style.display = open ? 'none' : 'block'
      arrow.style.display = open ? 'none' : 'block'
      editorBox.classList.toggle('is-open', open)
      if (open) {
        input.value = mesh.name || params.text
        requestAnimationFrame(() => {
          input.focus()
          input.select()
        })
      }
    }

    const saveLabel = () => {
      const next = input.value.trim()
      if (!next) {
        ElMessage.warning('标签内容不能为空')
        return
      }
      syncText(next)
      setEditMode(false)
      persistScene()
      ElMessage.success('标签已保存')
    }

    const cancelEdit = () => {
      setEditMode(false)
    }

    saveBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      saveLabel()
    })
    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      cancelEdit()
    })
    input.addEventListener('keydown', (e) => {
      e.stopPropagation()
      if (e.key === 'Enter') saveLabel()
      if (e.key === 'Escape') cancelEdit()
    })
    input.addEventListener('click', (e) => e.stopPropagation())

    const tryFlyInPreview = () => {
      if (!isPreviewMode() || params.editMode) return false
      flyToTagView(mesh)
      return true
    }

    const onLabelClick = (e) => {
      e.stopPropagation()
      tryFlyInPreview()
    }

    wrap.addEventListener('click', onLabelClick)
    pill.addEventListener('click', onLabelClick)

    pill.addEventListener('dblclick', (e) => {
      e.stopPropagation()
      if (isPreviewMode()) return
      setEditMode(true)
    })

    arrow.addEventListener('click', (e) => {
      e.stopPropagation()
      if (tryFlyInPreview()) return
      transformControls?.attach?.(mesh)
    })

    mesh.EVENTCALL = () => {
      tryFlyInPreview()
    }

    return mesh
  },

  getStorage(mesh) {
    const params = mesh.userData.params || {}
    return { ...params, text: mesh.name || params.text }
  },
}
