<template>
  <div class="admin-dashboard">
    <!-- Main content -->
    <div class="dashboard-container">
      <!-- Stats cards -->
          <div v-if="loadingStats">
            <AppLoader />
          </div>
          <div v-else class="stats-grid">
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
      
      <!-- Documents Tab -->
      <div v-if="activeTab === 'documents'" class="tab-content">
        <div class="documents-section">
          <div class="section-header">
            <h3>Все документы</h3>
                    <div class="actions">
                      <div class="doc-filter">
                        <button :class="['btn-small', { active: documentsFilter === 'unpublished' }]" @click="setDocumentsFilter('unpublished')">Загруженные</button>
                        <button :class="['btn-small', { active: documentsFilter === 'published' }]" @click="setDocumentsFilter('published')">Опубликованные</button>
                      </div>
              <button @click="refreshDocuments" class="btn btn-secondary">
                <img src="@/assets/refresh.png" alt="refresh" width="18" height="18" class="icon-img-invert" />
              </button>
              <button 
                v-if="documentsFilter === 'unpublished'"
                @click="publishAllDocuments" 
                :disabled="!unpublishedClaims.length || publishing"
                class="btn btn-primary"
              >
                <i v-if="publishing" class="fas fa-spinner fa-spin"></i>
                Опубликовать все ({{ unpublishedClaims.length }})
              </button>
            </div>
          </div>
          
          <AppLoader v-if="loadingDocuments" />
          
          <div v-else-if="unpublishedClaims.length === 0" class="empty-state">
            <div class="empty-icon">
              <img src="@/assets/docs.png" alt="docs" width="32" height="32" />
            </div>
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
                <th>Файл</th>
                <th>Код партнера</th>
                <th>Имя партнера</th>
                <th>Дата создания</th>
                <th>Период</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="claim in unpublishedClaims" :key="getClaimId(claim)">
                <td data-label="Выбрать">
                  <input 
                    type="checkbox" 
                    :value="getClaimId(claim)"
                    v-model="selectedClaims"
                  />
                </td>
                <td data-label="Файл">{{ claim.FileName || claim.fileName || claim.originalName || '—' }}</td>
                <td data-label="Код партнера">{{ claim.Partner ?? claim.partnerId ?? claim.Inc ?? claim.inc ?? '—' }}</td>
                <td data-label="Имя партнера">{{ claim.PartnerName ?? claim.PartnerName ?? claim.Name ?? claim.name ?? '—' }}</td>
                <td data-label="Дата создания">{{ formatDate(claim.Created || claim.created || claim.Cdate || claim.uploadedAt || claim.uploaded_at || claim.createdAt) }}</td>
                <td data-label="Период">{{ formatPeriod(claim.DateBeg || claim.dateBeg || claim.dateBegRaw, claim.DateEnd || claim.dateEnd || claim.dateEndRaw) }}</td>
                <td data-label="Статус">
                  <span :class="['status', claim.Status || claim.status || (claim.publishedAt || claim.PublishedAt ? 'published' : 'uploaded')]">
                    {{ getStatusLabel(claim.Status ?? claim.status ?? (claim.publishedAt || claim.PublishedAt ? 'published' : 'uploaded')) }}
                  </span>
                </td>
                <td data-label="Действия">
                  <div class="action-buttons">
                    <template v-if="documentsFilter === 'unpublished'">
                      <button @click="publishDocument(getClaimId(claim))" class="btn btn-sm btn-primary">
                        Опубликовать
                      </button>
                      <button @click="deleteDocument(getClaimId(claim))" class="btn btn-sm btn-outline-blue">
                        Удалить
                      </button>
                    </template>
                    <template v-else>
                      <button @click="viewDocument(getClaimId(claim))" class="btn btn-sm btn-outline-blue">
                        Просмотр
                      </button>
                      <button @click="unpublishDocument(getClaimId(claim))" class="btn btn-sm btn-secondary">
                        Снять публикацию
                      </button>
                      <button @click="deleteDocument(getClaimId(claim))" class="btn btn-sm btn-danger">
                        Удалить
                      </button>
                    </template>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          
          <!-- Bulk actions -->
          <div v-if="selectedClaims.length > 0 && documentsFilter === 'unpublished'" class="bulk-actions">
            <span>Выбрано: {{ selectedClaims.length }}</span>
            <button @click="publishSelectedDocuments" class="btn btn-primary">
              Опубликовать выбранные
            </button>
            <button @click="selectedClaims = []" class="btn btn-outline-blue">
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
            <div class="header-actions">
              <input
                v-model="partnerSearchQuery"
                type="text"
                placeholder="Поиск по имени, email, коду или логину..."
                class="search-input-header"
              />
              <button @click="showCreatePartnerModal = true" class="btn btn-primary">
                <img src="@/assets/add.png" alt="add" width="18" height="18" class="icon-img-invert" />
              </button>
            </div>
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
                <th>Последний вход</th>
                <th>Создан</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="partner in filteredPartners" :key="partner.Inc">
                <td data-label="ID">{{ partner.Inc }}</td>
                <td data-label="Имя">{{ partner.Name }}</td>
                <td data-label="Email">{{ partner.Email }}</td>
                <td data-label="Telegram">{{ partner.Telegram || '—' }}</td>
                <td data-label="Логин">{{ partner.Alias }}</td>
                <td data-label="Последний вход">{{ formatDateTime(partner.LastVisit) || '—' }}</td>
                <td data-label="Создан">{{ formatDate(partner.CreatedAt) }}</td>
                <td data-label="Действия">
                  <div class="action-buttons">
                    <button @click="openUploadForPartner(partner)" class="btn-icon btn-upload" title="Загрузить файлы">
                      <img src="@/assets/upload.png" alt="upload" width="18" height="18" />
                    </button>
                    <button @click="editPartner(partner)" class="btn-icon btn-edit" title="Редактировать">
                      <img src="@/assets/edit.png" alt="edit" width="18" height="18" />
                    </button>
                    <button @click="viewPartnerDocuments(partner)" class="btn-icon btn-docs" title="Документы">
                      <img src="@/assets/docs.png" alt="docs" width="18" height="18" />
                    </button>
                    <button @click="deletePartner(partner)" class="btn-icon btn-delete" title="Удалить">
                      <img src="@/assets/delete.png" alt="delete" width="18" height="18" />
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
          <AppLoader v-if="creatingPartner" />
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
    
    <!-- Upload Files Modal -->
    <div v-if="showUploadModal" class="modal-overlay" @click.self="showUploadModal = false">
      <div class="modal modal-large">
        <div class="modal-header">
          <h3>Загрузка файлов для {{ currentUploadPartnerName }}</h3>
          <button @click="closeUploadModal" class="close-btn">×</button>
        </div>
        
        <div class="modal-body">
          <div v-if="!uploading" class="upload-area" :class="{ dragover: isDragover }" 
            @dragover.prevent="isDragover = true"
            @dragleave.prevent="isDragover = false"
            @drop.prevent="handleDrop">
            <input 
              ref="partnerFileInput"
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
              <p>Перетащите Excel файлы сюда или <button @click="$refs.partnerFileInput.click()" class="link-btn">выберите файлы</button></p>
              <p class="upload-hint">Поддерживаются файлы: .xlsx, .xls (максимум 50 файлов)</p>
            </div>
          </div>
          
          <!-- Selected files -->
          <div v-if="selectedFiles.length > 0 && !uploading" class="selected-files">
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
          </div>
          
          <!-- Upload results -->
          <div v-if="uploadResults.length > 0 && !uploading" class="upload-results">
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
        
        <div class="modal-footer">
          <button type="button" @click="closeUploadModal" class="btn btn-secondary">
            Отмена
          </button>
          <button v-if="!uploading" @click="uploadFilesForPartner" :disabled="selectedFiles.length === 0" class="btn btn-primary">
            <i class="fas fa-upload"></i>
            Загрузить файлы
          </button>
          <div v-else style="display:flex;align-items:center;gap:12px;">
            <AppLoader />
            <span>Загрузка файлов...</span>
          </div>
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
          <AppLoader v-if="editingPartner" />
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
          <AppLoader v-if="loadingPartnerDocuments" />
          <table v-else-if="partnerDocuments.length > 0" class="documents-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Дата</th>
                <th>Файл</th>
                <th>Размер</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="doc in partnerDocuments" :key="doc.inc || doc.claimId || doc.DocumentId || doc.DocumentId">
                <td>{{ doc.inc ?? doc.claimId ?? doc.ClaimId ?? doc.DocumentId ?? '—' }}</td>
                <td>{{ formatDate(getDocDate(doc)) }}</td>
                <td>{{ doc.filename || doc.FileName || doc.fileName || doc.originalName || '—' }}</td>
                <td>{{ formatFileSize(doc.size || doc.FileSize || doc.fileSize) }}</td>
                <td>{{ isPublished(doc) ? 'Опубликован' : 'Не опубликован' }}</td>
                <td>
                  <div class="action-buttons">
                    <button v-if="!isPublished(doc)" @click="publishPartnerDocument(doc)" class="btn btn-sm btn-primary">Опубликовать</button>
                    <button @click="confirmDeletePartnerDocument(doc)" class="btn btn-sm btn-danger">Удалить</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-else-if="!loadingPartnerDocuments">Документы не найдены</p>
        </div>
        
        <div class="modal-footer">
          <button @click="showPartnerDocumentsModal = false" class="btn btn-secondary">
            Закрыть
          </button>
        </div>
      </div>
    </div>
    
    <!-- View Document Modal - Excel-like viewer -->
    <ExcelViewer
      :show="showViewDocumentModal"
      :document="currentDocument"
      :excelData="excelData"
      :loading="loadingCurrentDocument"
      @close="showViewDocumentModal = false"
      @download="downloadDocument(currentDocument.inc || currentDocument.Inc)"
    />

    <!-- Confirmation Modal -->
    <div v-if="showConfirmModal" class="modal-overlay" @click.self="handleConfirmNo">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ confirmTitle }}</h3>
          <button @click="handleConfirmNo" class="close-btn">×</button>
        </div>

        <div class="modal-body">
          <p style="color:#374151; font-size:16px; line-height:1.4">{{ confirmMessage }}</p>
        </div>

        <div class="modal-footer">
          <button @click="handleConfirmNo" class="btn btn-outline-blue" :disabled="confirmLoading">{{ confirmCancelText }}</button>
          <button @click="handleConfirmYes" class="btn btn-primary" :disabled="confirmLoading">
            <i v-if="confirmLoading" class="fas fa-spinner fa-spin"></i>
            {{ confirmOkText }}
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
import ExcelViewer from '@/components/ExcelViewer.vue'
import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notifications'
import api from '@/plugins/axios'

