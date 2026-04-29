<template>
  <!-- DRAGGABLE FLOATING CARD -->
  <div class="viewcube-card" :style="cardStyle" ref="cardRef">
    <div class="viewcube-header" @mousedown="startDragCard">
      VIEWS
      <span class="toggle-icon" @mousedown.stop @click="toggleCollapse">{{ isCollapsed ? '▼' : '▲' }}</span>
    </div>
    
    <div class="viewcube-body" v-show="!isCollapsed">
      <!-- 1. CONTROL BUTTONS -->
      <div class="controls-row">
        <!-- Play/Pause Rotation -->
        <div class="projection-btn icon-btn" @click="toggleRotation" :title="isPaused ? 'Resume Rotation' : 'Stop Rotation'">
          {{ isPaused ? '▶' : '⏸' }}
        </div>
        <!-- Projection Switch (Iso/Persp) -->
        <div class="projection-btn" @click="toggleProjection">
          {{ isOrtho ? 'ISO' : 'PER' }}
        </div>
        <!-- Recenter Button -->
        <div class="projection-btn icon-btn" @click="recenterView" title="Recenter Model">
          ⌖
        </div>
      </div>

      <!-- 2. 3D CUBE -->
      <div class="cube-scene" @mousedown="startDragCube">
        <div class="cube" ref="cubeEl">
          <!-- Faces (Click to set view) -->
          <div class="face front"  @click="setView('Front')">FRONT</div>
          <div class="face back"   @click="setView('Back')">BACK</div>
          <div class="face right"  @click="setView('Right')">RIGHT</div>
          <div class="face left"   @click="setView('Left')">LEFT</div>
          <div class="face top"    @click="setView('Bottom')">BOT</div>
          <div class="face bottom" @click="setView('Top')">TOP</div>
          
          <!-- Corners (Isometric views) -->
          <div class="corner tfr" @click.stop="setView('BottomFrontRight')" title="Iso Bottom-Front-Right"></div>
          <div class="corner tfl" @click.stop="setView('BottomFrontLeft')"  title="Iso Bottom-Front-Left"></div>
          <div class="corner tbr" @click.stop="setView('BottomBackRight')"  title="Iso Bottom-Back-Right"></div>
          <div class="corner tbl" @click.stop="setView('BottomBackLeft')"   title="Iso Bottom-Back-Left"></div>
          
          <div class="corner bfr" @click.stop="setView('TopFrontRight')" title="Iso Top-Front-Right"></div>
          <div class="corner bfl" @click.stop="setView('TopFrontLeft')"  title="Iso Top-Front-Left"></div>
          <div class="corner bbr" @click.stop="setView('TopBackRight')"  title="Iso Top-Back-Right"></div>
          <div class="corner bbl" @click.stop="setView('TopBackLeft')"   title="Iso Top-Back-Left"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'

const props = defineProps({
  target: Object, // Referencia al GeometryView
  gridSize: { type: Number, default: 20 }
})

const cardRef = ref(null)
const cubeEl = ref(null)
const isOrtho = ref(false)
const isPaused = ref(false)
const isCollapsed = ref(window.innerWidth <= 768)
let animationFrameId

// State for Card Dragging
const cardStyle = ref({ top: '70px', right: '20px' }) // Posición inicial simple
let isDraggingCard = false
let dragOffset = { x: 0, y: 0 }

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value
}

function toggleProjection() {
  if (props.target && props.target.toggleCamera) {
    isOrtho.value = !isOrtho.value
    props.target.toggleCamera(isOrtho.value)
  }
}

function toggleRotation() {
  if (props.target && props.target.toggleAutoRotation) {
    props.target.toggleAutoRotation()
    isPaused.value = !props.target.getAutoRotationState()
  }
}

function recenterView() {
  if (props.target && props.target.resetCameraView) {
    props.target.resetCameraView()
  }
}

function setView(viewName) {
  if (props.target && props.target.setCameraView) {
    props.target.setCameraView(viewName)
  }
}

