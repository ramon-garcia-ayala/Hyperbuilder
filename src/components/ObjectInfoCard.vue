<template>
  <!-- Teleport SVG to body to ensure it overlays everything (connector line) -->
  <teleport to="body">
    <svg v-if="lineStartPos && props.showLines" class="connector-svg">
      <line 
        :x1="lineStartPos.x" 
        :y1="lineStartPos.y" 
        :x2="lineEndPos.x" 
        :y2="lineEndPos.y" 
        stroke="rgba(0,0,0,0.4)" 
        stroke-width="1.5"
        stroke-dasharray="4 2"
      />
      <!-- Draggable handle at the end of the line (3D point anchor) -->
      <circle 
        :cx="lineEndPos.x" 
        :cy="lineEndPos.y" 
        r="6" 
        fill="rgba(0,0,0,0.5)" 
        class="handle"
        @mousedown.stop.prevent="startDragHandle" />
    </svg>
  </teleport>

  <div class="info-card" :style="styleObject" :class="{ 'is-dragging': isDragging }" ref="cardRef">
    <div class="card-header" @mousedown="startDrag">
      <span>{{ data.Name || 'Geometry Object' }}</span>
      <button class="close-btn" @click="$emit('close')">×</button>
    </div>
    <div class="card-body">
      <div v-for="(value, key) in displayedData" :key="key" class="info-row">
        <span class="label">{{ key }}:</span>
        <span class="value">{{ value }}</span>
      </div>
    </div>
    <div class="resize-handle" @mousedown.stop.prevent="startResize"></div>
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'

const props = defineProps({
  data: Object,
  initialPosition: Object,
  size: Object,
  hitPoint: Object, // THREE.Vector3
  viewRef: Object,   // Ref to GeometryView
  showLines: { type: Boolean, default: true },
  gridSize: { type: Number, default: 20 },
  zIndex: { type: Number, default: 2000 }
})

const emit = defineEmits(['close', 'update-size', 'update-hit-point', 'update-position', 'bring-to-front'])

const currentPos = ref({ x: 0, y: 0 })
const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })
const cardRef = ref(null)


// Update initial position when selection changes
const lineStartPos = ref(null)
const lineEndPos = ref({ x: 0, y: 0 })
let animationFrameId = null

watch(() => props.initialPosition, (newPos) => {
  if (newPos) {
    currentPos.value = { x: newPos.x, y: newPos.y }
  }
}, { immediate: true })

const styleObject = computed(() => {
  return {
    top: `${currentPos.value.y}px`,
    left: `${currentPos.value.x}px`,
    width: props.size ? `${props.size.width}px` : 'fit-content',
    height: props.size ? `${props.size.height}px` : 'auto',
    zIndex: props.zIndex
  }
})

const displayedData = computed(() => {
  const data = { ...props.data }
  // Ocultamos el UUID interno de ThreeJS de la interfaz gráfica
  delete data.UUID
  return data
})

// --- DRAG LOGIC ---
function startDrag(event) {
  // Bring card to front when interacting
  emit('bring-to-front', { id: props.data.ID })

  isDragging.value = true
  // Calculate mouse offset
  const rect = cardRef.value.getBoundingClientRect()
  dragOffset.value = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  }
  
  window.addEventListener('mousemove', onDrag)
  window.addEventListener('mouseup', stopDrag)
}

function onDrag(event) {
  if (!isDragging.value) return
  currentPos.value = {
    x: event.clientX - dragOffset.value.x,
    y: event.clientY - dragOffset.value.y
  }
}

function stopDrag() {
  isDragging.value = false
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', stopDrag)
  
  // --- BOUNDARY CHECK (Keep inside screen) ---
  if (cardRef.value) {
    const rect = cardRef.value.getBoundingClientRect()
    const winW = window.innerWidth
    const winH = window.innerHeight
    
    let newX = currentPos.value.x
    let newY = currentPos.value.y

    // Safety margin 20px
    if (newX < 0) newX = 20
    if (newY < 0) newY = 20
    if (newX + rect.width > winW) newX = winW - rect.width - 20
    if (newY + rect.height > winH) newY = winH - rect.height - 20

    // --- SNAP TO GRID ---
    newX = Math.round(newX / props.gridSize) * props.gridSize
    newY = Math.round(newY / props.gridSize) * props.gridSize

    currentPos.value = { x: newX, y: newY }
  }

  // Notify parent to save position in state/history
  emit('update-position', { id: props.data.ID, position: { ...currentPos.value } })
}

// --- RESIZE LOGIC (Synced across cards) ---
function startResize(e) {
  window.addEventListener('mousemove', onResize)
  window.addEventListener('mouseup', stopResize)
}

function onResize(e) {
  const rect = cardRef.value.getBoundingClientRect()
  let w = Math.max(200, e.clientX - rect.left)
  let h = Math.max(150, e.clientY - rect.top)

  // Snap to grid in real-time
  w = Math.round(w / props.gridSize) * props.gridSize
  h = Math.round(h / props.gridSize) * props.gridSize

  emit('update-size', { width: w, height: h })
}

