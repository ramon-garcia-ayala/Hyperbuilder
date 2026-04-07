<template>
  <div class="context-import-container">
    <p class="table-title" style="margin-top:0">SITE CONTEXT (.3dm)</p>
    <div class="action-row">
      <input type="file" ref="fileInput" @change="onFileChange" accept=".3dm" style="display: none;" />
      
      <button class="import-btn" @click="triggerFileSelect">
        {{ hasContext ? 'Replace Context' : 'Import 3DM File' }}
      </button>
      
      <button v-if="hasContext" class="move-btn" :class="{ 'edit-active': isEditing }" @click="toggleEdit" title="Move Context">
        {{ isEditing ? 'Done' : 'Move' }}
      </button>

      <button v-if="hasContext" class="clear-btn" @click="clearContext" title="Remove Context">×</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const emits = defineEmits(['load-context', 'clear-context', 'toggle-edit-context'])
const fileInput = ref(null)
const hasContext = ref(false)
const isEditing = ref(false)

function triggerFileSelect() {
  if (fileInput.value) {
    fileInput.value.click()
  }
}

function onFileChange(event) {
  const file = event.target.files[0]
  if (!file) return

  // Leemos el archivo en crudo para mandarlo a Three.js
  const reader = new FileReader()
  reader.onload = (e) => {
    emits('load-context', e.target.result)
    hasContext.value = true
    isEditing.value = false
    emits('toggle-edit-context', false)
  }
  reader.readAsArrayBuffer(file)
  
  // Limpiar input por si queremos borrar y subir el mismo archivo después
  event.target.value = null
}

function toggleEdit() {
  isEditing.value = !isEditing.value
  emits('toggle-edit-context', isEditing.value)
}

function clearContext() {
  emits('clear-context')
  hasContext.value = false
  isEditing.value = false
  emits('toggle-edit-context', false)
}
</script>

<style scoped>
.context-import-container {
  display: flex; flex-direction: column;
}
.table-title {
  font-family: "Roboto Mono", monospace; font-size: 0.7rem; font-weight: bold;
  margin: 15px 0 5px 0; letter-spacing: 1px; opacity: 0.6;
}
.action-row {
  display: flex; gap: 5px;
}
.import-btn {
  flex: 1; padding: 6px; border: 1px solid rgba(0,0,0,0.1); background: #f5f5f5;
  border-radius: 4px; font-family: 'Roboto Mono', monospace; font-size: 0.65rem;
  cursor: pointer; transition: all 0.2s;
}
.import-btn:hover { background: #e0e0e0; }

.move-btn {
  background: #f2dd1c; color: black; border: none; border-radius: 4px; padding: 0 10px;
  cursor: pointer; font-weight: bold; font-size: 0.65rem; display: flex; align-items: center; justify-content: center;
  font-family: 'Roboto Mono', monospace; transition: all 0.2s;
}
.move-btn:hover { background: #e0cc1b; }

.edit-active {
  background: #2847fc; color: white; border-color: #2847fc;
}
.edit-active:hover { background: #1f36c4; }

.clear-btn {
  background: #ffcccc; color: #d80000; border: none; border-radius: 4px; padding: 0 10px;
  cursor: pointer; font-weight: bold; font-size: 1rem; display: flex; align-items: center; justify-content: center;
}
.clear-btn:hover { background: #ffaaaa; }
</style>