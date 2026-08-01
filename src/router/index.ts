import { createRouter, createWebHistory } from 'vue-router'
import { isAuthenticated, restoreCredentials, setUnauthorizedHandler, setConnectionErrorHandler } from '@/api/client'
import LoginView from '@/views/LoginView.vue'
import DashboardView from '@/views/DashboardView.vue'
import PlatformView from '@/views/PlatformView.vue'
import BrowseView from '@/views/BrowseView.vue'
import FileManagerView from '@/views/FileManagerView.vue'
import ApkInstallerView from '@/views/ApkInstallerView.vue'

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition ?? { top: 0 }
  },
  routes: [
    { path: '/', name: 'login', component: LoginView },
    { path: '/dashboard/:tab?', name: 'dashboard', component: DashboardView, props: true },
    { path: '/tools/files', name: 'tools-files', component: FileManagerView },
    { path: '/tools/apk', name: 'tools-apk', component: ApkInstallerView },
    { path: '/platform/:tag', name: 'platform', component: PlatformView, props: true },
    {
      path: '/platform/:tag/folder/:folder(.*)',
      name: 'platform-folder',
      component: PlatformView,
      props: true,
    },
    {
      path: '/platform/:tag/overlays',
      name: 'platform-overlays',
      component: PlatformView,
      props: route => ({ tag: route.params.tag, tab: 'overlays' }),
    },
    {
      path: '/platform/:tag/bios',
      name: 'platform-bios',
      component: PlatformView,
      props: route => ({ tag: route.params.tag, tab: 'bios' }),
    },
    {
      path: '/platform/:tag/samples',
      name: 'platform-samples',
      component: PlatformView,
      props: route => ({ tag: route.params.tag, tab: 'samples' }),
    },
    {
      path: '/platform/:tag/game/:id/guides/:file',
      name: 'guide-view',
      component: () => import('@/views/GuideViewer.vue'),
      props: true,
    },
    {
      path: '/platform/:tag/game/:id/:tab?',
      name: 'game',
      component: () => import('@/views/GameDetailView.vue'),
      props: true,
    },
    { path: '/browse/:resource/:tag', name: 'browse', component: BrowseView, props: true },
    { path: '/browse/:resource', name: 'browse-flat', component: BrowseView, props: true },
    { path: '/view', name: 'file-view', component: () => import('@/views/FileViewer.vue'), props: route => ({ ...route.query }) },
    { path: '/:pathMatch(.*)*', name: 'not-found', redirect: { name: 'dashboard' } },
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
