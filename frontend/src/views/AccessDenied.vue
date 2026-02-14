<template>
  <div class="access-denied">
    <div class="access-denied-content">
      <div class="icon">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-13h2v6h-2V7zm0 8h2v2h-2v-2z" fill="#ff6b6b"/>
        </svg>
      </div>
      <h2>Доступ запрещен</h2>
      <p>Для выполнения этого действия требуются права администратора.</p>
      <p>Обратитесь к администратору системы для получения доступа.</p>
      
      <div class="user-info">
        <p><strong>Текущий пользователь:</strong> {{ userEmail }}</p>
        <p><strong>Роль:</strong> {{ userRole }}</p>
      </div>
      
      <button @click="goBack" class="back-button">
        Вернуться назад
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useMainStore } from '@/stores/main.ts';

const router = useRouter();
const mainStore = useMainStore();

const userEmail = computed(() => mainStore.user?.email || 'Не авторизован');
const userRole = computed(() => mainStore.user?.role?.name || 'Не определена');

const goBack = () => {
  router.go(-1);
};
</script>

<style scoped>
.access-denied {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background-color: white;
  font-family: 'Inter', sans-serif;
  font-weight: 500;
}

.access-denied-content {
  text-align: center;
  max-width: 500px;
  background: white;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.icon {
  margin-bottom: 20px;
}

h2 {
  color: #333;
  margin-bottom: 16px;
  font-size: 24px;
  font-weight: 600;
}

p {
  color: #666;
  margin-bottom: 12px;
  line-height: 1.6;
}

.user-info {
  background: #f8f9fa;
  padding: 16px;
  border-radius: 8px;
  margin: 24px 0;
  text-align: left;
}

.user-info p {
  margin-bottom: 8px;
  color: #555;
}

.back-button {
  background-color: #1233EA;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 16px;
  font-family: 'Inter', sans-serif;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.back-button:hover {
  background-color: #0f29d1;
  transform: translateY(-2px);
}

.back-button:hover {
  background: #0d28d1;
}
</style>