function stopResize() {
  window.removeEventListener('mousemove', onResize)
  window.removeEventListener('mouseup', stopResize)
}

// --- ANCHOR POINT DRAG LOGIC ---
let isDraggingHandle = false

function startDragHandle(e) {
  isDraggingHandle = true
  window.addEventListener('mousemove', onDragHandle)
  window.addEventListener('mouseup', stopDragHandle)
}

function onDragHandle(e) {
  if (!isDraggingHandle) return

  const camera = props.viewRef.getCamera()
  const modelContainer = props.viewRef.getSceneObject()?.parent
  if (!camera || !modelContainer) return

  // Find specific 3D object attached to this card
  const targetObject = modelContainer.getObjectByProperty('uuid', props.data.UUID)
  if (!targetObject) return

  // Raycast from camera through mouse against target object
  const rect = props.viewRef.$el.getBoundingClientRect()
  const mouse = new THREE.Vector2()
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 - 1

  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(mouse, camera)

  const intersects = raycaster.intersectObject(targetObject, true)

  if (intersects.length > 0) {
    // Emit new 3D point if hit
    emit('update-hit-point', { id: props.data.ID, point: intersects[0].point })
  }
}

function stopDragHandle() {
  isDraggingHandle = false
  window.removeEventListener('mousemove', onDragHandle)
  window.removeEventListener('mouseup', stopDragHandle)
}

onMounted(() => {
  updateLine()
})

onUnmounted(() => {
  stopDrag()
  stopDragHandle()
  cancelAnimationFrame(animationFrameId)
})

// --- CONNECTOR LINE UPDATE LOOP ---
function updateLine() {
  if (!props.viewRef || !props.hitPoint || !cardRef.value) {
    lineStartPos.value = null // Hide line if missing data
    animationFrameId = requestAnimationFrame(updateLine)
    return
  }

  const camera = props.viewRef.getCamera()
  if (!camera) {
    animationFrameId = requestAnimationFrame(updateLine)
    return
  }

  // 1. Calculate End Point (Project 3D point to 2D screen)
  const vector = new THREE.Vector3().copy(props.hitPoint)
  vector.project(camera)
  
  const rect = props.viewRef.$el.getBoundingClientRect() // Usamos el viewport de threejs como referencia
  lineEndPos.value.x = (vector.x * 0.5 + 0.5) * rect.width + rect.left
  lineEndPos.value.y = (-(vector.y) * 0.5 + 0.5) * rect.height + rect.top

  // 2. Calculate Start Point (on the card border)
  const cardRect = cardRef.value.getBoundingClientRect()
  // Connect to closest side
  if (lineEndPos.value.x < cardRect.left) {
    lineStartPos.value = { x: cardRect.left, y: cardRect.top + cardRect.height / 2 }
  } else {
    lineStartPos.value = { x: cardRect.right, y: cardRect.top + cardRect.height / 2 }
  }
  
  animationFrameId = requestAnimationFrame(updateLine)
}
</script>

<style scoped>
.info-card {
  position: fixed;
  z-index: 2000;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(0,0,0,0.1);
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.15);
  /* width controlado por prop */
  font-family: 'Roboto Mono', monospace;
  overflow: hidden;
  animation: fadeUp 0.2s ease-out;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  transition: width 0.15s ease-out, height 0.15s ease-out, left 0.15s ease-out, top 0.15s ease-out;
}

.info-card.is-dragging {
  transition: width 0.15s ease-out, height 0.15s ease-out;
}

.card-header {
  background: #f5f5f5;
  padding: 8px 12px;
  font-size: 0.75rem;
  font-weight: bold;
  color: #333;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #eee;
  cursor: move; /* Indicar que es arrastrable */
}

.close-btn {
  border: none;
  background: none;
  font-size: 1.2rem;
  line-height: 0.5;
  cursor: pointer;
  color: #999;
}
.close-btn:hover { color: #ff4d4d; }

.card-body {
  padding: 10px 12px;
  overflow-y: auto;
  flex-grow: 1; /* Ocupa el espacio disponible al redimensionar */
}

.info-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 0.7rem;
  white-space: nowrap; /* Evita que el texto se rompa, forzando a la tarjeta a crecer */
  gap: 15px; /* Espacio mínimo entre etiqueta y valor */
}
.label { color: #888; font-weight: 500; }
.value { color: #000; font-weight: 600; text-align: right; }

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* --- SVG OVERLAY PARA LA LÍNEA --- */
.connector-svg {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 1999; /* Justo debajo de la tarjeta */
}

.connector-svg .handle {
  cursor: move;
  transition: r 0.2s;
}
.connector-svg .handle:hover { r: 8; fill: #f2dd1c; }

/* --- RESIZE HANDLE --- */
.resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 15px;
  height: 15px;
  cursor: nwse-resize; 
  z-index: 10;
}
.resize-handle::after {
  content: '';
  position: absolute;
  bottom: 4px;
  right: 4px;
  width: 6px;
  height: 6px;
  border-right: 2px solid #ccc;
  border-bottom: 2px solid #ccc;
}
</style>