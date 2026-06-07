<template>
  <div class="home">
    <div class="scene-layer">
      <ScenePreview />
      <div class="scene-vignette" aria-hidden="true" />
    </div>

    <header class="header">
      <div class="header-center">
        <div class="cn">北京优悦幻光三维可视化平台</div>
        <div class="en">Beijing Youyue Huanguang 3D Visualization Platform</div>
      </div>
      <div class="header-left">
        <span class="notice">通知</span>
        <div class="message" data-text="【系统通知】北京优悦幻光三维可视化平台已完成升级并稳定运行" />
      </div>
      <div class="header-right">
        <span>{{ clock.time }}</span>
        <span>{{ clock.date }}</span>
        <span>{{ clock.week }}</span>
        <span>13°c</span>
      </div>
    </header>

    <main class="main">
      <aside class="side left"><Left /></aside>
      <aside class="side right"><Right /></aside>
    </main>

    <HomeAiPanel />

    <footer class="footer">
      <div class="footer-bg" aria-hidden="true" />
      <div class="footer-actions">
        <button
          v-for="btn in footerButtons"
          :key="btn.id"
          type="button"
          class="footer-btn"
          :class="{ active: activeFooterBtn === btn.id }"
          @click="onFooterClick(btn.id)"
        >
          {{ btn.label }}
        </button>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'
import Left from './Left.vue'
import Right from './Right.vue'
import ScenePreview from './ScenePreview.vue'
import HomeAiPanel from './HomeAiPanel.vue'
import { createGsapAnimation } from '../editor/lib'

const roam = { on: false, t: 0, curve: null, listener: null }

function startRouteRoam() {
  const ed = window.editor
  const route = ed?.scene?.getObjectByName('漫游路线')
  const pts = route?.drawParams?.points
  if (!pts?.length) return

  roam.curve = new THREE.CatmullRomCurve3(
    pts.map((p) => new THREE.Vector3(p.x, p.y, p.z)).reverse(),
    !!route.drawParams?.closed,
  )
  roam.t = 0
  roam.on = true

  if (roam.listener) return
  roam.listener = () => {
    if (!roam.on || !roam.curve) return
    const editor = window.editor
    if (!editor) return
    roam.t = (roam.t + 0.00035) % 1
    const pos = roam.curve.getPointAt(roam.t)
    const next = roam.curve.getPointAt((roam.t + 0.008) % 1)
    const cam = editor.controls.object ?? editor.camera
    const h = 20
    cam.position.set(pos.x, pos.y + h, pos.z)
    editor.controls.target.set(next.x, pos.y + h - 2, next.z)
    editor.controls.update?.()
  }
  ed.scene.addUpdateListener(roam.listener)
}

function stopRouteRoam() {
  roam.on = false
}

const footerButtons = [
  { id: 'alarm', label: '全局视角' },
  { id: 'roam', label: '场景漫游' },
  { id: 'inRoom', label: '进入核心区' },
]
const activeFooterBtn = ref('alarm')

function onFooterClick(id) {
  if (id === 'roam' && roam.on) {
    stopRouteRoam()
    activeFooterBtn.value = 'alarm'
    return
  }
  activeFooterBtn.value = id

  const {scene, camera, controls } = window.editor
  if (id === 'alarm') {
    stopRouteRoam()
    const data = window.editor.other.viewAngleList.find((v) => v.name === '初始视角')
    createGsapAnimation(window.editor.camera.position, data.position, { duration: 0.5 })
    createGsapAnimation(window.editor.controls.target, data.target, { duration: 0.5 })
    camera.near = 0.1
      // 隐藏名称 匹配到 标注 摄像头 以外的对象
    scene?.children.forEach((obj) => {
      if (obj.name.includes('设备') || obj.name.includes('摄像头')) obj.visible = false
        if (obj.name.includes('厂房')) obj.visible = true
    })

  }
  else if (id === 'inRoom') {
    
      const data = window.editor.other.viewAngleList.find((v) => v.name === '车间视角')
      createGsapAnimation(window.editor.camera.position, data.position, { duration: 1 })
      createGsapAnimation(window.editor.controls.target, data.target, { duration: 1 })
      setTimeout(() => {
        camera.near = 25
          // 隐藏 厂房 以外的对象
        scene?.children.forEach((obj) => {
          if (obj.name.includes('厂房')) obj.visible = false
          if (obj.name.includes('设备') || obj.name.includes('摄像头')) obj.visible = true
        })
      }, 1500)
  } 
  
  else {
    startRouteRoam()
  }
}

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
const pad = (n) => String(n).padStart(2, '0')
const clock = reactive({ time: '--:--:--', date: '--/--/--', week: '--' })

function tick() {
  const now = new Date()
  clock.time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  clock.date = `${pad(now.getMonth() + 1)}/${pad(now.getDate())}/${now.getFullYear()}`
  clock.week = WEEKDAYS[now.getDay()]
}

let timer
onMounted(() => {
  tick()
  timer = setInterval(tick, 1000)
})
onUnmounted(() => {
  clearInterval(timer)
  stopRouteRoam()
})
</script>