const authStore = useAuthStore()
const notificationStore = useNotificationStore()

// Reactive data
const user = ref(null)
const stats = ref({})
const activeTab = ref('partners')

// Tabs
const tabs = [
  { id: 'partners', label: 'Партнеры' },
  { id: 'documents', label: 'Документы' }
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
// Additional loaders
const loadingStats = ref(false)
const loadingPartnerDocuments = ref(false)
const documentsFilter = ref('unpublished') // 'unpublished' or 'published'

const setDocumentsFilter = (value) => {
  documentsFilter.value = value
  refreshDocuments()
}

// File-Partner mapping
const currentUploadPartnerId = ref(null)
const currentUploadPartnerName = ref('')
const showUploadModal = ref(false)

// Partners
const partners = ref([])
const loadingPartners = ref(false)
const partnerSearchQuery = ref('')
const showCreatePartnerModal = ref(false)
const creatingPartner = ref(false)
const showEditPartnerModal = ref(false)
const editingPartner = ref(false)
const partnerToEdit = ref(null)
const showPartnerDocumentsModal = ref(false)
const partnerDocuments = ref([])
const showViewDocumentModal = ref(false)
const currentDocument = ref(null)
const loadingCurrentDocument = ref(false)
const excelData = ref(null)
const newPartner = ref({
  name: '',
  email: '',
  telegram: '',
  alias: '',
  password: ''
})

// Confirmation modal state
const showConfirmModal = ref(false)
const confirmTitle = ref('')
const confirmMessage = ref('')
const confirmOkText = ref('Да')
const confirmCancelText = ref('Отмена')
const confirmLoading = ref(false)
let confirmCallback = null

const openConfirm = ({ title = 'Подтверждение', message = '', okText = 'Да', cancelText = 'Отмена', onConfirm = null }) => {
  confirmTitle.value = title
  confirmMessage.value = message
  confirmOkText.value = okText
  confirmCancelText.value = cancelText
  confirmCallback = onConfirm
  confirmLoading.value = false
  showConfirmModal.value = true
}

const handleConfirmYes = async () => {
  if (!confirmCallback) {
    showConfirmModal.value = false
    return
  }
  try {
    confirmLoading.value = true
    await confirmCallback()
  } catch (e) {
    console.error('Confirm action error', e)
  } finally {
    confirmLoading.value = false
    showConfirmModal.value = false
  }
}

const handleConfirmNo = () => {
  showConfirmModal.value = false
  confirmCallback = null
}

// Methods
const loadData = async () => {
  loadingStats.value = true
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
  } finally {
    loadingStats.value = false
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

// clearFiles removed — upload modal uses closeUploadModal to reset state

const filteredPartners = computed(() => {
  if (!partnerSearchQuery.value) return partners.value
  
  const query = partnerSearchQuery.value.toLowerCase()
  return partners.value.filter(p => {
    const name = (p.Name || p.name || '').toLowerCase()
    const email = (p.Email || p.email || '').toLowerCase()
    const inc = String(p.Inc || p.partnerId || '')
    const alias = (p.Alias || p.alias || '').toLowerCase()
    
    return name.includes(query) || 
           email.includes(query) || 
           inc.includes(query) ||
           alias.includes(query)
  })
})

const openUploadForPartner = (partner) => {
  currentUploadPartnerId.value = partner.Inc
  currentUploadPartnerName.value = partner.Name
  selectedFiles.value = []
  uploadResults.value = []
  showUploadModal.value = true
}

const closeUploadModal = () => {
  showUploadModal.value = false
  selectedFiles.value = []
  uploadResults.value = []
  currentUploadPartnerId.value = null
  currentUploadPartnerName.value = ''
}

const uploadFilesForPartner = async () => {
  if (selectedFiles.value.length === 0 || !currentUploadPartnerId.value) return
  
  uploading.value = true
  const formData = new FormData()
  
  // Собираем массив partner IDs - все файлы для одного партнера
  const partnerIds = []
  
  // Add files and collect partner IDs
  selectedFiles.value.forEach((file) => {
    formData.append('files', file)
    partnerIds.push(currentUploadPartnerId.value)
  })
  
  // Отправляем массив партнеров как JSON
  formData.append('partnerIds', JSON.stringify(partnerIds))
  
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
    
    // Redirect to partner documents to publish
    const uploadedPartner = {
      Inc: currentUploadPartnerId.value,
      Name: currentUploadPartnerName.value
    }
    closeUploadModal()
    await viewPartnerDocuments(uploadedPartner)
    
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
    const endpoint = documentsFilter.value === 'unpublished' ? '/admin/unpublished-claims' : '/admin/published-claims'
    const response = await api.get(endpoint)
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
  const allClaimIds = unpublishedClaims.value.map(claim => getClaimId(claim))
  selectedClaims.value = allClaimIds
  await publishSelectedDocuments()
}

const unpublishDocument = async (claimId) => {
  if (!claimId) {
    notificationStore.addNotification({ type: 'error', message: 'Не удалось определить ID документа' })
    return
  }

  openConfirm({
    title: 'Снятие публикации',
    message: 'Вы уверены, что хотите снять публикацию этого документа? Партнёр больше не сможет его видеть.',
    okText: 'Снять публикацию',
    cancelText: 'Отмена',
    onConfirm: async () => {
      try {
        await api.post('/admin/unpublish-claims', {
          claimIds: [claimId]
        })

        notificationStore.addNotification({
          type: 'success',
          message: 'Публикация документа снята'
        })

        refreshDocuments()
        loadData()

      } catch (error) {
        console.error('Ошибка снятия публикации:', error)
        notificationStore.addNotification({
          type: 'error',
          message: 'Ошибка снятия публикации: ' + (error.response?.data?.message || error.message)
        })
        throw error
      }
    }
  })
}

const deleteDocument = async (claimId) => {
  if (!claimId) {
    notificationStore.addNotification({ type: 'error', message: 'Не удалось определить ID документа' })
    return
  }

  openConfirm({
    title: 'Удаление документа',
    message: 'Вы уверены, что хотите удалить этот документ?',
    okText: 'Удалить',
    cancelText: 'Отмена',
    onConfirm: async () => {
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
          message: 'Ошибка удаления документа: ' + (error.response?.data?.message || error.message)
        })
        throw error
      }
    }
  })
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
  openConfirm({
    title: 'Удаление партнера',
    message: `Вы уверены, что хотите удалить партнера "${partner.Name}"? Это действие нельзя отменить.`,
    okText: 'Удалить',
    cancelText: 'Отмена',
    onConfirm: async () => {
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
        throw error
      }
    }
  })
}

