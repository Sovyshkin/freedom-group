<template>
  <div class="reset-password-page">
    <div class="container">
      <div class="reset-card">
        <div class="logo">
          <h1>FREEDOM GROUP</h1>
          <p>{{ isFirstTimeSetup ? 'Установка пароля' : 'Восстановление пароля' }}</p>
        </div>
        
        <!-- Loading state -->
        <div v-if="loading && !tokenVerified && !tokenError" class="loading-state">
          <AppLoader />
          <p>Проверка токена...</p>
        </div>
        
        <!-- Error state -->
        <div v-else-if="tokenError" class="error-state">
          <div class="error-icon">⚠️</div>
          <h3>Ошибка</h3>
          <p>{{ tokenError }}</p>
          <router-link to="/" class="btn btn-primary">Вернуться к входу</router-link>
        </div>
        
        <!-- Success state -->
        <div v-else-if="passwordResetSuccess" class="success-state">
          <div class="success-icon">✅</div>
          <h3>Пароль успешно установлен!</h3>
          <p>Теперь вы можете войти в личный кабинет с вашим новым паролем.</p>
          <router-link to="/" class="btn btn-primary">Войти в личный кабинет</router-link>
        </div>
        
        <!-- Password form -->
        <form v-else-if="tokenVerified" @submit.prevent="resetPassword" class="reset-form">
          <h3>{{ isFirstTimeSetup ? 'Создайте пароль для входа' : 'Установка нового пароля' }}</h3>
          
          <div v-if="partnerInfo" class="partner-info">
            <div class="info-icon">👤</div>
            <p class="info-text">{{ partnerInfo.email }}</p>
            <p v-if="isFirstTimeSetup" class="info-hint">Придумайте надёжный пароль для доступа в личный кабинет</p>
          </div>
          
          <div class="form-group">
            <label for="password">Новый пароль</label>
            <div class="password-input">
              <input
                id="password"
                v-model="formData.password"
                :type="showPassword ? 'text' : 'password'"
                required
                minlength="6"
                placeholder="Введите новый пароль (минимум 6 символов)"
                :class="{ error: errors.password }"
                autocomplete="new-password"
              />
              <button 
                type="button" 
                @click="showPassword = !showPassword"
                class="password-toggle"
                aria-label="Показать пароль"
              >
                {{ showPassword ? '🙈' : '👁️' }}
              </button>
            </div>
            <div v-if="errors.password" class="error-message">{{ errors.password }}</div>
            <div v-if="formData.password" class="password-strength">
              <div class="strength-bar">
                <div 
                  :class="['strength-fill', passwordStrength.class]"
                  :style="{ width: passwordStrength.width }"
                ></div>
              </div>
              <div class="strength-text">Надёжность: {{ passwordStrength.text }}</div>
            </div>
            <div v-else class="password-hint">
              💡 Используйте минимум 6 символов. Для надёжности добавьте буквы, цифры и спецсимволы
            </div>
          </div>
          
          <div class="form-group">
            <label for="confirmPassword">Подтверждение пароля</label>
            <div class="password-input">
              <input
                id="confirmPassword"
                v-model="formData.confirmPassword"
                :type="showConfirmPassword ? 'text' : 'password'"
                required
                placeholder="Повторите новый пароль"
                :class="{ error: errors.confirmPassword }"
                autocomplete="new-password"
              />
              <button 
                type="button" 
                @click="showConfirmPassword = !showConfirmPassword"
                class="password-toggle"
                aria-label="Показать пароль"
              >
                {{ showConfirmPassword ? '🙈' : '👁️' }}
              </button>
            </div>
            <div v-if="errors.confirmPassword" class="error-message">{{ errors.confirmPassword }}</div>
            <div v-else-if="formData.confirmPassword && formData.password === formData.confirmPassword" class="success-message">
              ✓ Пароли совпадают
            </div>
          </div>
          
          <div class="form-actions">
            <button 
              type="submit" 
              :disabled="loading || !isFormValid"
              class="btn btn-primary btn-full"
            >
              <span v-if="loading" class="btn-loader">⏳</span>
              {{ loading ? 'Установка пароля...' : (isFirstTimeSetup ? 'Создать пароль и войти' : 'Установить пароль') }}
            </button>
          </div>
          
          <div class="help-links">
            <router-link to="/">← Вернуться к входу</router-link>
          </div>
        </form>
      </div>
    </div>
    
    <!-- Notifications -->
    <AppNotifications />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppLoader from '@/components/AppLoader.vue'
