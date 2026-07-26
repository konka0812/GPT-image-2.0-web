import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import axios from 'axios'
import './style.css'
import App from './App.vue'
import Login from './views/Login.vue'
import Generate from './views/Generate.vue'
import EditImage from './views/EditImage.vue'
import ReferenceGenerate from './views/ReferenceGenerate.vue'
import BatchEdit from './views/BatchEdit.vue'
import History from './views/History.vue'
import Settings from './views/Settings.vue'

axios.defaults.baseURL = ''
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/generate' },
    { path: '/login', component: Login },
    { path: '/generate', component: Generate },
    { path: '/edit', component: EditImage },
    { path: '/reference', component: ReferenceGenerate },
    { path: '/batch-edit', component: BatchEdit },
    { path: '/history', component: History },
    { path: '/settings', component: Settings }
  ]
})

router.beforeEach((to) => {
  if (to.path !== '/login' && !localStorage.getItem('token')) return '/login'
})

createApp(App).use(router).mount('#app')
