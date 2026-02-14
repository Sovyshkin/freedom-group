<template>
  <div class="partner-dashboard">
    <!-- Main content -->
    <div class="dashboard-container">
      <!-- Stats cards -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-content">
            <div class="stat-value">{{ stats.totalDocuments || 0 }}</div>
            <div class="stat-label">Всего документов</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-content">
            <div class="stat-value">{{ formatMoney(stats.yearlyAmount) }}</div>
            <div class="stat-label">За год</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-content">
            <div class="stat-value">{{ formatMoney(stats.monthlyAmount) }}</div>
            <div class="stat-label">За месяц</div>
          </div>
        </div>
      </div>
      
      <!-- Documents table -->
      <div class="documents-section">
        <div class="section-header">
          <h2>Мои документы</h2>
          <div class="search-controls">
            <input 
              v-model="searchQuery" 
              type="text" 
              placeholder="Поиск по имени файла..."
              class="search-input"
              @input="handleSearch"
            />
            <button @click="toggleFilters" class="filter-btn">
              <i class="icon-filter"></i> Фильтры
            </button>
          </div>
        </div>
        
        <!-- Filters panel -->
        <div v-if="showFilters" class="filters-panel">
          <div class="filter-row">
            <div class="filter-group">
              <label>Дата с:</label>
              <input v-model="filters.dateFrom" type="date" />
            </div>
            <div class="filter-group">
              <label>Дата до:</label>
              <input v-model="filters.dateTo" type="date" />
            </div>
            <div class="filter-group">
              <label>Сумма от:</label>
              <input v-model="filters.amountFrom" type="number" placeholder="0" />
            </div>
            <div class="filter-group">
              <label>Сумма до:</label>
              <input v-model="filters.amountTo" type="number" placeholder="1000000" />
            </div>
            <div class="filter-actions">
              <button @click="applyFilters" class="btn btn-primary">Применить</button>
              <button @click="clearFilters" class="btn btn-secondary">Очистить</button>
            </div>
          </div>
        </div>
        
        <!-- Documents table -->
        <div class="table-wrapper">
          <AppLoader v-if="loading" />
          
          <table v-else-if="documents.length > 0" class="documents-table">
            <thead>
              <tr>
                <th>№</th>
                <th @click="sortBy('publishedAt')" class="sortable">
                  Дата создания
                  <i :class="getSortIcon('publishedAt')"></i>
                </th>
                <th>Период</th>
                <th @click="sortBy('amount')" class="sortable">
                  Чистая сумма
                  <i :class="getSortIcon('amount')"></i>
                </th>
                <th>Сумма по счету</th>
                <th>Налог</th>
                <th>Скачать</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(doc, index) in paginatedDocuments" :key="doc.id">
                <td>{{ (currentPage - 1) * pageSize + index + 1 }}</td>
                <td>{{ formatDate(doc.publishedAt) }}</td>
                <td>{{ doc.period }}</td>
                <td class="amount">{{ formatMoney(doc.amount) }}</td>
                <td class="amount">{{ formatMoney(doc.payAmount) }}</td>
                <td class="amount">{{ formatMoney(doc.taxAmount) }}</td>
                <td>
                  <button 
                    @click="downloadDocument(doc)" 
                    class="btn btn-download"
                    :disabled="downloading === doc.documentId"
                  >
                    <i v-if="downloading === doc.documentId" class="icon-spinner"></i>
                    <i v-else class="icon-download"></i>
                    {{ doc.fileName }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          
          <div v-else class="empty-state">
            <div class="empty-icon">📄</div>
            <h3>Документы не найдены</h3>
            <p>У вас пока нет доступных документов или они не соответствуют критериям поиска.</p>
          </div>
        </div>
        
        <!-- Pagination -->
        <div v-if="totalPages > 1" class="pagination">
          <button 
            @click="changePage(currentPage - 1)"
            :disabled="currentPage === 1"
            class="pagination-btn"
          >
            ← Предыдущая
          </button>
          
          <div class="pagination-info">
            Страница {{ currentPage }} из {{ totalPages }} (всего {{ filteredDocuments.length }} документов)
          </div>
          
          <button 
            @click="changePage(currentPage + 1)"
            :disabled="currentPage === totalPages"
            class="pagination-btn"
          >
            Следующая →
          </button>
        </div>
      </div>
    </div>
    
    <!-- Notifications -->
    <AppNotifications />
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import AppLoader from '@/components/AppLoader.vue'
import AppNotifications from '@/components/AppNotifications.vue'
import { useNotificationStore } from '@/stores/notifications'
import api from '@/plugins/axios'

const notificationStore = useNotificationStore()

// Reactive data
const loading = ref(true)
const downloading = ref(null)
const documents = ref([])
const stats = ref({})
const user = ref(null)

// Search and filters
const searchQuery = ref('')
const showFilters = ref(false)
const filters = ref({
  dateFrom: '',
  dateTo: '',
  amountFrom: '',
  amountTo: ''
})

// Sorting
const sortField = ref('publishedAt')
const sortOrder = ref('desc')

// Pagination
const currentPage = ref(1)
const pageSize = ref(10)

// Computed properties
const filteredDocuments = computed(() => {
  let result = [...documents.value]
  
  // Apply search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(doc => 
      doc.fileName.toLowerCase().includes(query) ||
      doc.period.toLowerCase().includes(query)
    )
  }
  
  // Apply sorting
  result.sort((a, b) => {
    const aVal = a[sortField.value]
    const bVal = b[sortField.value]
    
    if (sortOrder.value === 'asc') {
      return aVal > bVal ? 1 : -1
    } else {
      return aVal < bVal ? 1 : -1
    }
  })
  
  return result
})

