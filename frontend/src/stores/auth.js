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

  // Actions
  const login = async (endpoint, credentials) => {
    try {
      const response = await api.post(endpoint, credentials)
      
      if (response.data.success) {
        token.value = response.data.token
        user.value = response.data.user
        isAuthenticated.value = true
        
        // Store token in localStorage
        localStorage.setItem('authToken', token.value)
        
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
    
    // Remove token from localStorage
    localStorage.removeItem('authToken')
    
    // Remove authorization header
    delete api.defaults.headers.common['Authorization']
  }

  const initializeAuth = async () => {
    if (token.value) {
      // Set authorization header
      api.defaults.headers.common['Authorization'] = `Bearer ${token.value}`
      isAuthenticated.value = true
      console.log('Auth initialized with existing token')
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