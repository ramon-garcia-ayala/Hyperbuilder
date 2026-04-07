<template>
  <div class="display-card" :style="cardStyle" ref="cardRef">
    <div class="card-header" @mousedown="startDragCard">
      DISPLAY
      <span class="toggle-icon" @mousedown.stop @click="toggleCollapse">{{ isCollapsed ? '▼' : '▲' }}</span>
    </div>
    
    <div class="card-body" v-show="!isCollapsed">
      <div class="mode-btn" :class="{ active: currentMode === 'wireframe' }" @click="setMode('wireframe')">Lines</div>
      <div class="mode-btn" :class="{ active: currentMode === 'arctic' }" @click="setMode('arctic')">Arctic</div>
      <div class="mode-btn" :class="{ active: currentMode === 'rendered' }" @click="setMode('rendered')">Rendered</div>
      <div class="mode-btn" :class="{ active: currentMode === 'shaded' }" @click="setMode('shaded')">Solid</div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  target: Object, // Referencia al GeometryView
  gridSize: { type: Number, default: 20 }
})

const currentMode = ref('shaded')
const cardRef = ref(null)
const isCollapsed = ref(false)

// Posición inicial (Debajo del ViewCube)
const cardStyle = ref({ top: '280px', right: '20px' })

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value
}

function setMode(mode) {
  currentMode.value = mode
  if (props.target && props.target.setDisplayMode) {
    props.target.setDisplayMode(mode)
  }
}

// --- LOGICA DE ARRASTRE (Igual que ViewCube) ---
let isDragging = false
let dragOffset = { x: 0, y: 0 }

function startDragCard(e) {
  isDragging = true
  const card = cardRef.value
  const rect = card.getBoundingClientRect()
  dragOffset.x = e.clientX - rect.left
  dragOffset.y = e.clientY - rect.top
  window.addEventListener('mousemove', onDrag)
  window.addEventListener('mouseup', stopDrag)
}

function onDrag(e) {
  if (!isDragging) return
  const card = cardRef.value
  const parent = card.offsetParent || document.body
  const parentRect = parent.getBoundingClientRect()
  
  const x = e.clientX - parentRect.left - dragOffset.x
  const y = e.clientY - parentRect.top - dragOffset.y
  
  cardStyle.value = { top: `${y}px`, left: `${x}px`, right: 'auto', bottom: 'auto' }
}

function stopDrag() {
  isDragging = false
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', stopDrag)

  // --- LÓGICA DE REBOTE Y SNAP ---
  const card = cardRef.value
  if (!card) return

  const parent = card.offsetParent || document.body
  const rect = card.getBoundingClientRect()
  const parentRect = parent.getBoundingClientRect()

  let x = rect.left - parentRect.left
  let y = rect.top - parentRect.top

  const maxX = parentRect.width - rect.width
  const maxY = parentRect.height - rect.height

  if (x < 0) x = 10
  if (y < 0) y = 10
  if (x > maxX) x = maxX - 10
  if (y > maxY) y = maxY - 10

  x = Math.round(x / props.gridSize) * props.gridSize;
  y = Math.round(y / props.gridSize) * props.gridSize;

  cardStyle.value = { top: `${y}px`, left: `${x}px`, right: 'auto', bottom: 'auto' };
}
</script>

<style scoped>
.display-card {
  position: absolute;
  z-index: 90;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(5px);
  border-radius: 15px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.1);
  border: 1px solid rgba(0,0,0,0.1);
  width: fit-content;
  min-width: 90px;
  overflow: hidden;
}

.card-header {
  background: #f5f5f5;
  font-size: 0.7rem;
  font-weight: bold;
  padding: 6px;
  text-align: center;
  border-bottom: 1px solid #eee;
  color: #555;
  cursor: move;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
}

.toggle-icon {
  cursor: pointer;
  font-size: 0.8rem;
  padding: 0 4px;
}

.card-body {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.mode-btn {
  background: white;
  border: 1px solid #eee;
  border-radius: 6px;
  padding: 6px;
  font-family: 'Roboto Mono', monospace;
  font-size: 0.65rem;
  font-weight: 600;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.mode-btn:hover { background: #fafafa; border-color: #ddd; }
.mode-btn.active {
  background: #f2dd1c; /* Color IAAC */
  color: black;
  border-color: #f2dd1c;
}
</style>