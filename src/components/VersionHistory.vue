<template>
  <div class="history-container" :class="{ collapsed: !isVisible }">
    
    <!-- Barra de Versiones -->
    <div class="history-bar">
      <div class="history-header">
         VERSION HISTORY
        
        <!-- Save Button -->
        <button class="header-save-btn" @click="captureVersion" title="Save current version">
          <span>+</span> SAVE
        </button>

        <div class="toggle-btn" @click="isVisible = !isVisible" :title="isVisible ? 'Collapse History' : 'Expand History'">
          {{ isVisible ? '▼' : '▲' }}
        </div>
      </div>

      <div class="history-content" v-show="isVisible">
        <div v-if="versions.length === 0" class="empty-state">
          No versions saved yet. Start designing!
        </div>

        <div 
          v-for="(ver, index) in versions" 
          :key="index" 
          class="version-item"
          @click="restore(ver)"
        >
          <div class="thumbnail-wrapper">
            <img :src="ver.image" alt="Snapshot" />
            <!-- Botón de eliminar (aparece en hover) -->
            <button class="delete-btn" @click.stop="deleteVersion(index)" title="Delete this version">×</button>
          </div>
          <div class="version-info">
            <!-- Input para renombrar (doble clic) -->
            <input 
              v-if="ver.isEditing" 
              v-model="ver.name" 
              @blur="ver.isEditing = false" 
              @keyup.enter="ver.isEditing = false"
              @click.stop
              class="name-input"
              v-focus
            />
            <!-- Texto normal -->
            <span v-else class="v-name" @dblclick.stop="ver.isEditing = true" title="Double click to rename">{{ ver.name }}</span>
            <span class="v-time">{{ ver.time }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import html2canvas from 'html2canvas'

const props = defineProps({
  currentData: Object, // Current params to save
  getData: Function,   // Function to get fresh data on save
  canvasSelector: { type: String, default: '#threejs-container canvas' }
})

const emit = defineEmits(['restoreVersion', 'visibilityChanged'])

const isVisible = ref(false)
const versions = ref([])

watch(isVisible, (newValue) => {
  emit('visibilityChanged', newValue)
})

// Custom directive to focus input
const vFocus = {
  mounted: (el) => el.focus()
}

async function captureVersion() {
  // 1. Capture FULL Viewer (Charts + 3D) using html2canvas
  const viewerElement = document.getElementById('viewer')
  if (!viewerElement) return

  const rect = viewerElement.getBoundingClientRect()

  const canvas = await html2canvas(document.body, {
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY,
      width: rect.width,
      height: rect.height,
      useCORS: true,
      ignoreElements: (element) => {
        // Exclude controls for clean screenshot
        if (element.classList.contains('history-container')) return true
        if (element.classList.contains('export-controls-container')) return true
        if (element.classList.contains('viewcube-card')) return true
        if (element.classList.contains('layers-card')) return true
        return false
      }
  })

  // 2. Take photo
  const imgData = canvas.toDataURL('image/jpeg', 0.8) // JPEG is faster

  // 3. Get timestamp
  const now = new Date()
  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  // 4. Get freshest data (inputs + camera)
  let dataToSave = props.currentData
  if (props.getData) {
    dataToSave = props.getData()
  }

  // 5. Save to History array
  versions.value.push({
    image: imgData,
    time: timeString,
    data: JSON.parse(JSON.stringify(dataToSave)), // Deep Copy
    name: `Version ${versions.value.length + 1}`, // Nombre por defecto
    isEditing: false
  })
}

function restore(version) {
  // Emit event to parent to restore values
  emit('restoreVersion', version.data)
}

function deleteVersion(index) {
  versions.value.splice(index, 1)
}
</script>

<style scoped>
.history-container {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  z-index: 100; /* Debe estar sobre el visor pero debajo de los popups */
  display: flex;
  justify-content: center;
  align-items: flex-end;
  padding-bottom: 15px;
  pointer-events: none;
}

.header-save-btn {
  pointer-events: auto;
  background: rgba(0, 0, 0, 0.05);
  color: #333;
  border: 1px solid rgba(0,0,0,0.1);
  padding: 3px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-family: 'Roboto Mono', monospace;
  font-size: 0.6rem;
  font-weight: 600;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 15px;
}

.header-save-btn:hover { 
  background: #000;
  color: white;
}

.header-save-btn span { font-size: 0.8rem; }

.history-bar {
  width: calc(100% - 40px);
  max-width: 1200px;
  background: rgba(248, 249, 250, 0.8);
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(0,0,0,0.1);
  border-radius: 15px 15px 0 0;
  box-shadow: 0 -5px 20px rgba(0,0,0,0.05);
  pointer-events: auto;
  overflow: hidden;
  transition: height 0.3s ease;
}

.history-header {
  padding: 8px 15px;
  font-family: 'Roboto Mono', monospace;
  font-weight: bold;
  font-size: 0.8rem;
  color: #555;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  position: relative;
  border-bottom: 1px solid #e9ecef;
}

.toggle-btn {
  position: absolute;
  right: 10px;
  cursor: pointer;
  font-size: 1rem;
  padding: 2px 8px;
  border-radius: 4px;
}
.toggle-btn:hover { background: rgba(0,0,0,0.05); }

.history-content {
  height: 140px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  gap: 15px;
  overflow-x: auto; /* Scroll horizontal */
  pointer-events: auto;
}

.version-item {
  flex: 0 0 auto;
  cursor: pointer;
  opacity: 0.8;
  transition: opacity 0.2s, transform 0.2s;
}
.version-item:hover { opacity: 1; transform: translateY(-2px); }
.thumbnail-wrapper { position: relative; } /* Para posicionar el botón de borrar */

.thumbnail-wrapper img { width: 140px; height: 90px; object-fit: cover; border-radius: 8px; border: 1px solid #ddd; background: #eee; }

.version-info { display: flex; flex-direction: column; margin-top: 5px; }
.v-name { font-size: 0.7rem; font-weight: bold; color: #333; }
.v-time { font-size: 0.6rem; color: #888; font-family: 'Roboto Mono', monospace; }

.empty-state { width: 100%; text-align: center; color: #999; font-size: 0.8rem; }

/* ESTILOS NUEVOS PARA BORRAR Y RENOMBRAR */
.delete-btn {
  position: absolute;
  top: -5px;
  right: -5px;
  width: 20px;
  height: 20px;
  background: #ff4d4d;
  color: white;
  border: none;
  border-radius: 50%;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  display: none; /* Se oculta por defecto */
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 5px rgba(0,0,0,0.2);
}

.thumbnail-wrapper:hover .delete-btn {
  display: flex; /* Se muestra al pasar el mouse por la imagen */
}

.delete-btn:hover { background: #ff0000; transform: scale(1.1); }

.name-input {
  font-size: 0.7rem;
  font-weight: bold;
  color: #333;
  border: none;
  border-bottom: 1px solid #333;
  background: transparent;
  width: 100%;
  outline: none;
  padding: 0;
}
</style>