// SYNC LOOP: Reads Three.js Camera and rotates CSS Cube
function syncCube() {
  if (props.target && props.target.getCamera && cubeEl.value) {
    const camera = props.target.getCamera()
    if (camera) {
      // Extract rotation matrix from camera
      const mat = new THREE.Matrix4()
      mat.extractRotation(camera.matrixWorldInverse)
      
      // Convert to CSS matrix3d format
      const el = mat.elements
      // ORIENTATION CORRECTION:
      // Negate Y to fix Up/Down. Keep Z positive.
      const transform = `matrix3d(
        ${el[0]}, ${-el[1]}, ${el[2]}, ${el[3]},
        ${el[4]}, ${-el[5]}, ${el[6]}, ${el[7]},
        ${el[8]}, ${-el[9]}, ${el[10]}, ${el[11]},
        ${el[12]}, ${-el[13]}, ${el[14]}, ${el[15]})`
      
      cubeEl.value.style.transform = transform
    }
  }
  animationFrameId = requestAnimationFrame(syncCube)
}

// --- CUBE DRAG LOGIC (Rotates Camera) ---
let isDraggingCube = false
let lastMouseX = 0
let lastMouseY = 0

function startDragCube(e) {
  isDraggingCube = true
  lastMouseX = e.clientX
  lastMouseY = e.clientY
  
  window.addEventListener('mousemove', onDragCube)
  window.addEventListener('mouseup', stopDragCube)
}

function onDragCube(e) {
  if (!isDraggingCube) return
  
  const deltaX = e.clientX - lastMouseX
  const deltaY = e.clientY - lastMouseY
  
  lastMouseX = e.clientX
  lastMouseY = e.clientY
  
  if (props.target && props.target.manualOrbit) {
    props.target.manualOrbit(deltaX, deltaY)
  }
}

function stopDragCube() {
  isDraggingCube = false
  window.removeEventListener('mousemove', onDragCube)
  window.removeEventListener('mouseup', stopDragCube)
}

// --- CARD DRAG LOGIC (Moves Widget) ---
function startDragCard(e) {
  isDraggingCard = true
  const card = cardRef.value
  const rect = card.getBoundingClientRect()
  
  // Calculamos offset inicial respecto al mouse
  dragOffset.x = e.clientX - rect.left
  dragOffset.y = e.clientY - rect.top
  
  window.addEventListener('mousemove', onDragCard)
  window.addEventListener('mouseup', stopDragCard)
}

function onDragCard(e) {
  if (!isDraggingCard) return
  
  const card = cardRef.value
  const parent = card.offsetParent || document.body
  const parentRect = parent.getBoundingClientRect()

  // Global to Local coordinates conversion
  const x = e.clientX - parentRect.left - dragOffset.x
  const y = e.clientY - parentRect.top - dragOffset.y

  cardStyle.value = { top: `${y}px`, left: `${x}px`, right: 'auto', bottom: 'auto' }
}

function stopDragCard() {
  isDraggingCard = false
  window.removeEventListener('mousemove', onDragCard)
  window.removeEventListener('mouseup', stopDragCard)

  // --- BOUNDARY CHECK & REBOUND ---
  const card = cardRef.value
  if (!card) return

  const parent = card.offsetParent || document.body
  const rect = card.getBoundingClientRect()
  const parentRect = parent.getBoundingClientRect()

  // Current relative pos
  let x = rect.left - parentRect.left
  let y = rect.top - parentRect.top

  // Limits
  const maxX = parentRect.width - rect.width
  const maxY = parentRect.height - rect.height

  // Ajustar si se sale (con un margen de 10px)
  if (x < 0) x = 10
  if (y < 0) y = 10
  if (x > maxX) x = maxX - 10
  if (y > maxY) y = maxY - 10

  // --- SNAP TO GRID ---
  x = Math.round(x / props.gridSize) * props.gridSize
  y = Math.round(y / props.gridSize) * props.gridSize

  // Apply correction
  cardStyle.value = { top: `${y}px`, left: `${x}px`, right: 'auto', bottom: 'auto' }
}

onMounted(() => {
  syncCube()
})

onUnmounted(() => {
  cancelAnimationFrame(animationFrameId)
})
</script>

<style scoped>
.viewcube-card {
  position: absolute;
  z-index: 90;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(5px);
  border-radius: 8px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.05);
  border: 1px solid rgba(0,0,0,0.1);
  font-family: 'Roboto Mono', monospace;
  display: flex;
  flex-direction: column;
  width: 130px;
  overflow: hidden;
}

