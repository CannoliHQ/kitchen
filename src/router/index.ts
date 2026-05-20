import { createRouter, createWebHistory } from 'vue-router'
import { isAuthenticated, restoreCredentials, setUnauthorizedHandler, setConnectionErrorHandler } from '@/api/client'
import LoginView from '@/views/LoginView.vue'
import DashboardView from '@/views/DashboardView.vue'
import PlatformView from '@/views/PlatformView.vue'
import BrowseView from '@/views/BrowseView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'login', component: LoginView },
    { path: '/dashboard/:tab?', name: 'dashboard', component: DashboardView, props: true },
    { path: '/platform/:tag', name: 'platform', component: PlatformView, props: true },
    {
      path: '/platform/:tag/game/:id/:tab?',
      name: 'game',
      component: () => import('@/views/GameDetailView.vue'),
      props: true,
    },
    { path: '/browse/:resource/:tag', name: 'browse', component: BrowseView, props: true },
    { path: '/browse/:resource', name: 'browse-flat', component: BrowseView, props: true },
  ],
})

router.beforeEach((to) => {
  if (to.name !== 'login' && !isAuthenticated()) {
    if (!restoreCredentials()) {
      return { name: 'login', query: { redirect: to.fullPath } }
    }
  }
})

setUnauthorizedHandler(() => {
  const current = router.currentRoute.value
  if (current.name === 'login') return
  router.push({ name: 'login', query: { redirect: current.fullPath } })
})

setConnectionErrorHandler(() => {
  const current = router.currentRoute.value
  if (current.name === 'login') return
  router.push({ name: 'login', query: { error: 'connection', redirect: current.fullPath } })
})

export default router
