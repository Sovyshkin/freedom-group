import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  {
    path: '/',
    name: 'home',
    redirect: '/login'
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/auth/LoginPage.vue'),
    meta: { requiresGuest: true }
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('@/views/AdminDashboard.vue'),
    meta: { requiresAuth: true, requiresRole: 'admin' }
  },
  {
    path: '/dashboard',
    name: 'dashboard', 
    component: () => import('@/views/PartnerDashboard.vue'),
    meta: { requiresAuth: true, requiresRole: 'partner' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Navigation guards
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  
  // Ждем инициализации авторизации
  if (!authStore.initialized) {
    await authStore.initializeAuth()
  }
  
  const isAuthenticated = authStore.isAuthenticated
  const userRole = authStore.user?.role
  
  // Если маршрут требует гостевой доступ (login)
  if (to.meta.requiresGuest && isAuthenticated) {
    if (userRole === 'admin') {
      return next('/admin')
    } else {
      return next('/dashboard')
    }
  }
  
  // Если маршрут требует авторизации
  if (to.meta.requiresAuth && !isAuthenticated) {
    return next('/login')
  }
  
  // Если маршрут требует определенную роль
  if (to.meta.requiresRole && userRole !== to.meta.requiresRole) {
    if (userRole === 'admin') {
      return next('/admin')
    } else if (userRole === 'partner') {
      return next('/dashboard') 
    } else {
      return next('/login')
    }
  }
  
  next()
})

export default router