.viewcube-header {
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

.viewcube-body {
  padding: 10px 10px 25px 10px; /* Ajustado para eliminar sobrante excesivo */
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px; /* Espacio entre botones y cubo */
}

.controls-row {
  display: flex;
  gap: 5px;
  pointer-events: auto;
}

.toggle-icon {
  cursor: pointer;
  font-size: 0.8rem;
  padding: 0 4px;
}

.projection-btn {
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 4px 8px;
  font-family: 'Roboto Mono', monospace;
  font-size: 0.7rem;
  font-weight: bold;
  cursor: pointer;
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
  transition: background 0.2s;
  min-width: 15px;
  text-align: center;
  display: flex;
  justify-content: center;
}
.projection-btn:hover { background: #f2dd1c; }

.icon-btn {
  font-size: 1.1rem;
  padding: px 8px;
}

/* --- CSS 3D CUBE --- */
.cube-scene {
  width: 60px;
  height: 90px; /* Reduced height slightly to better fit */
  perspective: 400px;
  pointer-events: auto;
}

.cube {
  width: 100%;
  height: 100%;
  position: relative;
  transform-style: preserve-3d;
  /* La rotación se aplica via JS */
}

.face {
  position: absolute;
  width: 60px;
  height: 60px;
  background: rgba(255, 255, 255, 0.9);
  border: 2px solid #ccc;
  color: #555;
  font-family: sans-serif;
  font-weight: bold;
  font-size: 0.6rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s, color 0.2s, border-color 0.2s;
  user-select: none;
  box-shadow: inset 0 0 10px rgba(0,0,0,0.05);
}

.face:hover {
  background: #2847fc; /* Azul IAAC */
  color: white;
  border-color: #2847fc;
}

/* Posicionamiento de las caras */
/* Usamos scale(1, -1) para cancelar la inversión del eje Y del padre y arreglar el texto espejo */
.front  { transform: rotateY(0deg) translateZ(30px) scale(1, -1); }
.back   { transform: rotateY(180deg) translateZ(30px) scale(1, -1); }
.right  { transform: rotateY(90deg) translateZ(30px) scale(1, -1); }
.left   { transform: rotateY(-90deg) translateZ(30px) scale(1, -1); }
.top    { transform: rotateX(90deg) translateZ(30px) scale(1, -1); }
.bottom { transform: rotateX(-90deg) translateZ(30px) scale(1, -1); }

/* --- ESQUINAS (CORNERS) --- */
.corner {
  position: absolute;
  width: 20px;
  height: 20px;
  background: rgba(200, 200, 200, 0.0); /* Invisible por defecto */
  border: 1px solid rgba(0,0,0,0.1);
  z-index: 10;
  cursor: pointer;
  left: 50%;
  top: 35%;
  margin: -10px; /* Centrar */
  transition: background 0.2s;
}
.corner:hover {
  background: #f2dd1c; /* Amarillo IAAC al pasar el mouse */
  border: 1px solid #000;
}

/* Posición de esquinas (X, Y, Z) - Cubo es de 60px, radio es 30px */
/* translate3d(x, y, z) -> x=right, y=down, z=front */
.tfr { transform: translate3d( 30px, -30px,  30px); }
.tfl { transform: translate3d(-30px, -30px,  30px); }
.tbr { transform: translate3d( 30px, -30px, -30px); }
.tbl { transform: translate3d(-30px, -30px, -30px); }

.bfr { transform: translate3d( 30px,  30px,  30px); }
.bfl { transform: translate3d(-30px,  30px,  30px); }
.bbr { transform: translate3d( 30px,  30px, -30px); }
.bbl { transform: translate3d(-30px,  30px, -30px); }

@media (max-width: 768px) {
  .viewcube-card {
    top: 8px !important;
    right: 8px !important;
    left: auto !important;
    width: 110px;
  }
  .viewcube-header { padding: 10px 12px; }
  .toggle-icon { padding: 6px 10px; font-size: 1rem; }
  .projection-btn { padding: 8px 10px; font-size: 0.75rem; }
}
</style>