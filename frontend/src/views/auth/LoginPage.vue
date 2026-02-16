<template>
  <div class="login-page">
    <div class="container">
      <div class="login-card">
        <div class="brand">
          <h1>FREEDOM GROUP</h1>
          <p>Партнерская система</p>
        </div>
        
        <form @submit.prevent="login" class="login-form">
          <!-- Role selection -->
          <div class="role-selector">
            <button 
              type="button"
              @click="loginType = 'partner'"
              :class="['role-option', { active: loginType === 'partner' }]"
            >
              Партнер
            </button>
            <button 
              type="button"
              @click="loginType = 'admin'"
              :class="['role-option', { active: loginType === 'admin' }]"
            >
              Администратор
            </button>
          </div>
          
          <div class="input-group">
            <input
              v-model="formData.login"
              type="text"
              required
              :placeholder="loginType === 'admin' ? 'Имя пользователя' : 'Логин или email'"
              :class="{ error: errors.login }"
              class="input-field"
            />
            <div v-if="errors.login" class="error-text">{{ errors.login }}</div>
          </div>
          
          <div class="input-group">
            <div class="password-field">
              <input
                v-model="formData.password"
                :type="showPassword ? 'text' : 'password'"
                required
                placeholder="Пароль"
                :class="{ error: errors.password }"
                class="input-field"
              />
              <button 
                type="button" 
                @click="showPassword = !showPassword"
                class="password-toggle"
              >
                <svg v-if="showPassword" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
                <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
            </div>
            <div v-if="errors.password" class="error-text">{{ errors.password }}</div>
          </div>
          
          <button 
            type="submit" 
            :disabled="loading"
            class="login-btn"
          >
            <span v-if="loading" class="loader"></span>
            {{ loading ? 'Вход...' : 'Войти' }}
          </button>
          
          <div v-if="loginType === 'partner'" class="forgot-link">
            <router-link to="/forgot-password">Забыли пароль?</router-link>
          </div>
        </form>
      </div>
    </div>
    
    <AppNotifications />
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import AppNotifications from '@/components/AppNotifications.vue'
import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notifications'

const router = useRouter()
const authStore = useAuthStore()
const notificationStore = useNotificationStore()

// Reactive data
const loading = ref(false)
const showPassword = ref(false)
const loginType = ref('partner') // 'partner' or 'admin'

const formData = reactive({
  login: '',
  password: ''
})

const errors = ref({})

// Methods
const validateForm = () => {
  errors.value = {}
  
  const trimmedLogin = formData.login.trim()
  const trimmedPassword = formData.password.trim()
  
  if (!trimmedLogin) {
    errors.value.login = loginType.value === 'admin' ? 'Имя пользователя обязательно' : 'Логин или email обязателен'
  }
  
  if (!trimmedPassword) {
    errors.value.password = 'Пароль обязателен'
  }
  
  return Object.keys(errors.value).length === 0
}

const login = async () => {
  if (!validateForm()) return
  
  loading.value = true
  
  try {
    const endpoint = loginType.value === 'admin' ? '/auth/admin/login' : '/auth/login'
    const loginData = loginType.value === 'admin' 
      ? { username: formData.login.trim(), password: formData.password.trim() }
      : { login: formData.login.trim(), password: formData.password.trim() }
    
    await authStore.login(endpoint, loginData)
    
    // Redirect based on user role
    if (authStore.user.role === 'admin') {
      router.push('/admin')
    } else {
      router.push('/dashboard')
    }
    
    notificationStore.addNotification({
      type: 'success',
      message: 'Успешный вход в систему!'
    })
    
  } catch (error) {
    console.error('Ошибка входа:', error)
    
    let errorMessage = 'Ошибка входа в систему'
    
    if (error.response?.status === 401) {
      errorMessage = 'Неверные учетные данные'
    } else if (error.response?.status === 403) {
      errorMessage = error.response.data?.message || 'Доступ запрещен'
    } else if (error.response?.status === 429) {
      errorMessage = error.response.data?.message || 'Слишком много попыток входа'
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message
    }
    
    notificationStore.addNotification({
      type: 'error',
      message: errorMessage
    })
  } finally {
    loading.value = false
  }
}
</script>
<style scoped>
.login-page {
  min-height: 100vh;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  font-family: 'Inter', sans-serif;
}

