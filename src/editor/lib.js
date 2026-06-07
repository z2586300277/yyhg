// export * from '../../../Vite_three-editor/lib/main'
// export * from '../../../Vite_three-editor/dist/index'
import { ThreeEditor } from 'three-edit-cores'
// 导入外置组件
ThreeEditor.__DESIGNS__.unshift(...Object.values(import.meta.glob('./compoents/\*.js', { eager: true, import: 'default' })))

export * from 'three-edit-cores'