/**
 * AI 模块入口（对外仍 import from './ai'）
 *
 *   config.js  L0  常量 / 资源表
 *   core.js    L1-L3  editorActions + 场景实现 + 全量工具(60+)
 *   policy.js  安全策略（危险操作守卫）
 *   runtime.js 大模型运行时（单文件：意图/提示词/工具/执行编排）
 *   chat.js    对外兼容层（配置/历史/布局 + runtime 入口）
 *
 * 数据流: aiPanel → chatWithSceneAi → runtime(LLM) → createSceneTools → core.* → ThreeEditor
 */
export * from './config.js'
export * from './core.js'
export * from './chat.js'