const viewPartnerDocuments = async (partner) => {
  partnerToEdit.value = partner
  loadingPartnerDocuments.value = true
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
  } finally {
    loadingPartnerDocuments.value = false
  }
}

const getDocDate = (doc) => {
  // try multiple possible fields, prioritize created from Partner sheet
  return doc.created ?? doc.Created ?? doc.uploadedAt ?? doc.uploaded_at ?? doc.uploadedAtRaw ?? doc.publishedAt ?? doc.PublishedAt ?? doc.dateBeg ?? doc.DateBeg ?? doc.CreatedAt ?? null
}

const isPublished = (doc) => {
  if (!doc) return false
  if (doc.publishedAt || doc.PublishedAt) return true
  if (typeof doc.Published !== 'undefined') return Boolean(doc.Published)
  if (typeof doc.published !== 'undefined') return Boolean(doc.published)
  if (doc.Status) {
    try {
      return String(doc.Status).toLowerCase().includes('pub')
    } catch (e) {
      // ignore
    }
  }
  return false
}

const publishPartnerDocument = async (doc) => {
  const id = getClaimId(doc) || doc.claimId || doc.ClaimId || doc.DocumentId || doc.inc
  if (!id) return
  try {
    await api.post('/admin/publish-claims', { claimIds: [id] })
    notificationStore.addNotification({ type: 'success', message: 'Документ опубликован' })
    // reload list
    await viewPartnerDocuments(partnerToEdit.value)
    loadData()
  } catch (error) {
    console.error('Ошибка публикации документа партнера:', error)
    notificationStore.addNotification({ type: 'error', message: 'Ошибка публикации документа' })
  }
}