const totalPages = computed(() => {
  return Math.ceil(filteredDocuments.value.length / pageSize.value)
})

const paginatedDocuments = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredDocuments.value.slice(start, end)
})

// Methods
const loadData = async () => {
  try {
    loading.value = true
    
    // Load user profile
    const profileResponse = await api.get('/partner/profile')
    user.value = profileResponse.data.profile
    
    // Load documents
    const documentsResponse = await api.get('/partner/documents')
    documents.value = documentsResponse.data.documents
    
    // Load stats
    const statsResponse = await api.get('/partner/stats')
    stats.value = statsResponse.data.stats
    
  } catch (error) {
    console.error('Ошибка загрузки данных:', error)
    notificationStore.addNotification({
      type: 'error',
      message: 'Ошибка загрузки данных: ' + (error.response?.data?.message || error.message)
    })
  } finally {
    loading.value = false
  }
}

const downloadDocument = async (doc) => {
  try {
    downloading.value = doc.documentId
    
    const response = await api.get(`/partner/documents/${doc.documentId}/download`, {
      responseType: 'blob'
    })
    
    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', doc.fileName)
    document.body.appendChild(link)
    link.click()
    link.remove()
    
    notificationStore.addNotification({
      type: 'success',
      message: `Файл "${doc.fileName}" успешно скачан`
    })
    
  } catch (error) {
    console.error('Ошибка скачивания:', error)
    notificationStore.addNotification({
      type: 'error',
      message: 'Ошибка скачивания файла: ' + (error.response?.data?.message || error.message)
    })
  } finally {
    downloading.value = null
  }
}

const handleSearch = () => {
  currentPage.value = 1
}

const toggleFilters = () => {
  showFilters.value = !showFilters.value
}

const applyFilters = async () => {
  try {
    loading.value = true
    
    const params = new URLSearchParams()
    if (filters.value.dateFrom) params.append('dateFrom', filters.value.dateFrom)
    if (filters.value.dateTo) params.append('dateTo', filters.value.dateTo)
    if (filters.value.amountFrom) params.append('amountFrom', filters.value.amountFrom)
    if (filters.value.amountTo) params.append('amountTo', filters.value.amountTo)
    if (searchQuery.value) params.append('fileName', searchQuery.value)
    
    const response = await api.get(`/partner/documents/search?${params.toString()}`)
    documents.value = response.data.documents
    currentPage.value = 1
    
  } catch (error) {
    console.error('Ошибка поиска:', error)
    notificationStore.addNotification({
      type: 'error',
      message: 'Ошибка поиска документов'
    })
  } finally {
    loading.value = false
  }
}

const clearFilters = () => {
  filters.value = {
    dateFrom: '',
    dateTo: '',
    amountFrom: '',
    amountTo: ''
  }
  searchQuery.value = ''
  loadData()
}

const sortBy = (field) => {
  if (sortField.value === field) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = field
    sortOrder.value = 'desc'
  }
}

