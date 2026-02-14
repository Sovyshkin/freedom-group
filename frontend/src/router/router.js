import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth.js';

// Импорт страниц
import LoginPage from '@/views/auth/LoginPage.vue'
import EmailVerify from '@/views/auth/EmailVerify.vue'
import PartnerDashboard from '@/views/PartnerDashboard.vue'
import AdminDashboard from '@/views/AdminDashboard.vue'
import AccessDenied from '@/views/AccessDenied.vue'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: LoginPage,
    meta: { requiresAuth: false }
  },
  {
    path: '/email-verify',
    name: 'email_verify',
    component: EmailVerify,
    meta: { requiresAuth: false }
  },
  {
    path: '/partner',
    name: 'partner',
    component: PartnerDashboard,
    meta: { requiresAuth: true, roles: ['partner'] }
  },
  {
    path: '/admin',
    name: 'admin', 
    component: AdminDashboard,
    meta: { requiresAuth: true, roles: ['admin'] }
  },
  {
    path: '/access-denied',
    name: 'access-denied',
    component: AccessDenied,
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    redirect: '/partner'
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// Защита маршрутов
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();
  
  // Если маршрут не требует авторизации
  if (!to.meta.requiresAuth) {
    return next();
  }
  
  // Проверяем авторизацию
  if (!authStore.isAuthenticated) {
    // Сохраняем URL для возврата после логина
    localStorage.setItem('returnUrl', to.fullPath);
    return next({ name: 'login' });
  }
  
  // Проверяем роли если они указаны
  if (to.meta.roles && to.meta.roles.length > 0) {
    if (!authStore.user || !to.meta.roles.includes(authStore.user.role)) {
      return next('/access-denied');
    }
  }

  next();
});

export default router;