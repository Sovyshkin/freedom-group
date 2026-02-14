<script setup>
import { onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth.js'
// import GlobalSearch from './GlobalSearch.vue'

const authStore = useAuthStore()

const handleLogout = () => {
  authStore.logout()
}

// Вычисляемое свойство для отображения данных пользователя
const displayUser = computed(() => {
  if (!authStore.user) return { name: '', surname: '', email: '', username: '' }
  
  // Для администраторов
  if (authStore.user.role === 'admin') {
    return {
      name: '',
      surname: '',
      email: authStore.user.email || '',
      username: authStore.user.username || 'admin'
    }
  }
  
  // Для партнеров
  if (authStore.user.role === 'partner') {
    return {
      name: authStore.user.name || '',
      surname: '', // У партнеров обычно нет surname в отдельном поле
      email: authStore.user.email || '',
      username: authStore.user.alias || ''
    }
  }
  
  return { name: '', surname: '', email: '', username: '' }
})

onMounted(() => {
  console.log('AppHeader mounted, user:', authStore.user)
})
</script>

<template>
  <header>
    <div class="wrap-logo" @click="$router.push('/')">
      FREEDOM GROUP
    </div>
    <!-- <div class="wrap-search"> -->
      <!-- <GlobalSearch /> -->
    <!-- </div> -->
    <div class="user-section">
      <span class="user" v-if="authStore.user?.role === 'admin'">
        {{ displayUser.username }}
      </span>
      <span class="user" v-else-if="authStore.user?.role === 'partner' && displayUser.name">
        {{ displayUser.name }}
      </span>
      <span class="user" v-else-if="authStore.isAuthenticated && displayUser.email">
        {{ displayUser.email }}
      </span>
      <span class="user" v-else-if="authStore.isAuthenticated">
        Пользователь
      </span>
      <span class="user" v-else>
        Гость
      </span>
      <button class="logout-btn" @click="handleLogout" title="Выйти" v-if="authStore.isAuthenticated">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M6 2H3C2.45 2 2 2.45 2 3V13C2 13.55 2.45 14 3 14H6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M11 11L14 8L11 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M14 8H6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  </header>
</template>

<style scoped>
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 48px;
  padding: 20px 40px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
}

.wrap-logo {
  font-weight: 600;
  font-size: 24px;
  cursor: pointer;
  color: #1f2937;
  transition: all 0.2s ease;
  position: relative;
}

.wrap-logo:hover {
  color: #1233EA;
  transform: translateY(-1px);
}

.wrap-logo::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 0;
  width: 0;
  height: 2px;
  background: #1233EA;
  transition: width 0.3s ease;
}

.wrap-logo:hover::after {
  width: 100%;
}

.wrap-search {
  display: flex;
  align-items: center;
  position: relative;
  flex: 1;
  max-width: 400px;
}

.user {
  font-weight: 500;
  font-size: 16px;
}

.user {
  font-weight: 500;
  font-size: 14px;
  color: #374151;
  padding: 8px 16px;
  background: #f9fafb;
  border-radius: 8px;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.user-section {
  display: flex;
  align-items: center;
  gap: 16px;
}

.logout-btn {
  background: none;
  border: 1px solid #e5e7eb;
  cursor: pointer;
  color: #6b7280;
  padding: 10px;
  border-radius: 8px;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.logout-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(18, 51, 234, 0.1), transparent);
  transition: left 0.6s;
}

.logout-btn:hover::before {
  left: 100%;
}

.logout-btn:hover {
  background-color: #1233EA;
  color: white;
  border-color: #1233EA;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(18, 51, 234, 0.3);
}

.user-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logout-btn {
  background: none;
  border: none;
  color: #8C93A6;
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.logout-btn:hover {
  background-color: #f5f5f5;
  color: #1233ea;
}

.wrap-search {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-radius: 12px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border: 1px solid #e2e8f0;
  padding: 16px;
  transition: all 0.3s ease;
  position: relative;
}

.wrap-search:focus-within {
  border-color: #1233EA;
  box-shadow: 0 0 0 3px rgba(18, 51, 234, 0.1);
  background: white;
}

.wrap-search input {
  flex: 1;
}

label {
  cursor: pointer;
}

/* Адаптивность для планшетов */
@media (max-width: 768px) {
  header {
    gap: 24px;
    padding: 12px 20px;
  }
  
  .wrap-logo {
    font-size: 20px;
  }
  
  .user {
    font-size: 14px;
  }
  
  .user-section {
    gap: 8px;
  }
  
  .logout-btn {
    padding: 6px;
  }
  
  .wrap-search {
    padding: 12px;
  }
}

/* Адаптивность для мобильных */
@media (max-width: 480px) {
  header {
    gap: 16px;
    padding: 8px 16px;
  }
  
  .wrap-logo {
    font-size: 18px;
  }
  
  .user {
    font-size: 12px;
    white-space: nowrap;
  }
  
  .user-section {
    gap: 6px;
  }
  
  .logout-btn {
    padding: 4px;
  }
  
  .logout-btn svg {
    width: 14px;
    height: 14px;
  }
  
  .wrap-search {
    display: none;
  }
}
</style>