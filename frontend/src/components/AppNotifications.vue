<template>
  <div class="notifications-container">
    <transition-group name="notification" tag="div">
      <div 
        v-for="notification in notificationStore.notifications" 
        :key="notification.id"
        :class="['notification', notification.type]"
      >
        <div class="notification-content">
          <div class="notification-icon">
            <component :is="getIcon(notification.type)" />
          </div>
          <span class="notification-text">{{ notification.message }}</span>
          <button 
            class="notification-close" 
            @click="notificationStore.removeNotification(notification.id)"
          >
            ×
          </button>
        </div>
      </div>
    </transition-group>
  </div>
</template>

<script setup>
import { useNotificationStore } from '@/stores/notifications'

const notificationStore = useNotificationStore()

// Icon components
const getIcon = (type) => {
  switch (type) {
    case 'success':
      return 'SuccessIcon'
    case 'error':
      return 'ErrorIcon'
    case 'warning':
      return 'WarningIcon'
    case 'info':
    default:
      return 'InfoIcon'
  }
}
</script>

<script>
// Icon components
export default {
  components: {
    SuccessIcon: {
      template: `
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18Z" fill="currentColor"/>
          <path d="M6 10L8.5 12.5L14 7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `
    },
    ErrorIcon: {
      template: `
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18Z" fill="currentColor"/>
          <path d="M10 6V10M10 14H10.01" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `
    },
    WarningIcon: {
      template: `
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M8.485 3.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 3.495zM10 8a.75.75 0 01.75.75v2.5a.75.75 0 01-1.5 0v-2.5A.75.75 0 0110 8zm0 6a1 1 0 100-2 1 1 0 000 2z" fill="currentColor"/>
        </svg>
      `
    },
    InfoIcon: {
      template: `
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18Z" fill="currentColor"/>
          <path d="M10 8V12M10 6H10.01" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `
    }
  }
}
</script>

<style scoped>
.notifications-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
  pointer-events: none;
}

.notification {
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  margin-bottom: 12px;
  overflow: hidden;
  pointer-events: auto;
  border: 1px solid #e2e8f0;
  backdrop-filter: blur(10px);
  position: relative;
  max-width: 400px;
  min-width: 300px;
}

.notification::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
}

.notification.success::before {
  background: linear-gradient(90deg, #10b981, #059669);
}

.notification.error::before {
  background: linear-gradient(90deg, #ef4444, #dc2626);
}

.notification.warning::before {
  background: linear-gradient(90deg, #f59e0b, #d97706);
}

.notification.info::before {
  background: linear-gradient(90deg, #1233EA, #0f29d1);
}

.notification-content {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  gap: 12px;
}

.notification-icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.notification.success .notification-icon {
  background: #dcfce7;
  color: #059669;
}

.notification.error .notification-icon {
  background: #fef2f2;
  color: #dc2626;
}

.notification.warning .notification-icon {
  background: #fef3c7;
  color: #d97706;
}

.notification.info .notification-icon {
  background: #eff6ff;
  color: #1233EA;
}

.notification-text {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  line-height: 1.4;
}

.notification-close {
  background: none;
  border: none;
  font-size: 20px;
  color: #9ca3af;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.notification-close:hover {
  background: #f3f4f6;
  color: #374151;
}

.notification-enter-active, .notification-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.notification-enter-from {
  opacity: 0;
  transform: translateX(100%) scale(0.95);
}

.notification-leave-to {
  opacity: 0;
  transform: translateX(100%) scale(0.95);
}

@media (max-width: 480px) {
  .notification {
    max-width: calc(100vw - 20px);
    min-width: auto;
    margin: 0 10px 12px 10px;
  }
  
  .notification-content {
    padding: 14px 16px;
  }
  
  .notification-text {
    font-size: 13px;
  }
}
</style>