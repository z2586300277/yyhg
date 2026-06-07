<template>
  <Panel title="此项目投入人力 1建模 + 1前端 2000元 3天交付">
    <MetricGrid :items="factoryInfo" :active-index="activeIndex" />
  </Panel>

  <Panel title="项目种类统计">
    <div ref="chartRef" class="chart" />
  </Panel>

  <Panel title="人才都是通过github开源社区吸收的行业技术大佬">
    <MetricGrid :items="lineInfo" />
  </Panel>
</template>

<script setup>
import { onMounted, onUnmounted, nextTick, ref } from 'vue'
import Panel from './Panel.vue'
import MetricGrid from './MetricGrid.vue'
import { useEcharts } from './echarts.js'

const activeIndex = ref(0)
const factoryInfo = [
  { label: '企业名称', value: '北京优悦幻光科技', type: 'text' },
  { label: '核心业务', value: '数字孪生三维可视化', type: 'text' },
  { label: '能力范围', value: 'Web端、移动端', type: 'text' },

  { label: '人才储备', value: '行业领域顶级开源人才', type: 'text' },
  { label: '开发成本', value: '低至2000元', type: 'text' },
  { label: '交付周期', value: '最长不超过3天', type: 'text' },
  { label: '联系方式', value: '微信：z2586300277', type: 'text' },

  { label: '服务方式', value: '项目 | 人力', type: 'text' },
  { label: 'github三维开源社区', value: '国内web3D专业领域认证', type: 'text' },
]
const lineInfo = [
  { label: '三维领域专业人才', value: '99+', unit: '人' },
  { label: '开源编辑器', value: '生态强大、开源免费', type: 'text' },
  { label: '前沿科技', value: '国内首款开源Ai编辑器', type: 'text' },
  { label: '人才能力', value: '知名开源代表作', type: 'text' },
  { label: '为企业招贤纳士', value: '量身定制项目匹配人才', type: 'text'},
  { label: '技术支持', value: '专业的解决方案', type: 'text' },
  { label: '影响力', value: '人员在业界拥有知名度', type: 'text' },
  { label: '打通行业通道', value: '让人才和企业合作共赢', type: 'text' },
  { label: '欢迎技术开发者加入', value: '微信：z2586300277', type: 'text' },
]

const { container: chartRef, echarts, setOption, chartTheme, barGradient } = useEcharts()

function buildProductChartOption() {
  const bar = (top, bottom) => ({
    color: barGradient(echarts, top, bottom),
    borderRadius: [2, 2, 0, 0],
  })
  return {
    textStyle: chartTheme.textStyle,
    legend: { ...chartTheme.legend, show: true, right: 0, top: 0 },
    tooltip: chartTheme.tooltip,
    grid: { ...chartTheme.grid, top: '20%', bottom: '4%' },
    xAxis: {
      type: 'category',
      ...chartTheme.categoryAxis,
      axisLabel: { ...chartTheme.categoryAxis.axisLabel, interval: 0, rotate: 24 },
      data: ['智慧城市', '数字园区', '运维监控', '工艺流程', '物流仓储', '工业安全'],
    },
    yAxis: { type: 'value', name: '数量(次)', ...chartTheme.valueAxis, nameGap: 8 },
    series: [
      {
        name: '项目交付',
        type: 'bar',
        data: [320, 280, 250, 220, 195, 168],
        barWidth: 10,
        barGap: '40%',
        itemStyle: bar(chartTheme.colors.primary, chartTheme.colors.primaryFade),
      },
      {
        name: '技术支持',
        type: 'bar',
        data: [280, 260, 230, 210, 188, 155],
        barWidth: 10,
        itemStyle: bar(chartTheme.colors.secondary, chartTheme.colors.secondaryFade),
      },
    ],
  }
}

let highlightTimer
onMounted(() => {
  highlightTimer = setInterval(() => {
    activeIndex.value = (activeIndex.value + 1) % factoryInfo.length
  }, 1500)
  nextTick(() => setOption(buildProductChartOption()))
})
onUnmounted(() => clearInterval(highlightTimer))
</script>

<style lang="less" scoped>
.chart {
  flex: 1;
  min-height: 0;
}
</style>
