<template>
  <div class="forgot-password-page">
    <div class="container">
      <div class="forgot-card">
        <div class="logo">
          <h1>FREEDOM GROUP</h1>
          <p>Восстановление пароля</p>
        </div>
        
        <div v-if="emailSent" class="success-state">
          <div class="success-icon">✉️</div>
          <h3>Письмо отправлено!</h3>
          <p>Если аккаунт с указанным email существует, на него отправлена ссылка для восстановления пароля.</p>
          <p class="help-text">Проверьте папку "Спам", если письмо не пришло в течение нескольких минут.</p>
          <div class="actions">
            <router-link to="/" class="btn btn-primary">Вернуться к входу</router-link>
            <button @click="resetForm" class="btn btn-secondary">Отправить еще раз</button>
          </div>
        </div>
        
        <form v-else @submit.prevent="forgotPassword" class="forgot-form">
          <h3>Забыли пароль?</h3>
          <p class="description">
            Введите ваш email адрес и мы отправим ссылку для восстановления пароля.
          </p>
          
          <div class="form-group">
            <label for="email">Email адрес</label>
            <input
              id="email"
              v-model="formData.email"
              type="email"
              required
              placeholder="Введите ваш email"
              :class="{ error: errors.email }"
            />
            <div v-if="errors.email" class="error-message">{{ errors.email }}</div>
          </div>
          
          <div class="form-actions">
            <button 
              type="submit" 
              :disabled="loading"
              class="btn btn-primary btn-full"
            >
              <AppLoader v-if="loading" size="small" />
              {{ loading ? 'Отправка...' : 'Отправить ссылку' }}
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
import { ref, reactive } from 'vue'
import AppLoader from '@/components/AppLoader.vue'
import AppNotifications from '@/components/AppNotifications.vue'
import api from '@/plugins/axios'

// Reactive data
const loading = ref(false)
const emailSent = ref(false)

const formData = reactive({
  email: ''
})

const errors = ref({})

// Methods
const validateForm = () => {
  errors.value = {}
  
  if (!formData.email) {
    errors.value.email = 'Email обязателен'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
    errors.value.email = 'Введите корректный email адрес'
  }
  
  return Object.keys(errors.value).length === 0
}

const forgotPassword = async () => {
  if (!validateForm()) return
  
  loading.value = true
  
  try {
    await api.post('/auth/forgot-password', {
      email: formData.email
    })
    
    emailSent.value = true
    
  } catch (error) {
    console.error('Ошибка отправки:', error)
    
    // Всегда показываем успешное сообщение для безопасности
    // даже если произошла ошибка
    emailSent.value = true
    
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  emailSent.value = false
  formData.email = ''
  errors.value = {}
}
</script>

<style scoped>
.forgot-password-page {
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

.forgot-card {
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

.success-state {
  padding: 40px 30px;
  text-align: center;
}

.success-icon {
  font-size: 4rem;
  margin-bottom: 20px;
}

.success-state h3 {
  margin: 0 0 16px;
  color: #2c3e50;
  font-size: 1.5rem;
}

.success-state p {
  margin: 0 0 16px;
  color: #6c757d;
  line-height: 1.5;
}

.help-text {
  font-size: 14px;
  color: #adb5bd;
  margin-bottom: 24px !important;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.forgot-form {
  padding: 30px;
}

.forgot-form h3 {
  margin: 0 0 12px;
  color: #2c3e50;
  font-size: 1.5rem;
  text-align: center;
}

.description {
  margin: 0 0 24px;
  color: #6c757d;
  line-height: 1.5;
  text-align: center;
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

.form-group input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
}

.form-group input.error {
  border-color: #dc3545;
}

.error-message {
  color: #dc3545;
  font-size: 14px;
  margin-top: 4px;
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

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #5a6268;
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
  .forgot-password-page {
    padding: 16px;
  }
  
  .logo {
    padding: 30px 16px;
  }
  
  .logo h1 {
    font-size: 1.75rem;
  }
  
  .forgot-form,
  .success-state {
    padding: 24px 20px;
  }
  
  .form-group input {
    font-size: 16px; /* Prevent zoom on iOS */
  }
}
</style>