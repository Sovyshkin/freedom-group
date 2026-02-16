import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/plugins/axios'

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref(null)
  const token = ref(localStorage.getItem('authToken') || null)
  const isAuthenticated = ref(!!token.value)
  const loading = ref(false)
  const initialized = ref(false)

  // Загружаем user из localStorage при инициализации
  const storedUser = localStorage.getItem('authUser')
  if (storedUser) {
    try {
      user.value = JSON.parse(storedUser)
    } catch (e) {
      console.error('Error parsing stored user:', e)
      localStorage.removeItem('authUser')
    }
  }

  // Actions
  const login = async (endpoint, credentials) => {
    try {
      const response = await api.post(endpoint, credentials)
      
      if (response.data.success) {
        token.value = response.data.token
        user.value = response.data.user
        isAuthenticated.value = true
        
        // Store token and user in localStorage
        localStorage.setItem('authToken', token.value)
        localStorage.setItem('authUser', JSON.stringify(user.value))
        
        // Set default authorization header
        api.defaults.headers.common['Authorization'] = `Bearer ${token.value}`
        
        return response.data
      } else {
        throw new Error(response.data.message || 'Login failed')
      }
    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
  }

  const logout = () => {
    user.value = null
    token.value = null
    isAuthenticated.value = false
    
    // Remove token and user from localStorage
    localStorage.removeItem('authToken')
    localStorage.removeItem('authUser')
    
    // Remove authorization header
    delete api.defaults.headers.common['Authorization']
  }

  const initializeAuth = async () => {
    if (token.value) {
      // Set authorization header
      api.defaults.headers.common['Authorization'] = `Bearer ${token.value}`
      
      try {
        // Проверяем токен и получаем данные пользователя с сервера
        const response = await api.get('/auth/verify')
        
        if (response.data.success) {
          user.value = response.data.user
          isAuthenticated.value = true
          
          // Обновляем user в localStorage
          localStorage.setItem('authUser', JSON.stringify(user.value))
          
          console.log('Auth initialized with valid token')
        } else {
          // Токен невалиден
          console.log('Token is invalid, logging out')
          logout()
        }
      } catch (error) {
        // Ошибка при проверке токена (например, токен истек)
        console.error('Token verification failed:', error)
        logout()
      }
    } else {
      console.log('No token found, user is not authenticated')
    }
    initialized.value = true
  }

  const initAuth = async () => {
    return initializeAuth()
  }

  const updateUser = (userData) => {
    user.value = { ...user.value, ...userData }
  }

  return {
    // State
    user,
    token,
    isAuthenticated,
    loading,
    initialized,
    
    // Actions
    login,
    logout,
    initAuth,
    initializeAuth,
    updateUser
  }
})