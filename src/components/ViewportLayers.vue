<template>
  <div class="layers-card" :style="cardStyle" ref="cardRef">
    <div class="card-header" @mousedown="startDragCard">
      LAYERS
      <span class="toggle-icon" @mousedown.stop @click="toggleCollapse">{{ isCollapsed ? '▼' : '▲' }}</span>
    </div>
    
    <div class="card-body" v-show="!isCollapsed">
      <div class="layer-item">
        <input type="checkbox" id="show-dims" v-model="showDims" @change="toggleDims">
        <label for="show-dims">Dimensions</label>
      </div>
      <div class="layer-item">
        <input type="checkbox" id="show-bbox" v-model="showBBox" @change="toggleBBox">
        <label for="show-bbox">Bounding Box</label>
      </div>
      <div class="layer-item">
        <input type="checkbox" id="show-lines" v-model="showLines" @change="toggleLines">
        <label for="show-lines">Info Lines</label>
      </div>
      <div class="layer-item">
        <input type="checkbox" id="cast-shadow" v-model="castShadow" @change="toggleCastShadow">
        <label for="cast-shadow">Cast Shadow</label>
      </div>
      <hr>
      <div class="layer-item">
        <input type="checkbox" id="show-grid" :checked="showGrid" @change="$emit('update:showGrid', $event.target.checked)">
        <label for="show-grid">Show Grid</label>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  target: Object, // Referencia a GeometryView
  gridSize: { type: Number, default: 20 },
  showGrid: Boolean
})

const emit = defineEmits(['toggle-lines', 'update:showGrid', 'update:gridSize', 'toggle-shadow'])

const showDims = ref(false)
const showBBox = ref(false)
const showLines = ref(true) // Activado por defecto
const castShadow = ref(true)

// Estado para colapsar y mover
const isCollapsed = ref(false)
const cardRef = ref(null)
const cardStyle = ref({ top: '20px', left: '20px' }) // Posición inicial
let isDragging = false
let dragOffset = { x: 0, y: 0 }

function toggleDims() {
  if (props.target && props.target.toggleDimensions) {
    props.target.toggleDimensions(showDims.value)
  }
}

function toggleBBox() {
  if (props.target && props.target.toggleBBox) {
    props.target.toggleBBox(showBBox.value)
  }
}

function toggleLines() {
  emit('toggle-lines', showLines.value)
}

function toggleCastShadow() {
  emit('toggle-shadow', castShadow.value)
}

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value
}

// --- LOGICA DE ARRASTRE (Igual que ViewCube) ---
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
  
  cardStyle.value = { top: `${y}px`, left: `${x}px` }
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

  // Snap a la retícula
  x = Math.round(x / props.gridSize) * props.gridSize
  y = Math.round(y / props.gridSize) * props.gridSize

  cardStyle.value = { top: `${y}px`, left: `${x}px` }
}
</script>

<style scoped>
.layers-card {
  position: absolute;
  z-index: 95;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(5px);
  border: 1px solid rgba(0,0,0,0.1);
  border-radius: 8px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.05);
  font-family: 'Roboto Mono', monospace;
  width: fit-content;
  min-width: 150px;
  overflow: hidden;
}

.card-header {
  background: #f5f5f5;
  font-size: 0.7rem;
  font-weight: bold;
  color: #555;
  padding: 6px 10px;
  text-align: center;
  border-bottom: 1px solid #eee;
  cursor: move;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.card-body {
  padding: 10px 15px;
  display: flex;
  flex-direction: column;
}

.toggle-icon {
  cursor: pointer;
  font-size: 0.8rem;
  padding: 0 4px;
}

.layer-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 5px;
}

.layer-item label {
  font-size: 0.75rem;
  cursor: pointer;
}

.layer-item input {
  cursor: pointer;
  accent-color: #f2dd1c;
}

hr {
  border: none;
  border-top: 1px solid #eee;
  margin: 8px -15px;
}
</style>