const confirmDeletePartnerDocument = (doc) => {
  const published = isPublished(doc)
  openConfirm({
    title: published ? 'Удалить опубликованный документ' : 'Удалить документ',
    message: published
      ? 'Документ опубликован. Удаление приведет к удалению опубликованной версии. Вы уверены?'
      : 'Вы уверены, что хотите удалить документ?',
    okText: 'Удалить',
    cancelText: 'Отмена',
    onConfirm: async () => {
      await deletePartnerDocument(doc)
    }
  })
}

const deletePartnerDocument = async (doc) => {
  const id = getClaimId(doc) || doc.claimId || doc.ClaimId || doc.DocumentId || doc.inc
  if (!id) return
  try {
    // If document is published, pass force=true to allow deletion
    const force = isPublished(doc)
    const url = `/admin/claims/${id}` + (force ? '?force=true' : '')
    await api.delete(url)
    notificationStore.addNotification({ type: 'success', message: 'Документ удалён' })
    await viewPartnerDocuments(partnerToEdit.value)
    loadData()
  } catch (error) {
    console.error('Ошибка удаления документа партнера:', error)
    notificationStore.addNotification({ type: 'error', message: 'Ошибка удаления документа' })
  }
}

const toggleSelectAll = () => {
  if (selectedClaims.value.length === unpublishedClaims.value.length) {
    selectedClaims.value = []
  } else {
    selectedClaims.value = unpublishedClaims.value.map(claim => getClaimId(claim))
  }
}

