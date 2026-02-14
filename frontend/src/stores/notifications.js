import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useNotificationStore = defineStore('notifications', () => {
  // State
  const notifications = ref([])
  let notificationId = 0

  // Actions
  const addNotification = (notification) => {
    const id = ++notificationId
    const newNotification = {
      id,
      type: notification.type || 'info',
      message: notification.message,
      duration: notification.duration || 5000,
      createdAt: new Date()
    }

    notifications.value.push(newNotification)

    // Auto remove notification after duration
    if (newNotification.duration > 0) {
      setTimeout(() => {
        removeNotification(id)
      }, newNotification.duration)
    }

    return id
  }

  const removeNotification = (id) => {
    const index = notifications.value.findIndex(n => n.id === id)
    if (index > -1) {
      notifications.value.splice(index, 1)
    }
  }

  const clearNotifications = () => {
    notifications.value = []
  }

  const addSuccess = (message, duration = 3000) => {
    return addNotification({ type: 'success', message, duration })
  }

  const addError = (message, duration = 5000) => {
    return addNotification({ type: 'error', message, duration })
  }

  const addWarning = (message, duration = 4000) => {
    return addNotification({ type: 'warning', message, duration })
  }

  const addInfo = (message, duration = 3000) => {
    return addNotification({ type: 'info', message, duration })
  }

  return {
    // State
    notifications,
    
    // Actions
    addNotification,
    removeNotification,
    clearNotifications,
    addSuccess,
    addError,
    addWarning,
    addInfo
  }
})