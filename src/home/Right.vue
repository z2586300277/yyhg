<template>
  <Panel title="平台运行状态">
    <ScrollList :list="lineStatusList" :interval="2800" />
  </Panel>

  <Panel title="资源负载">
    <div ref="chartRef" class="chart" />
  </Panel>

  <Panel title="告警监测">
    <ScrollList :list="qcList" :interval="3000" :start-delay="1400" qc />
  </Panel>
</template>

<script setup>
import { onMounted, nextTick, ref } from 'vue'
import Panel from './Panel.vue'
import ScrollList from './ScrollList.vue'
import { useEcharts } from './echarts.js'

const lineStatusList = ref([
  { id: 'nav-1', label: '渲染引擎集群', value: '运行中', status: 1, time: '06/01 14:32' },
  { id: 'nav-2', label: '数据中台服务', value: '运行中', status: 1, time: '06/01 14:32' },
  { id: 'nav-3', label: '模型加载服务', value: '待扩容', status: 0, time: '06/01 14:32' },
  { id: 'nav-4', label: 'AI导航助手', value: '运行中', status: 1, time: '06/01 14:32' },
  { id: 'nav-5', label: '地图切片服务', value: '已同步', status: 1, time: '06/01 14:32' },
  { id: 'nav-6', label: '场景帧率', value: '58FPS', status: 1, time: '06/01 14:32' },
  { id: 'nav-7', label: '接口延迟', value: '42ms', status: 1, time: '06/01 14:32' },
  { id: 'nav-8', label: 'GPU显存占用', value: '78%', status: 0, time: '06/01 14:32' },
  { id: 'nav-9', label: '消息队列积压', value: '正常', status: 1, time: '06/01 14:32' },
  { id: 'nav-10', label: '模型热更新', value: '成功', status: 1, time: '06/01 14:32' },
  { id: 'nav-11', label: '巡检任务完成率', value: '92.3%', status: 1, time: '06/01 14:32' },
  { id: 'nav-12', label: '安全审计状态', value: '合规', status: 1, time: '06/01 14:32' },
  { id: 'nav-13', label: '备份任务状态', value: '已完成', status: 1, time: '06/01 14:32' },
])
const qcList = ref([
  { id: 'qc-1', name: '数据完整性', value: '99.98%', status: 1, time: '06/01 08:15' },
  { id: 'qc-2', name: '接口健康度', value: '10/10', status: 1, time: '06/01 08:18' },
  { id: 'qc-3', name: '模型资源校验', value: '通过', status: 1, time: '06/01 08:21' },
  { id: 'qc-4', name: '渲染耗时告警', value: '3.5倍', status: 0, time: '06/01 08:25' },
  { id: 'qc-5', name: '权限策略校验', value: '100%', status: 1, time: '06/01 08:28' },
  { id: 'qc-6', name: '热更新回归', value: '通过', status: 1, time: '06/01 08:31' },
  { id: 'qc-7', name: '链路时延巡检', value: '合格', status: 1, time: '06/01 08:34' },
  { id: 'qc-8', name: 'GPU波动监测', value: '异常', status: 0, time: '06/01 08:38' },
])

const { container: chartRef, echarts, setOption, chartTheme } = useEcharts()

onMounted(() => {
  nextTick(() => {
    setOption({
      textStyle: chartTheme.textStyle,
      legend: { ...chartTheme.legend, data: ['CPU负载', '带宽吞吐'], show: true, right: 0, top: 0 },
      tooltip: chartTheme.tooltip,
      grid: { ...chartTheme.grid, top: '30%', bottom: '4%' },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        ...chartTheme.categoryAxis,
        axisLabel: { ...chartTheme.categoryAxis.axisLabel, interval: 1 },
        data: ['08:00', '12:00', '16:00', '20:00', '00:00', '08:00', '16:00', '24:00'],
      },
      yAxis: [
        { name: 'CPU %', type: 'value', min: 20, max: 95, ...chartTheme.valueAxis, nameGap: 6 },
        { name: 'Mbps', type: 'value', min: 200, max: 500, ...chartTheme.valueAxis, nameGap: 6, splitLine: { show: false } },
      ],
      series: [
        {
          name: 'CPU负载',
          type: 'line',
          data: [62, 68, 64, 58, 54, 71, 75, 66],
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 3, color: chartTheme.colors.primary },
          itemStyle: { color: chartTheme.colors.primary },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: chartTheme.colors.areaTop },
              { offset: 1, color: chartTheme.colors.areaBottom },
            ]),
          },
        },
        {
          name: '带宽吞吐',
          type: 'line',
          yAxisIndex: 1,
          data: [360, 410, 345, 300, 280, 420, 438, 372],
          symbol: 'diamond',
          symbolSize: 7,
          lineStyle: { width: 3, color: chartTheme.colors.secondary },
          itemStyle: { color: chartTheme.colors.secondary },
        },
      ],
    })
  })
})
</script>

<style lang="less" scoped>
.chart {
  flex: 1;
  min-height: 0;
}
</style>
