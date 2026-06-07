import { createRouter, createWebHashHistory } from 'vue-router'
import layout from './layout.vue'
import editor from './editor/index.vue'

const routes = [
  {
    path: '',
    component: layout,
    redirect: '/home',
    children: [
      {
        name: 'editor',
        path: '/editor',
        component: editor,
      },
      {
        name: 'home',
        path: '/home',
        component: () => import('./home/index.vue'),
      },
    ],
  },
]

routes.push({ path: '/:pathMatch(.*)*', redirect: '/' })

const router = createRouter({ history: createWebHashHistory(), routes })

export default router