const viewDocument = async (claimId) => {
  try {
    loadingCurrentDocument.value = true
    showViewDocumentModal.value = true
    
    const response = await api.get(`/admin/claims/${claimId}`)
    currentDocument.value = response.data.data
    excelData.value = response.data.excelData
  } catch (error) {
    console.error('Ошибка загрузки документа:', error)
    notificationStore.addNotification({
      type: 'error',
      message: 'Ошибка загрузки документа'
    })
    showViewDocumentModal.value = false
  } finally {
    loadingCurrentDocument.value = false
  }
}

const downloadDocument = async (claimId) => {
  try {
    const response = await api.get(`/admin/claims/${claimId}/download`, {
      responseType: 'blob'
    })
    
    // Получаем имя файла из заголовка или используем имя из currentDocument
    const contentDisposition = response.headers['content-disposition'] || response.headers['Content-Disposition']
    let filename = getDisplayFileName(currentDocument.value) || 'document.xlsx'
    if (contentDisposition) {
      // Try RFC 5987 filename* first
      const filenameStarMatch = contentDisposition.match(/filename\*=(?:[\w'']*)?([^;\n]+)/i)
      if (filenameStarMatch && filenameStarMatch[1]) {
        try {
          // filename*=UTF-8''%D0%9F%D1%80%D0%B8%D0%BC%D0%B5%D1%80.xlsx
          const v = filenameStarMatch[1].trim().replace(/^UTF-8''/i, '')
          filename = decodeURIComponent(v.replace(/"/g, ''))
        } catch (e) {
          // ignore
        }
      } else {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=(['"]?)([^'"\n]*?)\1/)
        if (filenameMatch && filenameMatch[2]) {
          filename = filenameMatch[2]
        }
      }
    }
    // If filename still not usable, build fallback (ensures extension)
    if (!filename || filename === '—') {
      filename = buildFallbackFilename(currentDocument.value)
    }
    
    // Создаем ссылку для скачивания
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
    
    notificationStore.addNotification({
      type: 'success',
      message: 'Файл успешно скачан'
    })
  } catch (error) {
    console.error('Ошибка скачивания:', error)
    notificationStore.addNotification({
      type: 'error',
      message: 'Ошибка скачивания файла'
    })
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
  if (bytes == null || isNaN(Number(bytes))) return '—'
  const b = Number(bytes)
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(b) / Math.log(k))
  const idx = Math.min(Math.max(i, 0), sizes.length - 1)
  return parseFloat((b / Math.pow(k, idx)).toFixed(2)) + ' ' + sizes[idx]
}

const toTimestampMs = (value) => {
  if (value == null || value === '') return null
  // If numeric (seconds or milliseconds)
  if (typeof value === 'number') {
    // If looks like seconds (<= 10^11), convert to ms
    return value < 1e12 ? value * 1000 : value
  }
  // If string of digits
  if (/^\d+$/.test(String(value))) {
    const n = parseInt(value, 10)
    return n < 1e12 ? n * 1000 : n
  }
  // If string looks like 'YYYY-MM-DD HH:mm:ss' or 'YYYY/MM/DD HH:mm:ss', treat as UTC
  if (typeof value === 'string' && /^\d{4}[-/]\d{2}[-/]\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(value)) {
    // normalize to ISO and append Z to force UTC
    const iso = value.replace(' ', 'T').replace(/\//g, '-') + 'Z'
    const parsedIso = Date.parse(iso)
    return isNaN(parsedIso) ? null : parsedIso
  }
  // Otherwise let Date parse the string (ISO, etc.)
  const parsed = Date.parse(value)
  return isNaN(parsed) ? null : parsed
}

const formatDate = (date) => {
  const ts = toTimestampMs(date)
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' })
}

const formatDateTime = (date) => {
  const ts = toTimestampMs(date)
  if (!ts) return ''
  return new Date(ts).toLocaleString('ru-RU', { 
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatPeriod = (dateFrom, dateTo) => {
  if (!dateFrom || !dateTo) return '—'
  const from = new Date(dateFrom).toLocaleDateString('ru-RU')
  const to = new Date(dateTo).toLocaleDateString('ru-RU')
  return `${from} — ${to}`
}

// Format currency helper (kept for reuse if needed elsewhere)
const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
}

// Helper to get claim id regardless of backend field naming
const getClaimId = (claim) => {
  if (!claim) return null
  return claim.Inc ?? claim.inc ?? claim.id ?? claim.ClaimId ?? null
}

// Friendly filename getter with fallbacks
const getDisplayFileName = (doc) => {
  if (!doc) return '—'
  const name = doc.fileName || doc.FileName || doc.originalName || doc.originalname || doc.filename || doc.FileNameDownload
  if (name && String(name).trim() !== '') return name
  return buildFallbackFilename(doc)
}

// Build a readable, filesystem-safe fallback filename when original name is missing
const buildFallbackFilename = (doc) => {
  if (!doc) return 'document.xlsx'
  const parts = []
  const type = doc.type || doc.Type || ''
  const partner = doc.PartnerName || doc.partnerName || doc.Name || doc.name || ''
  const inc = doc.inc ?? doc.Inc ?? doc.id ?? ''

  if (type) parts.push(String(type))
  if (partner) parts.push(String(partner))
  if (inc) parts.push(`#${inc}`)

  // Period: try dateBeg/dateEnd
  const from = doc.dateBeg ?? doc.DateBeg ?? doc.dateBegRaw ?? null
  const to = doc.dateEnd ?? doc.DateEnd ?? doc.dateEndRaw ?? null
  if (from && to) {
    const f = toTimestampMs(from)
    const t = toTimestampMs(to)
    if (f && t) {
      const d1 = new Date(f)
      const d2 = new Date(t)
      const pf = `${d1.getFullYear()}${String(d1.getMonth()+1).padStart(2,'0')}`
      const pt = `${d2.getFullYear()}${String(d2.getMonth()+1).padStart(2,'0')}`
      parts.push(`${pf}-${pt}`)
    }
  }

  let filename = parts.join(' - ')
  if (!filename) filename = `document${inc ? `-${inc}` : ''}`
  // sanitize: remove slashes and quotes
  filename = filename.replace(/[\\/:*?"<>|]/g, '').trim()
  // append default extension
  if (!/\.[a-z0-9]+$/i.test(filename)) filename += '.xlsx'
  return filename
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
  handleTabChange()
  // ensure helper is treated as used by linters
  void formatCurrency(0)
})

// Watch activeTab
watch(activeTab, handleTabChange)
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

html, body, #app {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-weight: 400;
}
</style>

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
  background: #b91c1c;
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
  background: #991b1b;
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
  color: #16a34a;
  font-weight: 500;
}

.results-summary .error {
  color: #b91c1c;
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
  color: #b91c1c;
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
  color: #16a34a;
  font-weight: 600;
}

.password-status.not-set {
  color: #b91c1c;
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
  background: #16a34a;
  color: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.btn-success:hover {
  background: #15803d;
  box-shadow: 0 2px 6px rgba(22, 163, 74, 0.3);
}

.btn-danger {
  background: #b91c1c;
  color: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.btn-danger:hover {
  background: #991b1b;
  box-shadow: 0 2px 6px rgba(185, 28, 28, 0.3);
}

.btn-info {
  background: #06b6d4;
  color: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.btn-info:hover {
  box-shadow: 0 2px 6px rgba(6, 182, 212, 0.3);
}

/* Outlined blue button (transparent background, blue border/text) */
.btn-outline-blue {
  background: transparent;
  color: #2563eb;
  border: 1px solid #2563eb;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.btn-outline-blue:hover {
  background: rgba(37, 99, 235, 0.06);
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
}

.empty-icon {
  font-size: 5rem;
  margin-bottom: 24px;
  opacity: 0.7;
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

.doc-filter {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.doc-filter .btn-small {
  white-space: nowrap;
  font-size: 13px;
  padding: 8px 14px;
}

.doc-filter .btn-small.active {
  background: #2563eb;
  color: #ffffff;
  border-color: #1e40af;
  box-shadow: 0 2px 6px rgba(37,99,235,0.12);
}

.doc-filter .btn-small:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(37,99,235,0.12);
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

.btn-info {
  background: #06b6d4;
  color: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.btn-info:hover {
  box-shadow: 0 2px 6px rgba(6, 182, 212, 0.3);
}

.btn-danger {
  background: #b91c1c;
  color: white;
  border: 1px solid #b91c1c;
}

.btn-danger:hover {
  background: #991b1b;
  border-color: #7f1d1d;
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
    padding: 12px;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
    gap: 8px;
    margin-bottom: 18px;
  }

  .stat-card {
    padding: 8px;
    gap: 6px;
  }

  .stat-icon {
    font-size: 1.2rem;
  }

  .stat-value {
    font-size: 1.1rem;
    line-height: 1.1;
  }

  .stat-label {
    font-size: 0.65rem;
    opacity: 0.9;
  }
  
  .stat-card::before {
    height: 2px;
    left: 12px;
    right: 12px;
  }
  
  /* Keep primary tabs on a single row on small screens */
  .tabs {
    flex-direction: row;
    flex-wrap: nowrap;
    gap: 8px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .tab {
    text-align: center;
    padding: 10px 14px;
    flex: none;
    white-space: nowrap;
    font-size: 14px;
  }
  
  .section-header {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  /* Keep header action buttons compact (don't stretch full width) */
  .actions {
    flex-direction: column;
    gap: 8px;
  }

  .actions .btn {
    width: auto;
    display: inline-flex;
    justify-content: center;
  }

  .header-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .header-actions .search-input-header {
    flex: 1 1 auto;
    min-width: 0;
  }

  .header-actions .btn {
    width: auto;
    padding: 8px 10px;
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
    width: calc(100vw - 24px);
    max-width: 100%;
    margin: 12px;
  }
  
  .modal-large {
    width: calc(100vw - 24px);
    max-width: 100%;
  }
  
  .modal-header {
    padding: 16px;
    flex-wrap: wrap;
  }
  
  .modal-header h3 {
    font-size: 16px;
  }
  
  .modal-body {
    padding: 16px;
    max-height: 60vh;
    overflow-y: auto;
  }
  
  .modal-footer {
    padding: 16px;
    flex-wrap: wrap;
    gap: 8px;
  }
  
  .modal-footer .btn {
    flex: 1;
    min-width: 120px;
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
  background: transparent;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: background 0.15s ease;
  margin-right: 4px;
}

.btn-icon:last-child {
  margin-right: 0;
}

/* Make action buttons transparent; icons outlined black */
.btn-edit,
.btn-docs,
.btn-delete,
.btn-upload {
  background: transparent;
  color: inherit;
  border: 1px solid #e5e7eb;
  padding: 6px;
  border-radius: 6px;
}

.btn-edit:hover,
.btn-docs:hover,
.btn-delete:hover,
.btn-upload:hover {
  background: rgba(0,0,0,0.04);
}

.btn-icon img {
  display: inline-block;
  vertical-align: middle;
}

  /* Responsive partner table -> card layout (only for small screens) */
  @media (max-width: 768px) {
    /* Tables to cards */
    .partners-table thead,
    .documents-table thead {
      display: none;
    }

    .partners-table,
    .documents-table {
      display: block;
    }

    .partners-table tbody,
    .documents-table tbody {
      display: block;
    }

    .partners-table tbody tr,
    .documents-table tbody tr {
      display: block;
      background: white;
      margin-bottom: 12px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
    }

    .partners-table td,
    .documents-table td {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border: none;
      text-align: right;
    }

    .partners-table td::before,
    .documents-table td::before {
      content: attr(data-label);
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 11px;
      margin-right: 12px;
      text-align: left;
      flex: 1;
    }
    
    .documents-table td:first-child::before {
      content: '';
    }

    .partners-table td:last-child,
    .documents-table td:last-child {
      display: flex;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 6px;
    }
    
    .documents-table td:last-child::before {
      display: none;
    }

    .action-buttons {
      display: flex;
      flex-direction: row;
      gap: 6px;
      width: 100%;
      justify-content: flex-end;
    }
    
    .action-buttons .btn {
      flex: 1;
      min-width: 0;
      font-size: 12px;
      padding: 8px 10px;
    }

    .search-input-header {
      min-width: 0;
      width: 100%;
      font-size: 14px;
      padding: 10px 12px;
    }

    .btn-icon {
      width: 38px;
      height: 38px;
      padding: 8px;
    }
    
    .btn-icon img {
      width: 16px !important;
      height: 16px !important;
    }
    
    /* Document details responsive */
    .detail-grid {
      grid-template-columns: 1fr;
      gap: 12px;
    }
    
    .detail-section {
      padding: 14px;
    }
    
    .detail-header h4 {
      font-size: 14px;
    }
    
    /* Forms responsive */
    .form-group input,
    .form-group select {
      font-size: 14px;
      padding: 10px 12px;
    }
    
    /* Upload area */
    .upload-area {
      padding: 30px 20px;
    }
    
    .upload-content p {
      font-size: 14px;
    }
    
    /* File list */
    .file-item {
      padding: 10px 12px;
    }
    
    .file-name {
      font-size: 13px;
    }
    
    .file-size {
      font-size: 11px;
    }
    
    /* Bulk actions */
    .bulk-actions {
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
    }
    
    .bulk-actions .btn {
      width: 100%;
    }
    
    /* Doc filter buttons */
    .doc-filter {
      width: 100%;
      justify-content: stretch;
    }
    
    .doc-filter .btn-small {
      flex: 1;
      text-align: center;
    }
    
    /* Header actions */
    .header-actions {
      width: 100%;
      flex-direction: column;
    }
    
    .header-actions .btn {
      width: 100%;
    }
    
    /* Section header */
    .section-header {
      padding: 14px 16px;
    }
    
    .section-header h3 {
      font-size: 16px;
    }
    
    .actions {
      width: 100%;
      flex-direction: column;
    }
    
    .actions .btn {
      width: 100%;
      justify-content: center;
    }
  }

.btn-delete {
  color: white;
}

.btn-upload {
  color: white;
}

/* Search input in header */
.search-input-header {
  padding: 0.5rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 0.95rem;
  min-width: 300px;
  transition: all 0.2s;
}

.search-input-header:focus {
  outline: none;
  border-color: #06b6d4;
  box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.1);
}

.header-actions {
  display: flex;
  gap: 1rem;
  align-items: center;
}

/* Partner Selection Modal Styles */
.modal-large {
  max-width: 800px;
}

.partner-search {
  position: relative;
  margin-bottom: 1.5rem;
}

.partner-search input {
  padding: 0.75rem 1rem 0.75rem 2.5rem;
  font-size: 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  width: 100%;
  transition: all 0.2s;
}

.partner-search input:focus {
  outline: none;
  border-color: #06b6d4;
  box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.1);
}

.partner-search i {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: #9ca3af;
}

.file-partner-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-height: 400px;
  overflow-y: auto;
}

.file-partner-item {
  background: #f9fafb;
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.file-name {
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.file-name i {
  color: #06b6d4;
}

.partner-selector {
  position: relative;
}

.partner-select-btn {
  width: 100%;
  padding: 0.75rem 1rem;
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.partner-select-btn:hover {
  border-color: #06b6d4;
}

.partner-select-btn.selected {
  border-color: #06b6d4;
  background: #f0fdfa;
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 0.25rem;
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  max-height: 250px;
  overflow-y: auto;
  z-index: 1000;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}

/* Full-width partner list */
.partner-list-full {
  width: 100%;
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  max-height: 400px;
  overflow-y: auto;
  padding: 0.5rem;
}

.partner-list-item {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #f3f4f6;
  cursor: pointer;
}

.partner-list-item:hover {
  background: #f0fdfa;
}

.file-chip {
  padding: 0.5rem 0.75rem;
  border-radius: 20px;
  border: 1px solid #e5e7eb;
  background: white;
  margin-right: 0.5rem;
  cursor: pointer;
}

.file-chip.active {
  background: #eefaf9;
  border-color: #06b6d4;
}

.chips-row {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.chip-badge {
  margin-left: 0.5rem;
  font-size: 0.85rem;
  color: #16a34a;
}

.dropdown-item {
  padding: 0.75rem 1rem;
  cursor: pointer;
  transition: background 0.2s;
  border-bottom: 1px solid #f3f4f6;
}

.dropdown-item:last-child {
  border-bottom: none;
}

.dropdown-item:hover {
  background: #f0fdfa;
}

.partner-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.partner-name {
  font-weight: 500;
  color: #374151;
}

.partner-email {
  font-size: 0.875rem;
  color: #6b7280;
}

.selected-partner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #16a34a;
  font-weight: 500;
}

.empty-message {
  text-align: center;
  padding: 2rem;
  color: #6b7280;
}

/* Ensure specific icons can be inverted to white */
.icon-img-invert {
  filter: brightness(0) invert(1) !important;
}

/* Document Details View Modal */
.document-details {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.detail-section {
  background: #f9fafb;
  border-radius: 8px;
  padding: 20px;
  border: 1px solid #e5e7eb;
}

.detail-header {
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 2px solid #e5e7eb;
}

.detail-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail-label {
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-value {
  font-size: 14px;
  font-weight: 500;
  color: #1e293b;
  word-break: break-word;
}

.detail-value.amount {
  font-size: 16px;
  font-weight: 600;
  color: #2563eb;
}

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-badge.published {
  background: #d1fae5;
  color: #065f46;
}

.status-badge.unpublished {
  background: #fef3c7;
  color: #78350f;
}

</style>