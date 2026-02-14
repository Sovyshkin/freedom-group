<template>
  <div class="reset-password-page">
    <div class="container">
      <div class="reset-card">
        <div class="logo">
          <h1>FREEDOM GROUP</h1>
          <p>Восстановление пароля</p>
        </div>
        
        <div v-if="!tokenVerified && !loading" class="loading-state">
          <AppLoader />
          <p>Проверка токена...</p>
        </div>
        
        <div v-else-if="tokenError" class="error-state">
          <div class="error-icon">⚠️</div>
          <h3>Ошибка</h3>
          <p>{{ tokenError }}</p>
          <router-link to="/" class="btn btn-primary">Вернуться к входу</router-link>
        </div>
        
        <div v-else-if="passwordResetSuccess" class="success-state">
          <div class="success-icon">✅</div>
          <h3>Пароль успешно обновлен!</h3>
          <p>Теперь вы можете войти в систему с новым паролем.</p>
          <router-link to="/" class="btn btn-primary">Перейти к входу</router-link>
        </div>
        
        <form v-else @submit.prevent="resetPassword" class="reset-form">
          <h3>Установка нового пароля</h3>
          
          <div v-if="partnerInfo" class="partner-info">
            <p>Установка пароля для: <strong>{{ partnerInfo.email }}</strong></p>
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
              />
              <button 
                type="button" 
                @click="showPassword = !showPassword"
                class="password-toggle"
              >
                {{ showPassword ? '🙈' : '👁️' }}
              </button>
            </div>
            <div v-if="errors.password" class="error-message">{{ errors.password }}</div>
            <div class="password-strength">
              <div class="strength-bar">
                <div 
                  :class="['strength-fill', passwordStrength.class]"
                  :style="{ width: passwordStrength.width }"
                ></div>
              </div>
              <div class="strength-text">{{ passwordStrength.text }}</div>
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
              />
              <button 
                type="button" 
                @click="showConfirmPassword = !showConfirmPassword"
                class="password-toggle"
              >
                {{ showConfirmPassword ? '🙈' : '👁️' }}
              </button>
            </div>
            <div v-if="errors.confirmPassword" class="error-message">{{ errors.confirmPassword }}</div>
          </div>
          
          <div class="form-actions">
            <button 
              type="submit" 
              :disabled="loading || !isFormValid"
              class="btn btn-primary btn-full"
            >
              <AppLoader v-if="loading" size="small" />
              {{ loading ? 'Установка пароля...' : 'Установить пароль' }}
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
import { useRoute, useRouter } from 'vue-router'
import AppLoader from '@/components/AppLoader.vue'
import AppNotifications from '@/components/AppNotifications.vue'
import { useNotificationStore } from '@/stores/notifications'
import api from '@/plugins/axios'

const route = useRoute()
const router = useRouter()
const notificationStore = useNotificationStore()

// Reactive data
const loading = ref(false)
const tokenVerified = ref(false)
const tokenError = ref('')
const passwordResetSuccess = ref(false)
const partnerInfo = ref(null)

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
  let feedback = []
  
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.container {
  width: 100%;
  max-width: 400px;
}

.reset-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.logo {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  text-align: center;
  padding: 40px 20px;
}

.logo h1 {
  margin: 0 0 8px;
  font-size: 2rem;
  font-weight: 700;
}

.logo p {
  margin: 0;
  opacity: 0.9;
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
  padding: 30px;
}

.reset-form h3 {
  margin: 0 0 24px;
  color: #2c3e50;
  font-size: 1.5rem;
  text-align: center;
}

.partner-info {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 24px;
  text-align: center;
}

.partner-info p {
  margin: 0;
  color: #6c757d;
  font-size: 14px;
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
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