.container {
  width: 100%;
  max-width: 480px;
}

.login-card {
  background: white;
  border-radius: 16px;
  border: 1px solid #f1f3f4;
  overflow: hidden;
  animation: fadeIn 0.6s ease-out, levitate 4s ease-in-out infinite;
  box-shadow: 
    0 25px 50px rgba(0, 0, 0, 0.1),
    0 15px 35px rgba(0, 0, 0, 0.05),
    0 5px 15px rgba(0, 0, 0, 0.02);
  transform: translateY(-5px);
  transition: all 0.3s ease;
}

.login-card:hover {
  animation-play-state: paused;
  transform: translateY(-10px);
  box-shadow: 
    0 35px 60px rgba(0, 0, 0, 0.15),
    0 20px 40px rgba(0, 0, 0, 0.1),
    0 10px 20px rgba(0, 0, 0, 0.05);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes levitate {
  0%, 100% {
    transform: translateY(-5px) translateX(0);
  }
  25% {
    transform: translateY(-5px) translateX(2px);
  }
  50% {
    transform: translateY(-5px) translateX(0);
  }
  75% {
    transform: translateY(-5px) translateX(-2px);
  }
}

.brand {
  text-align: center;
  padding: 48px 32px 32px;
  border-bottom: 1px solid #f1f3f4;
}

.brand h1 {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 600;
  color: #1a1a1a;
  letter-spacing: -0.02em;
}

.brand p {
  margin: 0;
  color: #6b7280;
  font-size: 14px;
  font-weight: 400;
}

.login-form {
  padding: 32px;
}

.role-selector {
  display: flex;
  background: #f9fafb;
  border-radius: 12px;
  padding: 4px;
  margin-bottom: 24px;
  border: 1px solid #f3f4f6;
}

.role-option {
  flex: 1;
  padding: 12px 16px;
  border: none;
  background: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
  transition: all 0.2s ease;
}

.role-option.active {
  background: white;
  color: #1a1a1a;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.input-group {
  margin-bottom: 20px;
}

.input-field {
  width: 100%;
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 400;
  color: #1a1a1a;
  background: white;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.input-field::placeholder {
  color: #9ca3af;
}

.input-field:focus {
  outline: none;
  border-color: #1233EA;
  box-shadow: 0 0 0 3px rgba(18, 51, 234, 0.1);
}

.input-field.error {
  border-color: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.password-field {
  position: relative;
}

.password-field .input-field {
  padding-right: 52px;
}

.password-toggle {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  color: #9ca3af;
  padding: 4px;
  border-radius: 6px;
  transition: color 0.2s ease;
}

.password-toggle:hover {
  color: #6b7280;
}

.error-text {
  color: #ef4444;
  font-size: 14px;
  margin-top: 8px;
  font-weight: 400;
}

.login-btn {
  width: 100%;
  background: #1233EA;
  color: white;
  border: none;
  padding: 16px 24px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 52px;
}

.login-btn:hover:not(:disabled) {
  background: #0f29d1;
}

.login-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.loader {
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.forgot-link {
  text-align: center;
}

.forgot-link a {
  color: #1233EA;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: color 0.2s ease;
}

.forgot-link a:hover {
  color: #0f29d1;
}

@media (max-width: 480px) {
  .login-page {
    padding: 16px;
  }
  
  .brand {
    padding: 40px 24px 24px;
  }
  
  .brand h1 {
    font-size: 22px;
  }
  
  .login-form {
    padding: 24px;
  }
  
  .input-field {
    font-size: 16px; /* Prevent zoom on iOS */
  }
}
</style>
