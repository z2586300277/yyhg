<template>
  <div ref="containerRef" class="scene-preview" />
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { ThreeEditor } from '../editor/lib'
import { mapSceneModelUrls, loadIndexDbModelList } from '../editor/sceneModelUrl'
import templateJson from './main.json'

ThreeEditor.dracoPath = __isProduction__ ? '/threejs-editor-beta/draco/' : '/draco/'

const containerRef = ref(null)
let editor = null
let onResize = null

const saved = localStorage.getItem('yyhg_main-newEditor')
if (!saved) {
  localStorage.setItem('yyhg_main-newEditor', JSON.stringify(templateJson))
  localStorage.setItem('new_sceneName', 'yyhg_main')
  const newSceneList = localStorage.getItem('new_sceneList')
  if (!newSceneList) localStorage.setItem('new_sceneList', '[{"name":"三维测试"},{"name":"yyhg_main"}]')
  else {
    const list = JSON.parse(newSceneList)
    if (!list.find(i => i.name === 'yyhg_main')) {
      list.push({ name: 'yyhg_main' })
      localStorage.setItem('new_sceneList', JSON.stringify(list))
    }
  }
}

let json = saved ? JSON.parse(saved) : templateJson

async function init() {
  const el = containerRef.value
  if (Array.isArray(json?.modelCores) && json.modelCores.length) {
    try {
      const modelList = await loadIndexDbModelList()
      mapSceneModelUrls(json, modelList, [])
    } catch { }
  }

  editor = new ThreeEditor(el, {
    fps: null,
    pixelRatio: window.devicePixelRatio * 1.5,
    webglRenderParams: { antialias: true, alpha: true, logarithmicDepthBuffer: true },
    sceneParams: json,
  })
  editor.handler.mode = 'none'
  editor.handler.rightClickMenusEnable = false
  window.editor = editor
  window.threeEditor = editor

  onResize = () => editor?.renderSceneResize?.()
  window.addEventListener('resize', onResize)
}

onMounted(init)
onUnmounted(() => {
  if (onResize) window.removeEventListener('resize', onResize)
  editor?.destroySceneRender()
})
</script>

<style lang="less" scoped>
.scene-preview {
  position: absolute;
  inset: 0;
}
</style>
