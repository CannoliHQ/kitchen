import { createRouter, createWebHistory } from 'vue-router'
import { isAuthenticated, restoreCredentials, setUnauthorizedHandler } from '@/api/client'
import LoginView from '@/views/LoginView.vue'
import DashboardView from '@/views/DashboardView.vue'
import PlatformView from '@/views/PlatformView.vue'
import BrowseView from '@/views/BrowseView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'login', component: LoginView },
    { path: '/dashboard', name: 'dashboard', component: DashboardView },
    { path: '/platform/:tag', name: 'platform', component: PlatformView, props: true },
    { path: '/browse/:resource/:tag', name: 'browse', component: BrowseView, props: true },
    { path: '/browse/:resource', name: 'browse-flat', component: BrowseView, props: true },
  ],
})

router.beforeEach((to) => {
  if (to.name !== 'login' && !isAuthenticated()) {
    if (!restoreCredentials()) {
      return { name: 'login' }
    }
  }
})

setUnauthorizedHandler(() => {
  router.push({ name: 'login' })
})

export default router
