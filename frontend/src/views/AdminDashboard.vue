<template>
  <div class="admin-dashboard">
    <!-- Main content -->
    <div class="dashboard-container">
      <!-- Stats cards -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-content">
            <div class="stat-value">{{ stats.totalPartners || 0 }}</div>
            <div class="stat-label">Всего партнеров</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-content">
            <div class="stat-value">{{ stats.documentsThisMonth || 0 }}</div>
            <div class="stat-label">Документов за месяц</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-content">
            <div class="stat-value">{{ stats.unpublishedDocuments || 0 }}</div>
            <div class="stat-label">К публикации</div>
          </div>
        </div>
      </div>
      
      <!-- Navigation tabs -->
      <div class="tabs">
        <button 
          v-for="tab in tabs" 
          :key="tab.id"
          @click="activeTab = tab.id"
          :class="['tab', { active: activeTab === tab.id }]"
        >
          {{ tab.label }}
        </button>
      </div>
      
      <!-- Upload Files Tab -->
      <div v-if="activeTab === 'upload'" class="tab-content">
        <div class="upload-section">
          <h3>Загрузка Excel файлов</h3>
          
          <div class="upload-area" :class="{ dragover: isDragover }" 
               @dragover.prevent="isDragover = true"
               @dragleave.prevent="isDragover = false"
               @drop.prevent="handleDrop">
            <input 
              ref="fileInput"
              type="file" 
              multiple 
              accept=".xlsx,.xls"
              @change="handleFileSelect"
              style="display: none"
            />
            
            <div class="upload-content">
              <div class="upload-icon">📁</div>
              <p>Перетащите Excel файлы сюда или <button @click="$refs.fileInput.click()" class="link-btn">выберите файлы</button></p>
              <p class="upload-hint">Поддерживаются файлы: .xlsx, .xls (максимум 50 файлов)</p>
            </div>
          </div>
          
          <!-- Selected files -->
          <div v-if="selectedFiles.length > 0" class="selected-files">
            <h4>Выбранные файлы ({{ selectedFiles.length }})</h4>
            <div class="file-list">
              <div v-for="(file, index) in selectedFiles" :key="index" class="file-item">
                <div class="file-info">
                  <div class="file-name">{{ file.name }}</div>
                  <div class="file-size">{{ formatFileSize(file.size) }}</div>
                </div>
                <button @click="removeFile(index)" class="remove-btn">×</button>
              </div>
            </div>
            
            <div class="upload-actions">
              <button @click="uploadFiles" :disabled="uploading" class="btn btn-primary">
                <i v-if="uploading" class="icon-spinner"></i>
                {{ uploading ? 'Загрузка...' : 'Загрузить файлы' }}
              </button>
              <button @click="clearFiles" class="btn btn-secondary">Очистить</button>
            </div>
          </div>
          
          <!-- Upload results -->
          <div v-if="uploadResults.length > 0" class="upload-results">
            <h4>Результаты загрузки</h4>
            <div class="results-summary">
              <span class="success">✅ Успешно: {{ uploadResults.filter(r => r.success).length }}</span>
              <span class="error">❌ Ошибки: {{ uploadResults.filter(r => !r.success).length }}</span>
            </div>
            
            <div class="results-list">
              <div v-for="result in uploadResults" :key="result.fileName" class="result-item" :class="{ error: !result.success }">
                <div class="result-file">{{ result.fileName }}</div>
                <div class="result-status">
                  {{ result.success ? 'Успешно загружен' : result.error }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Documents Tab -->
      <div v-if="activeTab === 'documents'" class="tab-content">
        <div class="documents-section">
          <div class="section-header">
            <h3>Неопубликованные документы</h3>
            <div class="actions">
              <button @click="refreshDocuments" class="btn btn-secondary">
                <i class="icon-refresh"></i> Обновить
              </button>
              <button 
                @click="publishAllDocuments" 
                :disabled="!unpublishedClaims.length || publishing"
                class="btn btn-success"
              >
                <i v-if="publishing" class="icon-spinner"></i>
                Опубликовать все ({{ unpublishedClaims.length }})
              </button>
            </div>
          </div>
          
          <AppLoader v-if="loadingDocuments" />
          
          <div v-else-if="unpublishedClaims.length === 0" class="empty-state">
            <div class="empty-icon">📄</div>
            <h3>Нет документов для публикации</h3>
            <p>Все загруженные документы уже опубликованы</p>
          </div>
          
          <table v-else class="documents-table">
            <thead>
              <tr>
                <th>
                  <input 
                    type="checkbox" 
                    :checked="selectedClaims.length === unpublishedClaims.length"
                    @change="toggleSelectAll"
                  />
                </th>
                <th>Код партнера</th>
                <th>Имя партнера</th>
                <th>Дата создания</th>
                <th>Период</th>
                <th>Файл</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="claim in unpublishedClaims" :key="claim.Inc">
                <td>
                  <input 
                    type="checkbox" 
                    :value="claim.Inc"
                    v-model="selectedClaims"
                  />
                </td>
                <td>{{ claim.Partner }}</td>
                <td>{{ claim.PartnerName }}</td>
                <td>{{ formatDate(claim.Cdate) }}</td>
                <td>{{ formatPeriod(claim.DateBeg, claim.DateEnd) }}</td>
                <td>{{ claim.FileName }}</td>
                <td>
                  <span :class="['status', claim.Status]">
                    {{ getStatusLabel(claim.Status) }}
                  </span>
                </td>
                <td>
                  <div class="action-buttons">
                    <button @click="publishDocument(claim.Inc)" class="btn btn-sm btn-success">
                      Опубликовать
                    </button>
                    <button @click="deleteDocument(claim.Inc)" class="btn btn-sm btn-danger">
                      Удалить
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          
          <!-- Bulk actions -->
          <div v-if="selectedClaims.length > 0" class="bulk-actions">
            <span>Выбрано: {{ selectedClaims.length }}</span>
            <button @click="publishSelectedDocuments" class="btn btn-success">
              Опубликовать выбранные
            </button>
            <button @click="selectedClaims = []" class="btn btn-secondary">
              Снять выделение
            </button>
          </div>
        </div>
      </div>
      
      <!-- Partners Tab -->
      <div v-if="activeTab === 'partners'" class="tab-content">
        <div class="partners-section">
          <div class="section-header">
            <h3>Управление партнерами</h3>
            <button @click="showCreatePartnerModal = true" class="btn btn-primary">
              <i class="icon-plus"></i> Добавить партнера
            </button>
          </div>
          
          <AppLoader v-if="loadingPartners" />
          
          <table v-else class="partners-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Имя</th>
                <th>Email</th>
                <th>Telegram</th>
                <th>Логин</th>
                <th>Пароль установлен</th>
                <th>Последний вход</th>
                <th>Создан</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="partner in partners" :key="partner.Inc">
                <td>{{ partner.Inc }}</td>
                <td>{{ partner.Name }}</td>
                <td>{{ partner.Email }}</td>
                <td>{{ partner.Telegram || '—' }}</td>
                <td>{{ partner.Alias }}</td>
                <td>
                  <span :class="['password-status', partner.PasswordSet ? 'set' : 'not-set']">
                    {{ partner.PasswordSet ? '✅ Да' : '❌ Нет' }}
                  </span>
                </td>
                <td>{{ formatDate(partner.LastVisit) || '—' }}</td>
                <td>{{ formatDate(partner.CreatedAt) }}</td>
                <td>
                  <span :class="['status', partner.IsActive ? 'active' : 'inactive']">
                    {{ partner.IsActive ? 'Активен' : 'Неактивен' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
    
    <!-- Create Partner Modal -->
    <div v-if="showCreatePartnerModal" class="modal-overlay" @click.self="showCreatePartnerModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>Добавить партнера</h3>
          <button @click="showCreatePartnerModal = false" class="close-btn">×</button>
        </div>
        
        <form @submit.prevent="createPartner" class="modal-body">
          <div class="form-group">
            <label>Имя партнера *</label>
            <input v-model="newPartner.name" type="text" required />
          </div>
          
          <div class="form-group">
            <label>Email *</label>
            <input v-model="newPartner.email" type="email" required />
          </div>
          
          <div class="form-group">
            <label>Telegram (опционально)</label>
            <input v-model="newPartner.telegram" type="text" placeholder="@username или username" />
          </div>
          
          <div class="form-group">
            <label>Логин (опционально)</label>
            <input v-model="newPartner.alias" type="text" placeholder="Будет сгенерирован автоматически" />
          </div>
        </form>
        
        <div class="modal-footer">
          <button type="button" @click="showCreatePartnerModal = false" class="btn btn-secondary">
            Отмена
          </button>
          <button @click="createPartner" :disabled="creatingPartner" class="btn btn-primary">
            <i v-if="creatingPartner" class="icon-spinner"></i>
            {{ creatingPartner ? 'Создание...' : 'Создать' }}
          </button>
        </div>
      </div>
    </div>
    
    <!-- Notifications -->
    <AppNotifications />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import AppLoader from '@/components/AppLoader.vue'
import AppNotifications from '@/components/AppNotifications.vue'
import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notifications'
import api from '@/plugins/axios'

const authStore = useAuthStore()
const notificationStore = useNotificationStore()

// Reactive data
const user = ref(null)
const stats = ref({})
const activeTab = ref('upload')

// Tabs
const tabs = [
  { id: 'upload', label: 'Загрузка файлов' },
  { id: 'documents', label: 'Документы' },
  { id: 'partners', label: 'Партнеры' }
]

// File upload
const selectedFiles = ref([])
const uploading = ref(false)
const uploadResults = ref([])
const isDragover = ref(false)

// Documents
const unpublishedClaims = ref([])
const selectedClaims = ref([])
const loadingDocuments = ref(false)
const publishing = ref(false)

// Partners
const partners = ref([])
const loadingPartners = ref(false)
const showCreatePartnerModal = ref(false)
const creatingPartner = ref(false)
const newPartner = ref({
  name: '',
  email: '',
  telegram: '',
  alias: ''
})

// Methods
const loadData = async () => {
  try {
    const response = await api.get('/admin/stats')
    stats.value = response.data.stats
    user.value = authStore.user
  } catch (error) {
    console.error('Ошибка загрузки статистики:', error)
    notificationStore.addNotification({
      type: 'error',
      message: 'Ошибка загрузки данных'
    })
  }
}

const handleFileSelect = (event) => {
  const files = Array.from(event.target.files)
  addFiles(files)
}

const handleDrop = (event) => {
  isDragover.value = false
  const files = Array.from(event.dataTransfer.files)
  addFiles(files)
}

const addFiles = (files) => {
  const excelFiles = files.filter(file => 
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.type === 'application/vnd.ms-excel' ||
    file.name.endsWith('.xlsx') ||
    file.name.endsWith('.xls')
  )
  
  if (excelFiles.length !== files.length) {
    notificationStore.addNotification({
      type: 'warning',
      message: 'Некоторые файлы не являются Excel файлами и были проигнорированы'
    })
  }
  
  selectedFiles.value = [...selectedFiles.value, ...excelFiles]
}

const removeFile = (index) => {
  selectedFiles.value.splice(index, 1)
}

const clearFiles = () => {
  selectedFiles.value = []
  uploadResults.value = []
}

const uploadFiles = async () => {
  if (selectedFiles.value.length === 0) return
  
  uploading.value = true
  const formData = new FormData()
  
  selectedFiles.value.forEach(file => {
    formData.append('files', file)
  })
  
  try {
    const response = await api.post('/admin/upload-files', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    
    uploadResults.value = [
      ...response.data.results.map(r => ({ ...r, success: true })),
      ...response.data.errors.map(e => ({ ...e, success: false }))
    ]
    
    notificationStore.addNotification({
      type: 'success',
      message: response.data.message
    })
    
    selectedFiles.value = []
    refreshDocuments()
    
  } catch (error) {
    console.error('Ошибка загрузки файлов:', error)
    notificationStore.addNotification({
      type: 'error',
      message: 'Ошибка загрузки файлов: ' + (error.response?.data?.message || error.message)
    })
  } finally {
    uploading.value = false
  }
}

const refreshDocuments = async () => {
  loadingDocuments.value = true
  try {
    const response = await api.get('/admin/unpublished-claims')
    unpublishedClaims.value = response.data.data
    selectedClaims.value = []
  } catch (error) {
    console.error('Ошибка загрузки документов:', error)
    notificationStore.addNotification({
      type: 'error',
      message: 'Ошибка загрузки документов'
    })
  } finally {
    loadingDocuments.value = false
  }
}

const publishDocument = async (claimId) => {
  try {
    await api.post('/admin/publish-claims', {
      claimIds: [claimId]
    })
    
    notificationStore.addNotification({
      type: 'success',
      message: 'Документ успешно опубликован'
    })
    
    refreshDocuments()
    loadData()
    
  } catch (error) {
    console.error('Ошибка публикации:', error)
    notificationStore.addNotification({
      type: 'error',
      message: 'Ошибка публикации документа'
    })
  }
}

const publishSelectedDocuments = async () => {
  if (selectedClaims.value.length === 0) return
  
  publishing.value = true
  try {
    const response = await api.post('/admin/publish-claims', {
      claimIds: selectedClaims.value
    })
    
    notificationStore.addNotification({
      type: 'success',
      message: response.data.message
    })
    
    refreshDocuments()
    loadData()
    
  } catch (error) {
    console.error('Ошибка публикации:', error)
    notificationStore.addNotification({
      type: 'error',
      message: 'Ошибка публикации документов'
    })
  } finally {
    publishing.value = false
  }
}

const publishAllDocuments = async () => {
  const allClaimIds = unpublishedClaims.value.map(claim => claim.Inc)
  selectedClaims.value = allClaimIds
  await publishSelectedDocuments()
}

const deleteDocument = async (claimId) => {
  if (!confirm('Вы уверены, что хотите удалить этот документ?')) return
  
  try {
    await api.delete(`/admin/claims/${claimId}`)
    
    notificationStore.addNotification({
      type: 'success',
      message: 'Документ успешно удален'
    })
    
    refreshDocuments()
    loadData()
    
  } catch (error) {
    console.error('Ошибка удаления:', error)
    notificationStore.addNotification({
      type: 'error',
      message: 'Ошибка удаления документа'
    })
  }
}

const toggleSelectAll = () => {
  if (selectedClaims.value.length === unpublishedClaims.value.length) {
    selectedClaims.value = []
  } else {
    selectedClaims.value = unpublishedClaims.value.map(claim => claim.Inc)
  }
}

const loadPartners = async () => {
  loadingPartners.value = true
  try {
    const response = await api.get('/admin/partners')
    partners.value = response.data.data
  } catch (error) {
    console.error('Ошибка загрузки партнеров:', error)
    notificationStore.addNotification({
      type: 'error',
      message: 'Ошибка загрузки партнеров'
    })
  } finally {
    loadingPartners.value = false
  }
}

const createPartner = async () => {
  creatingPartner.value = true
  try {
    await api.post('/admin/partners', newPartner.value)
    
    notificationStore.addNotification({
      type: 'success',
      message: 'Партнер успешно создан'
    })
    
    showCreatePartnerModal.value = false
    newPartner.value = { name: '', email: '', telegram: '', alias: '' }
    loadPartners()
    loadData()
    
  } catch (error) {
    console.error('Ошибка создания партнера:', error)
    notificationStore.addNotification({
      type: 'error',
      message: 'Ошибка создания партнера: ' + (error.response?.data?.message || error.message)
    })
  } finally {
    creatingPartner.value = false
  }
}

// Utility functions
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatDate = (date) => {
  if (!date) return ''
  return new Date(date).toLocaleDateString('ru-RU')
}

const formatPeriod = (dateFrom, dateTo) => {
  const from = new Date(dateFrom).toLocaleDateString('ru-RU')
  const to = new Date(dateTo).toLocaleDateString('ru-RU')
  return `${from} — ${to}`
}

const getStatusLabel = (status) => {
  const labels = {
    uploaded: 'Загружен',
    published: 'Опубликован',
    error: 'Ошибка'
  }
  return labels[status] || status
}

// Watch activeTab to load data
const handleTabChange = () => {
  if (activeTab.value === 'documents') {
    refreshDocuments()
  } else if (activeTab.value === 'partners') {
    loadPartners()
  }
}

// Lifecycle
onMounted(() => {
  loadData()
  refreshDocuments()
})

// Watch activeTab
import { watch } from 'vue'
watch(activeTab, handleTabChange)
</script>

<style scoped>
.admin-dashboard {
  min-height: 100vh;
  background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
  font-family: 'Inter', sans-serif;
  font-weight: 500;
  position: relative;
}

.admin-dashboard::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 300px;
  background: radial-gradient(ellipse at top, rgba(18, 51, 234, 0.1) 0%, transparent 70%);
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

.tabs {
  display: flex;
  background: white;
  border-radius: 12px 12px 0 0;
  margin-bottom: 0;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.tab {
  flex: 1;
  padding: 16px 24px;
  border: none;
  background: #f8f9fa;
  color: #6c757d;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  border-bottom: 3px solid transparent;
  transition: all 0.2s;
}

.tab:hover {
  background: #e9ecef;
  color: #495057;
}

.tab.active {
  background: white;
  color: #007bff;
  border-bottom-color: #007bff;
}

.tab-content {
  background: white;
  border-radius: 0 0 12px 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  min-height: 500px;
}

.upload-section {
  padding: 30px;
}

.upload-area {
  border: 2px dashed #ddd;
  border-radius: 12px;
  padding: 60px 30px;
  text-align: center;
  margin-bottom: 30px;
  transition: all 0.2s;
  cursor: pointer;
}

.upload-area:hover,
.upload-area.dragover {
  border-color: #007bff;
  background: #f8f9ff;
}

.upload-icon {
  font-size: 3rem;
  margin-bottom: 20px;
  opacity: 0.6;
}

.upload-content p {
  margin: 8px 0;
  color: #6c757d;
}

.upload-hint {
  font-size: 12px !important;
  color: #adb5bd !important;
}

.link-btn {
  color: #007bff;
  text-decoration: underline;
  border: none;
  background: none;
  cursor: pointer;
}

.selected-files {
  margin-bottom: 30px;
}

.file-list {
  border: 1px solid #e9ecef;
  border-radius: 8px;
  overflow: hidden;
  margin: 16px 0;
}

.file-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e9ecef;
}

.file-item:last-child {
  border-bottom: none;
}

.file-info {
  flex: 1;
}

.file-name {
  font-weight: 500;
  color: #2c3e50;
}

.file-size {
  font-size: 12px;
  color: #6c757d;
}

.remove-btn {
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}

.upload-actions {
  display: flex;
  gap: 12px;
}

.upload-results {
  margin-top: 30px;
  padding-top: 30px;
  border-top: 1px solid #e9ecef;
}

.results-summary {
  display: flex;
  gap: 20px;
  margin-bottom: 16px;
}

.results-summary .success {
  color: #28a745;
  font-weight: 500;
}

.results-summary .error {
  color: #dc3545;
  font-weight: 500;
}

.results-list {
  border: 1px solid #e9ecef;
  border-radius: 8px;
  overflow: hidden;
}

.result-item {
  display: flex;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #e9ecef;
}

.result-item:last-child {
  border-bottom: none;
}

.result-item.error {
  background: #fff5f5;
  color: #dc3545;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 30px;
  border-bottom: 1px solid #e9ecef;
}

.section-header h3 {
  margin: 0;
  color: #2c3e50;
}

.actions {
  display: flex;
  gap: 12px;
}

.documents-table,
.partners-table {
  width: 100%;
  border-collapse: collapse;
}

.documents-table th,
.documents-table td,
.partners-table th,
.partners-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #e9ecef;
}

.documents-table th,
.partners-table th {
  background: #f8f9fa;
  font-weight: 600;
  color: #495057;
  font-size: 14px;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.bulk-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 30px;
  background: #f8f9fa;
  border-top: 1px solid #e9ecef;
}

.status {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status.uploaded {
  background: #fff3cd;
  color: #856404;
}

.status.published {
  background: #d4edda;
  color: #155724;
}

.status.error {
  background: #f8d7da;
  color: #721c24;
}

.status.active {
  background: #d4edda;
  color: #155724;
}

.status.inactive {
  background: #f8d7da;
  color: #721c24;
}

.password-status.set {
  color: #28a745;
}

.password-status.not-set {
  color: #dc3545;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 12px;
  width: 500px;
  max-width: 90vw;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e9ecef;
}

.modal-header h3 {
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #6c757d;
}

.modal-body {
  padding: 20px;
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
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid #e9ecef;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.btn-sm {
  padding: 4px 8px;
  font-size: 12px;
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

.btn-success {
  background-color: #1233EA;
  color: white;
  font-family: 'Inter', sans-serif;
  font-weight: 500;
}

.btn-success:hover {
  background-color: #0f29d1;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover {
  background: #c82333;
}

.btn:disabled {
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

/* Icons */
.icon-plus::before { content: '➕'; }
.icon-refresh::before { content: '🔄'; }
.icon-spinner::before { content: '⏳'; }

@media (max-width: 768px) {
  .dashboard-container {
    padding: 16px;
  }
  
  .tabs {
    flex-direction: column;
  }
  
  .section-header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }
  
  .actions {
    justify-content: stretch;
  }
  
  .upload-area {
    padding: 40px 20px;
  }
  
  .documents-table,
  .partners-table {
    display: block;
    overflow-x: auto;
    white-space: nowrap;
  }
  
  .bulk-actions {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .modal {
    width: 100%;
    margin: 20px;
    max-width: calc(100vw - 40px);
  }
}
</style>