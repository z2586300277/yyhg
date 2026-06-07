import { onUnmounted, ref, shallowRef } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart, LineChart } from 'echarts/charts'
import { TooltipComponent, GridComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([TooltipComponent, LegendComponent, GridComponent, BarChart, LineChart, CanvasRenderer])

export const chartTheme = {
  textStyle: { color: '#d6e8ff', fontFamily: 'Consolas, "Courier New", monospace', fontSize: 12 },
  legend: { itemWidth: 12, itemHeight: 8, textStyle: { color: '#d6e8ff', fontSize: 12, fontWeight: 500 } },
  tooltip: {
    trigger: 'axis',
    backgroundColor: 'rgba(8, 40, 88, 0.95)',
    borderColor: 'rgba(94, 235, 240, 0.45)',
    borderWidth: 1,
    textStyle: { color: '#fff', fontSize: 13 },
  },
  grid: { left: '2%', right: '2%', bottom: '2%', top: '22%', containLabel: true },
  categoryAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: '#b8d9ff', fontSize: 12, margin: 10, fontWeight: 500 },
  },
  valueAxis: {
    axisLabel: { color: '#b8d9ff', fontSize: 12, fontWeight: 500 },
    nameTextStyle: { color: '#5eebf0', fontSize: 12, fontWeight: 600, padding: [0, 0, 6, 0] },
    splitLine: { lineStyle: { color: 'rgba(158, 202, 255, 0.18)', type: 'dashed' } },
  },
  colors: {
    primary: '#00ffb0',
    primaryFade: 'rgba(0, 255, 176, 0.1)',
    secondary: '#6eb5ff',
    secondaryFade: 'rgba(110, 181, 255, 0.1)',
    areaTop: 'rgba(0, 255, 176, 0.42)',
    areaBottom: 'rgba(0, 255, 176, 0)',
  },
}

export function barGradient(instance, top, bottom) {
  return new instance.graphic.LinearGradient(0, 0, 0, 1, [
    { offset: 0, color: top },
    { offset: 1, color: bottom },
  ])
}

export function useEcharts() {
  const container = ref()
  const chart = shallowRef()

  const resize = () => chart.value?.resize()

  const setOption = (option) => {
    const el = container.value
    if (!chart.value && el instanceof HTMLElement) {
      chart.value = echarts.init(el, null, { renderer: 'canvas' })
      window.addEventListener('resize', resize)
    }
    chart.value?.setOption({ backgroundColor: 'transparent', ...option })
  }

  onUnmounted(() => {
    window.removeEventListener('resize', resize)
    chart.value?.dispose()
  })

  return { container, setOption, echarts, chartTheme, barGradient }
}
