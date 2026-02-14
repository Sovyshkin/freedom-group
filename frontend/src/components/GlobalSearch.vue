<template>
  <div class="global-search">
    <div class="search-container">
      <input 
        v-model="searchQuery"
        type="text" 
        placeholder="Поиск по документам..."
        class="search-input"
        @input="onSearch"
      />
      <svg class="search-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path 
          d="M9 17C13.4183 17 17 13.4183 17 9C17 4.58172 13.4183 1 9 1C4.58172 1 1 4.58172 1 9C1 13.4183 4.58172 17 9 17Z" 
          stroke="#9CA3AF" 
          stroke-width="2" 
          stroke-linecap="round" 
          stroke-linejoin="round"
        />
        <path 
          d="M19 19L14.65 14.65" 
          stroke="#9CA3AF" 
          stroke-width="2" 
          stroke-linecap="round" 
          stroke-linejoin="round"
        />
      </svg>
    </div>
    
    <!-- Результаты поиска -->
    <div v-if="searchResults.length > 0" class="search-results">
      <div 
        v-for="result in searchResults" 
        :key="result.id"
        class="search-result-item"
        @click="selectResult(result)"
      >
        {{ result.title }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const searchQuery = ref('')
const searchResults = ref([])

const onSearch = () => {
  if (searchQuery.value.length < 2) {
    searchResults.value = []
    return
  }
  
  // Здесь будет логика поиска через API
  // Пока заглушка
  console.log('Searching for:', searchQuery.value)
}

const selectResult = (result) => {
  console.log('Selected result:', result)
  // Логика выбора результата
}
</script>

<style scoped>
.global-search {
  position: relative;
}

.search-container {
  position: relative;
  display: flex;
  align-items: center;
}

.search-input {
  width: 300px;
  height: 44px;
  padding: 0 44px 0 16px;
  border: none;
  background: transparent;
  border-radius: 10px;
  font-size: 14px;
  transition: all 0.3s ease;
  color: #374151;
}

.search-input::placeholder {
  color: #9ca3af;
  transition: color 0.2s ease;
}

.search-input:focus {
  outline: none;
  color: #1f2937;
}

.search-input:focus::placeholder {
  color: #6b7280;
}

.search-icon {
  position: absolute;
  right: 12px;
  pointer-events: none;
}

.search-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 100;
  margin-top: 4px;
}

.search-result-item {
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid #F3F4F6;
  transition: background-color 0.2s;
}

.search-result-item:hover {
  background-color: #F9FAFB;
}

.search-result-item:last-child {
  border-bottom: none;
}
</style>