import AppNotifications from '@/components/AppNotifications.vue'
import { useNotificationStore } from '@/stores/notifications'
import api from '@/plugins/axios'

const route = useRoute()
const notificationStore = useNotificationStore()

// Reactive data
const loading = ref(false)
const tokenVerified = ref(false)
const tokenError = ref('')
const passwordResetSuccess = ref(false)
const partnerInfo = ref(null)
const isFirstTimeSetup = ref(true) // По умолчанию считаем что это первая установка пароля

const formData = ref({
  password: '',
  confirmPassword: ''
})

const errors = ref({})
const showPassword = ref(false)
const showConfirmPassword = ref(false)

// Computed properties
const passwordStrength = computed(() => {
  const password = formData.value.password
  if (!password) return { width: '0%', class: '', text: '' }
  
  let score = 0
  
  // Length check
  if (password.length >= 6) score += 1
  if (password.length >= 8) score += 1
  if (password.length >= 12) score += 1
  
  // Character variety checks
  if (/[a-z]/.test(password)) score += 1
  if (/[A-Z]/.test(password)) score += 1
  if (/[0-9]/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1
  
  // Determine strength
  let strength = ''
  let width = '0%'
  let className = ''
  
  if (score <= 2) {
    strength = 'Слабый'
    width = '25%'
    className = 'weak'
  } else if (score <= 4) {
    strength = 'Средний'
    width = '50%'
    className = 'medium'
  } else if (score <= 6) {
    strength = 'Хороший'
    width = '75%'
    className = 'good'
  } else {
    strength = 'Отличный'
    width = '100%'
    className = 'excellent'
  }
  
  return { width, class: className, text: strength }
})

const isFormValid = computed(() => {
  return formData.value.password.length >= 6 && 
         formData.value.password === formData.value.confirmPassword &&
         !Object.keys(errors.value).length
})

// Methods
const verifyToken = async () => {
  const token = route.query.token
  
  if (!token) {
    tokenError.value = 'Токен не предоставлен'
    return
  }
  
  try {
    loading.value = true
    const response = await api.get(`/auth/reset-password/${token}`)
    partnerInfo.value = {
      partnerId: response.data.partnerId,
      email: response.data.partnerEmail
    }
    tokenVerified.value = true
  } catch (error) {
    console.error('Ошибка проверки токена:', error)
    tokenError.value = error.response?.data?.message || 'Недействительный или истекший токен'
  } finally {
    loading.value = false
  }
}

const validateForm = () => {
  errors.value = {}
  
  // Password validation
  if (!formData.value.password) {
    errors.value.password = 'Пароль обязателен'
  } else if (formData.value.password.length < 6) {
    errors.value.password = 'Пароль должен содержать минимум 6 символов'
  }
  
  // Confirm password validation
  if (!formData.value.confirmPassword) {
    errors.value.confirmPassword = 'Подтверждение пароля обязательно'
  } else if (formData.value.password !== formData.value.confirmPassword) {
    errors.value.confirmPassword = 'Пароли не совпадают'
  }
  
  return Object.keys(errors.value).length === 0
}

const resetPassword = async () => {
  if (!validateForm()) return
  
  const token = route.query.token
  
  loading.value = true
  try {
    await api.post('/auth/reset-password', {
      token,
      password: formData.value.password
    })
    
    passwordResetSuccess.value = true
    
    notificationStore.addNotification({
      type: 'success',
      message: 'Пароль успешно обновлен!'
    })
    
  } catch (error) {
    console.error('Ошибка сброса пароля:', error)
    notificationStore.addNotification({
      type: 'error',
      message: error.response?.data?.message || 'Ошибка установки пароля'
    })
  } finally {
    loading.value = false
  }
}

// Watchers
watch([() => formData.value.password, () => formData.value.confirmPassword], () => {
  if (errors.value.password || errors.value.confirmPassword) {
    validateForm()
  }
})

// Lifecycle
onMounted(() => {
  verifyToken()
})
</script>

<style scoped>
.reset-password-page {
  min-height: 100vh;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.container {
  width: 100%;
  max-width: 500px;
}

.reset-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border: 1px solid #e9ecef;
  overflow: hidden;
}

.logo {
  background: #f8f9fa;
  border-bottom: 2px solid #e9ecef;
  color: #2c3e50;
  text-align: center;
  padding: 40px 20px;
}

.logo h1 {
  margin: 0 0 8px;
  font-size: 2rem;
  font-weight: 700;
  color: #667eea;
}

.logo p {
  margin: 0;
  color: #6c757d;
  font-size: 1.1rem;
}

.loading-state,
.error-state,
.success-state {
  padding: 40px 30px;
  text-align: center;
}

.error-state .error-icon,
.success-state .success-icon {
  font-size: 4rem;
  margin-bottom: 20px;
}

.error-state h3,
.success-state h3 {
  margin: 0 0 16px;
  color: #2c3e50;
}

.error-state p,
.success-state p {
  margin: 0 0 24px;
  color: #6c757d;
  line-height: 1.5;
}

.reset-form {
  padding: 40px 30px;
}

.reset-form h3 {
  margin: 0 0 24px;
  color: #2c3e50;
  font-size: 1.5rem;
  text-align: center;
  font-weight: 600;
}

.partner-info {
  background: #f8f9fa;
  border: 2px solid #dee2e6;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 28px;
  text-align: center;
}

.partner-info .info-icon {
  font-size: 2.5rem;
  margin-bottom: 12px;
}

.partner-info .info-text {
  margin: 0 0 8px;
  color: #2c3e50;
  font-size: 16px;
  font-weight: 600;
}

.partner-info .info-hint {
  margin: 0;
  color: #6c757d;
  font-size: 13px;
  line-height: 1.4;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #495057;
}

.password-input {
  position: relative;
}

.password-input input {
  width: 100%;
  padding: 12px 45px 12px 16px;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.password-input input:focus {
  outline: none;
  border-color: #667eea;
}

.password-input input.error {
  border-color: #dc3545;
}

.password-toggle {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  padding: 4px;
}

.error-message {
  color: #dc3545;
  font-size: 14px;
  margin-top: 4px;
}

.success-message {
  color: #28a745;
  font-size: 14px;
  margin-top: 4px;
  font-weight: 500;
}

.password-hint {
  color: #6c757d;
  font-size: 13px;
  margin-top: 6px;
  line-height: 1.4;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 6px;
  border-left: 3px solid #667eea;
}

.password-strength {
  margin-top: 8px;
}

.strength-bar {
  height: 4px;
  background: #e9ecef;
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 4px;
}

.strength-fill {
  height: 100%;
  transition: all 0.3s;
}

.strength-fill.weak {
  background: #dc3545;
}

.strength-fill.medium {
  background: #fd7e14;
}

.strength-fill.good {
  background: #ffc107;
}

.strength-fill.excellent {
  background: #28a745;
}

.strength-text {
  font-size: 12px;
  color: #6c757d;
}

.form-actions {
  margin: 30px 0 20px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #5568d3;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.btn-full {
  width: 100%;
}

.btn-loader {
  display: inline-block;
  margin-right: 8px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.help-links {
  text-align: center;
  margin-top: 20px;
}

.help-links a {
  color: #667eea;
  text-decoration: none;
  font-size: 14px;
}

.help-links a:hover {
  text-decoration: underline;
}

@media (max-width: 480px) {
  .reset-password-page {
    padding: 16px;
  }
  
  .logo {
    padding: 30px 16px;
  }
  
  .logo h1 {
    font-size: 1.75rem;
  }
  
  .reset-form {
    padding: 24px 20px;
  }
  
  .password-input input {
    font-size: 16px; /* Prevent zoom on iOS */
  }
}
</style>