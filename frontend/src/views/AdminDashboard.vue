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
              <div class="upload-icon">
                <i class="fas fa-cloud-upload-alt"></i>
              </div>
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
                <button @click="removeFile(index)" class="remove-btn">
                  <i class="fas fa-times"></i>
                </button>
              </div>
            </div>
            
            <div class="upload-actions">
              <button @click="uploadFiles" :disabled="uploading" class="btn btn-primary">
                <i v-if="uploading" class="fas fa-spinner fa-spin"></i>
                <i v-else class="fas fa-upload"></i>
                {{ uploading ? 'Загрузка...' : 'Загрузить файлы' }}
              </button>
              <button @click="clearFiles" class="btn btn-secondary">
                <i class="fas fa-trash"></i> Очистить
              </button>
            </div>
          </div>
          
          <!-- Upload results -->
          <div v-if="uploadResults.length > 0" class="upload-results">
            <h4>Результаты загрузки</h4>
            <div class="results-summary">
              <span class="success"><i class="fas fa-check-circle"></i> Успешно: {{ uploadResults.filter(r => r.success).length }}</span>
              <span class="error"><i class="fas fa-times-circle"></i> Ошибки: {{ uploadResults.filter(r => !r.success).length }}</span>
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
                <i class="fas fa-sync-alt"></i> Обновить
              </button>
              <button 
                @click="publishAllDocuments" 
                :disabled="!unpublishedClaims.length || publishing"
                class="btn btn-success"
              >
                <i v-if="publishing" class="fas fa-spinner fa-spin"></i>
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
              <i class="fas fa-plus"></i> Добавить партнера
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
                <th>Действия</th>
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
                <td>{{ formatDateTime(partner.LastVisit) || '—' }}</td>
                <td>{{ formatDate(partner.CreatedAt) }}</td>
                <td>
                  <span :class="['status', partner.IsActive ? 'active' : 'inactive']">
                    {{ partner.IsActive ? 'Активен' : 'Неактивен' }}
                  </span>
                </td>
                <td>
                  <div class="action-buttons">
                    <button @click="editPartner(partner)" class="btn-icon btn-edit" title="Редактировать">
                      <i class="fas fa-edit"></i>
                    </button>
                    <button @click="viewPartnerDocuments(partner)" class="btn-icon btn-docs" title="Документы">
                      <i class="fas fa-file-alt"></i>
                    </button>
                    <button @click="deletePartner(partner)" class="btn-icon btn-delete" title="Удалить">
                      <i class="fas fa-trash"></i>
                    </button>
                  </div>
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
            <label>Логин *</label>
            <input v-model="newPartner.alias" type="text" required placeholder="Уникальный логин для входа" />
          </div>
          
          <div class="form-group">
            <label>Пароль *</label>
            <input v-model="newPartner.password" type="password" required placeholder="Пароль для входа" />
          </div>
        </form>
        
        <div class="modal-footer">
          <button type="button" @click="showCreatePartnerModal = false" class="btn btn-secondary">
            Отмена
          </button>
          <button @click="createPartner" :disabled="creatingPartner" class="btn btn-primary">
            <i v-if="creatingPartner" class="fas fa-spinner fa-spin"></i>
            {{ creatingPartner ? 'Создание...' : 'Создать' }}
          </button>
        </div>
      </div>
    </div>
    
    <!-- Edit Partner Modal -->
    <div v-if="showEditPartnerModal" class="modal-overlay" @click.self="showEditPartnerModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>Редактировать партнера</h3>
          <button @click="showEditPartnerModal = false" class="close-btn">×</button>
        </div>
        
        <form @submit.prevent="updatePartner" class="modal-body">
          <div class="form-group">
            <label>Имя партнера *</label>
            <input v-model="partnerToEdit.name" type="text" required />
          </div>
          
          <div class="form-group">
            <label>Email *</label>
            <input v-model="partnerToEdit.email" type="email" required />
          </div>
          
          <div class="form-group">
            <label>Telegram (опционально)</label>
            <input v-model="partnerToEdit.telegram" type="text" placeholder="@username или username" />
          </div>
          
          <div class="form-group">
            <label>Логин</label>
            <input v-model="partnerToEdit.alias" type="text" required />
          </div>
          
          <div class="form-group">
            <label>Новый пароль (опционально)</label>
            <input v-model="partnerToEdit.newPassword" type="password" placeholder="Оставьте пустым, чтобы не менять" />
          </div>
        </form>
        
        <div class="modal-footer">
          <button type="button" @click="showEditPartnerModal = false" class="btn btn-secondary">
            Отмена
          </button>
          <button @click="updatePartner" :disabled="editingPartner" class="btn btn-primary">
            <i v-if="editingPartner" class="fas fa-spinner fa-spin"></i>
            {{ editingPartner ? 'Сохранение...' : 'Сохранить' }}
          </button>
        </div>
      </div>
    </div>
    
    <!-- Partner Documents Modal -->
    <div v-if="showPartnerDocumentsModal" class="modal-overlay" @click.self="showPartnerDocumentsModal = false">
      <div class="modal modal-large">
        <div class="modal-header">
          <h3>Документы партнера: {{ partnerToEdit?.name }}</h3>
          <button @click="showPartnerDocumentsModal = false" class="close-btn">×</button>
        </div>
        
        <div class="modal-body">
          <table v-if="partnerDocuments.length > 0" class="documents-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Дата</th>
                <th>Файл</th>
                <th>Размер</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="doc in partnerDocuments" :key="doc.inc">
                <td>{{ doc.inc }}</td>
                <td>{{ formatDate(doc.uploadedAt) }}</td>
                <td>{{ doc.filename }}</td>
                <td>{{ formatFileSize(doc.size) }}</td>
                <td>{{ doc.publishedAt ? 'Опубликован' : 'Не опубликован' }}</td>
              </tr>
            </tbody>
          </table>
          <p v-else>Документы не найдены</p>
        </div>
        
        <div class="modal-footer">
          <button @click="showPartnerDocumentsModal = false" class="btn btn-secondary">
            Закрыть
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
const showEditPartnerModal = ref(false)
const editingPartner = ref(false)
const partnerToEdit = ref(null)
const showPartnerDocumentsModal = ref(false)
const partnerDocuments = ref([])
const newPartner = ref({
  name: '',
  email: '',
  telegram: '',
  alias: '',
  password: ''
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

// Partner management methods
const editPartner = (partner) => {
  partnerToEdit.value = {
    Inc: partner.Inc,
    name: partner.Name,
    email: partner.Email,
    telegram: partner.Telegram,
    alias: partner.Alias || '',
    newPassword: ''
  }
  showEditPartnerModal.value = true
}

const updatePartner = async () => {
  editingPartner.value = true
  try {
    const updateData = {
      name: partnerToEdit.value.name,
      email: partnerToEdit.value.email,
      telegram: partnerToEdit.value.telegram,
      alias: partnerToEdit.value.alias
    }
    
    if (partnerToEdit.value.newPassword) {
      updateData.password = partnerToEdit.value.newPassword
    }
    
    await api.put(`/admin/partners/${partnerToEdit.value.Inc}`, updateData)
    
    notificationStore.addNotification({
      type: 'success',
      message: 'Партнер успешно обновлен'
    })
    
    showEditPartnerModal.value = false
    partnerToEdit.value = null
    loadPartners()
    
  } catch (error) {
    console.error('Ошибка обновления партнера:', error)
    notificationStore.addNotification({
      type: 'error',
      message: 'Ошибка обновления партнера: ' + (error.response?.data?.message || error.message)
    })
  } finally {
    editingPartner.value = false
  }
}

const deletePartner = async (partner) => {
  if (!confirm(`Вы уверены, что хотите удалить партнера "${partner.Name}"? Это действие нельзя отменить.`)) return
  
  try {
    await api.delete(`/admin/partners/${partner.Inc}`)
    
    notificationStore.addNotification({
      type: 'success',
      message: 'Партнер успешно удален'
    })
    
    loadPartners()
    loadData()
    
  } catch (error) {
    console.error('Ошибка удаления партнера:', error)
    notificationStore.addNotification({
      type: 'error',
      message: 'Ошибка удаления партнера: ' + (error.response?.data?.message || error.message)
    })
  }
}

const viewPartnerDocuments = async (partner) => {
  partnerToEdit.value = partner
  try {
    const response = await api.get(`/admin/partners/${partner.Inc}/documents`)
    partnerDocuments.value = response.data.documents
    showPartnerDocumentsModal.value = true
  } catch (error) {
    console.error('Ошибка загрузки документов:', error)
    notificationStore.addNotification({
      type: 'error',
      message: 'Ошибка загрузки документов партнера'
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
    
    let message = 'Партнер успешно создан'
    
    notificationStore.addNotification({
      type: 'success',
      message: message
    })
    
    showCreatePartnerModal.value = false
    newPartner.value = { name: '', email: '', telegram: '', alias: '', password: '' }
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

const formatDateTime = (date) => {
  if (!date) return ''
  return new Date(date).toLocaleString('ru-RU', { 
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
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
  background: #f8fafc;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-weight: 400;
  position: relative;
}

.dashboard-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.stat-card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  gap: 16px;
  transition: all 0.2s ease;
  border: 1px solid #e5e7eb;
  position: relative;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 16px;
  right: 16px;
  height: 3px;
  background: #2563eb;
  border-radius: 2px;
}

.stat-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-color: #2563eb;
}

.stat-icon {
  font-size: 2.5rem;
  opacity: 0.9;
  color: #2563eb;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 1.8rem;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 6px;
}

.stat-label {
  color: #64748b;
  font-size: 0.9rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.tabs {
  display: flex;
  background: white;
  border-radius: 0;
  margin-bottom: 0;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  border: 1px solid #e5e7eb;
  border-bottom: 2px solid #e5e7eb;
}

.tab {
  flex: 1;
  padding: 16px 24px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
  transition: all 0.2s ease;
  position: relative;
  text-align: center;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
}

.tab:hover {
  color: #2563eb;
  background: #f9fafb;
}

.tab.active {
  color: #2563eb;
  background: white;
  font-weight: 600;
  border-bottom-color: #2563eb;
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
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 50%;
  width: 26px;
  height: 26px;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-btn:hover {
  background: #dc2626;
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
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
  background: white;
  flex-wrap: wrap;
  gap: 16px;
}

.section-header h3 {
  margin: 0;
  color: #1e293b;
  font-weight: 600;
  font-size: 18px;
}

.actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.upload-area {
  border: 2px dashed #cbd5e1;
  border-radius: 8px;
  padding: 60px 40px;
  text-align: center;
  background: #f9fafb;
  transition: all 0.2s ease;
  cursor: pointer;
  position: relative;
}

.upload-area:hover {
  border-color: #2563eb;
  background: #f1f5f9;
}

.upload-area.dragover {
  border-color: #2563eb;
  background: #e0e7ff;
  border-style: solid;
}

.upload-content p {
  color: #64748b;
  margin: 16px 0;
  font-size: 16px;
}

.upload-hint {
  color: #94a3b8;
  font-size: 14px;
}

.link-btn {
  color: #2563eb;
  text-decoration: none;
  font-weight: 500;
  border-bottom: 1px solid transparent;
  transition: all 0.2s ease;
}

.link-btn:hover {
  border-bottom-color: #2563eb;
}

.documents-table,
.partners-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 0;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.documents-table th,
.documents-table td,
.partners-table th,
.partners-table td {
  padding: 14px 16px;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
  font-size: 14px;
}

.documents-table th,
.partners-table th {
  background: #f9fafb;
  font-weight: 600;
  color: #374151;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.documents-table tbody tr,
.partners-table tbody tr {
  transition: background-color 0.2s ease;
}

.documents-table tbody tr:hover,
.partners-table tbody tr:hover {
  background: #f9fafb;
}

.documents-table tbody tr:last-child td,
.partners-table tbody tr:last-child td {
  border-bottom: none;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.bulk-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: #f9fafb;
  border-top: 1px solid #e5e7eb;
  flex-wrap: wrap;
  gap: 12px;
}

.status {
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  display: inline-block;
}

.status.uploaded {
  background: #fef3c7;
  color: #78350f;
}

.status.published {
  background: #d1fae5;
  color: #065f46;
}

.status.error {
  background: #fee2e2;
  color: #991b1b;
}

.status.active {
  background: #d1fae5;
  color: #065f46;
}

.status.inactive {
  background: #fee2e2;
  color: #991b1b;
}

.password-status.set {
  color: #10b981;
  font-weight: 600;
}

.password-status.not-set {
  color: #ef4444;
  font-weight: 600;
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
  padding: 20px;
}

.modal {
  background: white;
  border-radius: 8px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  border: 1px solid #e5e7eb;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
  background: white;
}

.modal-header h3 {
  margin: 0;
  color: #1e293b;
  font-weight: 600;
  font-size: 18px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #6b7280;
  transition: color 0.2s ease;
  width: 32px;
  height: 32px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: #f3f4f6;
  color: #1f2937;
}

.modal-body {
  padding: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #374151;
  font-size: 14px;
}

.form-group input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  transition: all 0.2s ease;
  background: white;
}

.form-group input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 20px 24px;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
  border-radius: 5px;
}

.btn-primary {
  background: #2563eb;
  color: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.btn-primary:hover {
  background: #1d4ed8;
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3);
}

.btn-secondary {
  background: #64748b;
  color: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.btn-secondary:hover {
  background: #475569;
  box-shadow: 0 2px 6px rgba(100, 116, 139, 0.3);
}

.btn-success {
  background: #10b981;
  color: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.btn-success:hover {
  background: #059669;
  box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3);
}

.btn-danger {
  background: #ef4444;
  color: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.btn-danger:hover {
  background: #dc2626;
  box-shadow: 0 2px 6px rgba(239, 68, 68, 0.3);
}

.btn-info {
  background: #06b6d4;
  color: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.btn-info:hover {
  background: #0891b2;
  box-shadow: 0 2px 6px rgba(6, 182, 212, 0.3);
}

.btn:disabled {
  background: #e5e7eb;
  color: #9ca3af;
  cursor: not-allowed;
  box-shadow: none;
}

.btn:disabled:hover {
  background: #e5e7eb;
  box-shadow: none;
}

.empty-state {
  text-align: center;
  padding: 80px 40px;
  color: #64748b;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.empty-icon {
  font-size: 5rem;
  margin-bottom: 24px;
  opacity: 0.6;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1));
}

/* Icons */


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

/* Modern animations and effects */
.tab-content {
  animation: fadeInUp 0.4s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.stat-card {
  animation: slideInUp 0.6s ease-out;
  animation-fill-mode: both;
}

.stat-card:nth-child(1) { animation-delay: 0.1s; }
.stat-card:nth-child(2) { animation-delay: 0.2s; }
.stat-card:nth-child(3) { animation-delay: 0.3s; }

@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.documents-table tbody tr,
.partners-table tbody tr {
  animation: fadeInScale 0.3s ease-out;
  animation-fill-mode: both;
}

.documents-table tbody tr:nth-child(odd),
.partners-table tbody tr:nth-child(odd) {
  animation-delay: 0.05s;
}

.documents-table tbody tr:nth-child(even),
.partners-table tbody tr:nth-child(even) {
  animation-delay: 0.1s;
}

@keyframes fadeInScale {
  from {
    opacity: 0;
    transform: scale(0.98);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* Enhanced focus states */
.form-group input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

/* Smooth transitions for all interactive elements */
.tab,
.btn,
.remove-btn,
.close-btn,
.form-group input,
.documents-table tbody tr,
.partners-table tbody tr,
.stat-card {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Glass morphism effect for special elements */
.section-header {
  backdrop-filter: blur(10px);
  background: rgba(248, 250, 252, 0.8);
  border-bottom: 1px solid rgba(226, 232, 240, 0.5);
}
.btn-small {
  padding: 8px 16px;
  font-size: 12px;
  border-radius: 8px;
  margin-right: 6px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.btn-small:hover {
  background: #0891b2;
}

.btn-info {
  background: #06b6d4;
  color: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.btn-info:hover {
  background: #0891b2;
  box-shadow: 0 2px 6px rgba(6, 182, 212, 0.3);
}

.btn-danger {
  background: #dc3545;
  color: white;
  border: 1px solid #dc3545;
}

.btn-danger:hover {
  background: #c82333;
  border-color: #bd2130;
}

.modal-large {
  width: 900px;
  max-width: 95vw;
  max-height: 80vh;
}

.partners-table th:last-child,
.partners-table td:last-child {
  width: 220px;
}

@media (max-width: 768px) {
  .dashboard-container {
    padding: 16px;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  
  .stat-card {
    padding: 12px;
    gap: 8px;
  }
  
  .stat-icon {
    font-size: 1.5rem;
  }
  
  .stat-value {
    font-size: 1.3rem;
  }
  
  .stat-label {
    font-size: 0.7rem;
  }
  
  .tabs {
    flex-direction: column;
  }
  
  .tab {
    text-align: left;
    padding: 14px 20px;
  }
  
  .section-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .actions {
    flex-direction: column;
  }
  
  .actions .btn {
    width: 100%;
    justify-content: center;
  }
  
  .upload-area {
    padding: 40px 20px;
  }
  
  .documents-table,
  .partners-table {
    display: block;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  
  .documents-table th,
  .documents-table td,
  .partners-table th,
  .partners-table td {
    padding: 12px 10px;
    font-size: 13px;
  }
  
  .bulk-actions {
    flex-direction: column;
    align-items: stretch;
  }
  
  .bulk-actions .btn {
    width: 100%;
    justify-content: center;
  }
  
  .modal {
    width: calc(100vw - 32px);
    max-width: 100%;
  }
  
  .modal-header,
  .modal-body,
  .modal-footer {
    padding: 16px;
  }
  
  .stat-card {
    padding: 12px;
  }
  
  .action-buttons {
    flex-direction: column;
    gap: 6px;
  }
  
  .action-buttons .btn-icon {
    width: 100%;
    margin-right: 0;
  }
}

.btn-icon {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: all 0.2s ease;
  margin-right: 4px;
}

.btn-icon:last-child {
  margin-right: 0;
}

.btn-edit {
  background: #64748b;
  color: white;
}

.btn-edit:hover {
  background: #475569;
}

.btn-docs {
  background: #06b6d4;
  color: white;
}

.btn-docs:hover {
  background: #0891b2;
}

.btn-delete {
  background: #ef4444;
  color: white;
}

.btn-delete:hover {
  background: #dc2626;
}

</style>