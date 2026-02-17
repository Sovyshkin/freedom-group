<template>
  <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal modal-excel">
      <div class="modal-header">
        <div class="excel-header-info">
          <h3>{{ getDisplayFileName(document) }}</h3>
          <span class="excel-file-size">{{ formatFileSize(document?.fileSize || document?.FileSize || document?.size) }}</span>
        </div>
        <button @click="$emit('close')" class="close-btn">×</button>
      </div>
      
      <div class="modal-body excel-viewer-body">
        <AppLoader v-if="loading" />
        
        <div v-else-if="excelData && excelData.sheets && excelData.sheets.length > 0" class="excel-container">
          <!-- Sheet tabs -->
          <div class="excel-tabs">
            <button 
              v-for="(sheet, index) in excelData.sheets" 
              :key="index"
              @click="activeSheet = index"
              :class="['excel-tab', { active: activeSheet === index }]"
            >
              {{ sheet.name }}
            </button>
          </div>
          
          <!-- Excel table -->
          <div class="excel-table-wrapper">
            <div class="excel-table-container">
              <table class="excel-table" v-if="excelData.sheets[activeSheet]">
                <thead>
                  <tr>
                    <th class="excel-row-number"></th>
                    <th 
                      v-for="(cell, colIndex) in excelData.sheets[activeSheet].data[0]" 
                      :key="colIndex"
                      class="excel-header-cell"
                    >
                      {{ getColumnLabel(colIndex) }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, rowIndex) in excelData.sheets[activeSheet].data" :key="rowIndex">
                    <td class="excel-row-number">{{ rowIndex + 1 }}</td>
                    <td 
                      v-for="(cell, colIndex) in row" 
                      :key="colIndex"
                      class="excel-cell"
                      :class="{ 'excel-header-row': rowIndex === 0 }"
                    >
                      {{ cell }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        
        <div v-else class="excel-no-data">
          <p>Не удалось загрузить данные из файла</p>
        </div>
      </div>
      
      <div class="modal-footer">
        <button @click="$emit('close')" class="btn btn-secondary">
          Закрыть
        </button>
        <button @click="$emit('download')" class="btn btn-primary">
          Скачать файл
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
/* global defineProps, defineEmits */
import { ref, watch } from 'vue'
import AppLoader from '@/components/AppLoader.vue'

const props = defineProps({
  show: {
    type: Boolean,
    required: true
  },
  document: {
    type: Object,
    default: null
  },
  excelData: {
    type: Object,
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  }
})

defineEmits(['close', 'download'])

const activeSheet = ref(0)

// Reset to first sheet when new document is loaded
watch(() => props.document, () => {
  activeSheet.value = 0
})

const getDisplayFileName = (doc) => {
  if (!doc) return ''
  return doc.fileName || doc.FileName || doc.originalName || doc.OriginalName || 'document.xlsx'
}

const formatFileSize = (bytes) => {
  if (!bytes) return ''
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  return `${mb.toFixed(1)} MB`
}

const getColumnLabel = (index) => {
  let label = ''
  let num = index
  while (num >= 0) {
    label = String.fromCharCode(65 + (num % 26)) + label
    num = Math.floor(num / 26) - 1
  }
  return label
}
</script>

<style scoped>
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
  border-radius: 12px;
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.modal-excel {
  max-width: 95vw;
  max-height: 95vh;
  width: 1400px;
}

.modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: white;
  border-radius: 12px 12px 0 0;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.excel-header-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.excel-file-size {
  background: rgba(255, 255, 255, 0.2);
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 500;
}

.close-btn {
  background: rgba(255, 255, 255, 0.15);
  border: none;
  font-size: 28px;
  cursor: pointer;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  transition: background 0.2s;
  line-height: 1;
  padding: 0;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.excel-viewer-body {
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  background: #f9fafb;
  border-radius: 0 0 12px 12px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.15s ease;
}

.btn-primary {
  background: #2563eb;
  color: white;
}

.btn-primary:hover {
  background: #1d4ed8;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #545b62;
}

/* Excel viewer styles */
.excel-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: calc(95vh - 200px);
}

.excel-tabs {
  display: flex;
  gap: 2px;
  padding: 12px 20px 0;
  background: #f3f4f6;
  border-bottom: 2px solid #e5e7eb;
  overflow-x: auto;
}

.excel-tab {
  padding: 10px 20px;
  background: #e5e7eb;
  border: none;
  border-radius: 8px 8px 0 0;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
  transition: all 0.2s;
  white-space: nowrap;
}

.excel-tab:hover {
  background: #d1d5db;
}

.excel-tab.active {
  background: white;
  color: #111827;
  font-weight: 600;
  border-bottom: 2px solid white;
  margin-bottom: -2px;
}

.excel-table-wrapper {
  flex: 1;
  overflow: auto;
  background: #f9fafb;
  padding: 20px;
}

.excel-table-container {
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.excel-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.excel-table th,
.excel-table td {
  border: 1px solid #e5e7eb;
  padding: 10px 14px;
  text-align: left;
  min-width: 100px;
}

.excel-row-number {
  background: #f3f4f6;
  color: #6b7280;
  font-weight: 600;
  text-align: center;
  min-width: 50px !important;
  width: 50px;
  font-size: 12px;
  position: sticky;
  left: 0;
  z-index: 2;
}

.excel-header-cell {
  font-weight: 600;
  text-align: center;
  position: sticky;
  top: 0;
  z-index: 1;
  font-size: 12px;
}

.excel-header-row {
  background: #f9fafb;
  font-weight: 600;
  color: #374151;
}

.excel-cell {
  color: #1f2937;
}

.excel-no-data {
  text-align: center;
  padding: 60px 20px;
  color: #9ca3af;
  font-size: 15px;
}

@media (max-width: 768px) {
  .modal {
    max-width: 100%;
    max-height: 100vh;
    border-radius: 0;
  }
  
  .modal-excel {
    max-width: 100%;
    width: 100%;
  }
  
  .excel-table-wrapper {
    padding: 12px;
  }
}
</style>