const getSortIcon = (field) => {
  if (sortField.value !== field) return 'icon-sort'
  return sortOrder.value === 'asc' ? 'icon-sort-up' : 'icon-sort-down'
}

const changePage = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
  }
}

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('ru-RU')
}

const formatMoney = (amount) => {
  if (!amount) return '0 ₽'
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB'
  }).format(amount)
}

// Watchers
watch([searchQuery, sortField, sortOrder], () => {
  currentPage.value = 1
})

// Lifecycle
onMounted(() => {
  loadData()
})
</script>

<style scoped>
.partner-dashboard {
  min-height: 100vh;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  font-family: 'Inter', sans-serif;
  font-weight: 500;
  position: relative;
}

.partner-dashboard::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 200px;
  background: linear-gradient(135deg, rgba(18, 51, 234, 0.05) 0%, transparent 100%);
  pointer-events: none;
}

.dashboard-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  font-size: 2.5rem;
  opacity: 0.8;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 1.8rem;
  font-weight: 700;
  color: #2c3e50;
  margin-bottom: 4px;
}

.stat-label {
  color: #6c757d;
  font-size: 0.9rem;
}

.documents-section {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  border-bottom: 1px solid #e9ecef;
}

.section-header h2 {
  margin: 0;
  color: #2c3e50;
}

.search-controls {
  display: flex;
  gap: 12px;
  align-items: center;
}

.search-input {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 8px;
  width: 250px;
  font-size: 14px;
}

.filter-btn {
  padding: 8px 16px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
}

.filter-btn:hover {
  background: #5a6268;
}

.filters-panel {
  padding: 20px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
}

.filter-row {
  display: flex;
  gap: 16px;
  align-items: end;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.filter-group label {
  font-size: 12px;
  color: #6c757d;
  font-weight: 500;
}

.filter-group input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  width: 140px;
}

.filter-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.table-wrapper {
  min-height: 400px;
  padding: 24px;
}

.documents-table {
  width: 100%;
  border-collapse: collapse;
}

.documents-table th,
.documents-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #e9ecef;
}

.documents-table th {
  background: #f8f9fa;
  font-weight: 600;
  color: #495057;
  font-size: 14px;
}

.documents-table th.sortable {
  cursor: pointer;
  user-select: none;
  position: relative;
}

.documents-table th.sortable:hover {
  background: #e9ecef;
}

.documents-table th i {
  margin-left: 8px;
  opacity: 0.5;
}

.documents-table td {
  font-size: 14px;
  color: #495057;
}

.documents-table .amount {
  font-family: 'Courier New', monospace;
  font-weight: 600;
  text-align: right;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.btn-primary {
  background-color: #1233EA;
  color: white;
  font-family: 'Inter', sans-serif;
  font-weight: 500;
}

.btn-primary:hover {
  background-color: #0f29d1;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #545b62;
}

.btn-download {
  background: #28a745;
  color: white;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.btn-download:hover {
  background: #1e7e34;
}

.btn-download:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #6c757d;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 20px;
  opacity: 0.5;
}

.empty-state h3 {
  margin: 0 0 12px;
  color: #495057;
}

.empty-state p {
  margin: 0;
  font-size: 14px;
}

.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-top: 1px solid #e9ecef;
  background: #f8f9fa;
}

.pagination-btn {
  padding: 8px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.pagination-btn:hover:not(:disabled) {
  background: #0056b3;
}

.pagination-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.pagination-info {
  font-size: 14px;
  color: #6c757d;
}

/* Icons */
.icon-filter::before { content: '🔍'; }
.icon-download::before { content: '⬇️'; }
.icon-spinner::before { content: '⏳'; }
.icon-sort::before { content: '↕️'; }
.icon-sort-up::before { content: '⬆️'; }
.icon-sort-down::before { content: '⬇️'; }

@media (max-width: 768px) {
  .dashboard-container {
    padding: 16px;
  }
  
  .section-header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }
  
  .search-controls {
    justify-content: stretch;
  }
  
  .search-input {
    flex: 1;
  }
  
  .filter-row {
    flex-direction: column;
    align-items: stretch;
  }
  
  .filter-group input {
    width: 100%;
  }
  
  .pagination {
    flex-direction: column;
    gap: 12px;
  }
  
  .documents-table {
    display: block;
    overflow-x: auto;
    white-space: nowrap;
  }
}
</style>