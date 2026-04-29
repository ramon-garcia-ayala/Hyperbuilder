<template>
  <div class="export-wrapper">
    <button class="export-btn" @click="showOptions = !showOptions" title="Download Screenshot">
      <span class="text">IMG</span>
    </button>
    <div v-if="showOptions" class="quality-options">
      <div class="checkbox-row">
        <input type="checkbox" id="inc-diag" v-model="includeOverlays">
        <label for="inc-diag">Include Diagrams</label>
      </div>
      <div class="option" @click="downloadImage('image/png')">PNG <small>(High Quality)</small></div>
      <div class="option" @click="downloadImage('image/jpeg', 0.9)">JPG <small>(Good Quality)</small></div>
      <div class="option" @click="downloadImage('image/jpeg', 0.5)">JPG <small>(Small File)</small></div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import html2canvas from 'html2canvas'

const showOptions = ref(false)
const includeOverlays = ref(true) // FIX: Activado por defecto para incluir medidas

defineExpose({ downloadImage })

async function downloadImage(format, quality) {
  // Ocultamos el menú inmediatamente para que no salga en la foto
  showOptions.value = false
  // Esperamos un momento a que se renderice el cierre del menú
  await new Promise(r => setTimeout(r, 100))

  let imgData = null

  if (!includeOverlays.value) {
    // OPCIÓN A: Solo Viewport 3D (Rápido y limpio)
    const canvas = document.querySelector('#threejs-container canvas')
    if (!canvas) { alert("3D Canvas not found."); return }
    imgData = canvas.toDataURL(format, quality)
  } else {
    // OPCIÓN B: Viewport + Diagramas (html2canvas)
    const viewerElement = document.getElementById('viewer')
    const rect = viewerElement.getBoundingClientRect()

    const canvas = await html2canvas(document.body, {
      // Recortamos la captura exactamente al tamaño y posición del Visor
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY,
      width: rect.width,
      height: rect.height,
      useCORS: true, // Importante para texturas externas
      onclone: (clonedDoc) => {
        // Forzar fondo blanco sólido para las tarjetas en la captura
        const cards = clonedDoc.querySelectorAll('.chart-card, .info-card')
        cards.forEach(card => {
          card.style.background = '#ffffff'
          card.style.backdropFilter = 'none'
        })
      },
      ignoreElements: (element) => {
        // FILTRO: Elementos a excluir de la foto
        if (element.classList.contains('viewcube-card')) return true
        if (element.classList.contains('export-controls-container')) return true
        if (element.classList.contains('history-container')) return true
        if (element.classList.contains('dock-btn')) return true // Botones del diagrama
        if (element.classList.contains('snap-btn')) return true // Botones del diagrama
        if (element.classList.contains('display-card')) return true // Panel de modos de visualización
        if (element.classList.contains('layers-card')) return true // Panel de control de layers
        return false
      }
    })
    imgData = canvas.toDataURL(format, quality)
  }
  const extension = format.split('/')[1]
  
  const link = document.createElement('a')
  link.href = imgData
  link.download = `Screenshot_${new Date().toISOString().split('T')[0]}.${extension}`
  document.body.appendChild(link) // Required for Firefox
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}
</script>

<style scoped>
.export-wrapper { position: relative; flex: 1; }
.export-btn {
  background: white;
  color: black;
  border: 1px solid rgba(0,0,0,0.1);
  border-radius: 8px;
  padding: 8px 0;
  cursor: pointer;
  width: 100%;
  justify-content: center;
  font-family: 'Roboto Mono', monospace;
  font-size: 0.7rem;
  font-weight: bold;
  display: flex;
  align-items: center;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  transition: all 0.2s ease;
}
.export-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 15px rgba(0,0,0,0.12);
  background: #f0f0f0;
}
.text { letter-spacing: 0.5px; }

.quality-options {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 5px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  border: 1px solid #eee;
  overflow: hidden;
  z-index: 10;
  width: 160px;
  padding-top: 5px;
}
.option {
  padding: 10px 15px;
  font-size: 0.75rem;
  cursor: pointer;
}
.option:hover { background: #f2dd1c; }
.option small { display: block; font-size: 0.6rem; opacity: 0.7; }

.checkbox-row {
  padding: 8px 15px;
  border-bottom: 1px solid #eee;
  display: flex;
  align-items: center;
  gap: 8px;
}
.checkbox-row label {
  font-size: 0.7rem;
  font-weight: bold;
  cursor: pointer;
}
.checkbox-row input { cursor: pointer; }
</style>