<style lang="less" scoped>
.home {
  --font-title: 'Microsoft YaHei', 'PingFang SC', sans-serif;
  --font-data: Consolas, 'Courier New', monospace;

  /* 色彩 */
  --color-label: #9ecaff;
  --color-value: #ffffff;
  --color-unit: #7eb8ff;
  --color-accent: #5eebf0;
  --color-success: #62ffbe;
  --color-warning: #ffab7a;
  --color-time: #8bb8e8;
  --color-panel-title: #e8f2ff;

  --text-xs: 12px;
  --text-sm: 13px;
  --text-base: 15px;
  --text-md: 17px;

  position: relative;
  width: 100%;
  height: 100%;
  min-height: 100dvh;
  overflow: hidden;
  font-family: var(--font-data);
  background: #020810;
  color: var(--color-value);
}

.header {
  position: absolute;
  top: 0;
  z-index: 1000;
  display: flex;
  width: 100%;
  height: 80px;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  background: url('./assets/images/title_bg.png') center top / 100% 100% no-repeat;

  &::after {
    content: '';
    position: absolute;
    bottom: -55px;
    left: 500px;
    width: 500px;
    height: 100px;
    background: url('./assets/images/light_bg.png') contain no-repeat;
    animation: light-go 3s ease-in-out infinite;
  }

  .header-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    font-family: var(--font-title);

    .cn {
      font-size: 30px;
      font-weight: 600;
      letter-spacing: 0.08em;
      white-space: nowrap;
      color: #f0f6ff;
      text-shadow: 0 0 24px rgba(158, 202, 255, 0.35);
    }

    .en {
      margin-top: 4px;
      font-size: 10px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      white-space: nowrap;
      color: #9ecaff;
    }
  }

  .header-left {
    position: absolute;
    left: 30px;
    top: 20px;
    display: flex;
    gap: 6px;
    align-items: center;
    color: #fff;

    .notice {
      font-size: var(--text-base);
      font-weight: 600;
      color: var(--color-accent);
    }

    .message::after {
      content: attr(data-text);
      animation: text-roll 20s linear infinite;
      font-size: var(--text-sm);
      color: #d6e8ff;
    }
  }

  .header-right {
    position: absolute;
    right: 30px;
    top: 20px;
    display: flex;
    gap: 20px;
    font-size: var(--text-md);
    font-weight: 600;

    span {
      position: relative;
      color: #e8f2ff;

      &:not(:last-child)::after {
        content: '';
        position: absolute;
        right: -10px;
        width: 2px;
        height: 10px;
        background: #fff;
        opacity: 0.2;
      }
    }
  }
}

.scene-layer {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: auto;
  background: #020810 url('./assets/images/backgroud.jpg') center / cover no-repeat;
}

.scene-vignette {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    radial-gradient(ellipse at center, transparent 45%, rgba(2, 8, 16, 0.35) 100%),
    linear-gradient(180deg, rgba(2, 8, 16, 0.45) 0, transparent 80px, transparent calc(100% - 96px), rgba(2, 8, 16, 0.5) 100%);
}

.main {
  position: absolute;
  inset: 0;
  z-index: 1000;
  pointer-events: none;

  .side {
    position: absolute;
    top: 80px;
    bottom: 0;
    display: grid;
    grid-template-rows: repeat(3, minmax(0, 1fr));
    gap: 20px;
    width: 460px;
    height: auto;
    padding-bottom: 12px;
    pointer-events: auto;
  }

  .left { left: 10px; }
  .right { right: 10px; }
}

@keyframes text-roll {
  from { transform: translateX(0); }
  to { transform: translateX(-100%); }
}

@keyframes light-go {
  from { left: 500px; opacity: 1; }
  to { left: 1100px; opacity: 0; }
}

/* 底部浮层 */
.footer {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1001;
  height: 96px;
  pointer-events: none;
}

.footer-bg {
  position: absolute;
  bottom: 0;
  left: 50%;
  width: min(960px, 82vw);
  height: 100%;
  background: url('./assets/images/footor.png') center bottom / contain no-repeat;
  transform: translateX(-50%);
}

.footer-actions {
  position: absolute;
  bottom: 16px;
  left: 50%;
  display: flex;
  gap: 28px;
  align-items: center;
  pointer-events: auto;
  transform: translateX(-50%);
}

.footer-btn {
  min-width: 148px;
  height: 46px;
  padding: 0 28px;
  border: none;
  background: url('./assets/images/button.png') center / 100% 100% no-repeat;
  font-family: var(--font-title);
  font-size: var(--text-base);
  font-weight: 600;
  letter-spacing: 0.08em;
  color: #d6e8ff;
  white-space: nowrap;
  cursor: pointer;
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), filter 0.25s ease;

  &:hover {
    filter: brightness(1.12);
    transform: translateY(-2px);
  }

  &:active {
    transform: translateY(0) scale(0.98);
  }

  &.active {
    color: var(--color-accent);
    filter: brightness(1.2);
    text-shadow: 0 0 10px rgba(94, 235, 240, 0.45);
  }
}
</style>
