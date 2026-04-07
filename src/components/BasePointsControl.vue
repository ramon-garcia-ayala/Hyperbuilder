<template>
  <div class="points-control-box">
    <div class="header-row">
      <p class="table-title">PROJECT GRID ({{ points.length }} Pts)</p>
      <div class="header-actions">
        <button class="add-btn" @click="addPoint" title="Add New Tower">Add +</button>
        <button v-if="isEditing" class="add-btn clear-btn" @click="clearPoints" title="Clear All Points">Clear</button>
        <button class="edit-btn" :class="{ 'edit-active': isEditing }" @click="toggleEdit" title="Toggle Edit Mode">
          {{ isEditing ? 'Done' : 'Edit Mode' }}
        </button>
      </div>
    </div>

    <!-- 2D MAP GRID VISUALIZATION -->
    <div class="grid-map-container" :class="{ 'is-editing': isEditing }">
      <svg 
        class="points-svg" 
        :class="{ 'is-editing': isEditing }"
        :viewBox="gridBounds" 
        preserveAspectRatio="xMidYMid meet" 
        ref="svgRef"
        @mousedown="onGridClick">
        
        <!-- REJILLA DINÁMICA DE 10x10 METROS -->
        <defs>
          <pattern id="bg-grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#e5e5e5" stroke-width="1" vector-effect="non-scaling-stroke" />
          </pattern>
        </defs>
        <!-- Rectángulo infinito para cubrir siempre todo el marco visible -->
        <rect x="-10000" y="-10000" width="20000" height="20000" fill="url(#bg-grid)" />

        <!-- Ejes (Origen 0,0) -->
        <line x1="-10000" y1="0" x2="10000" y2="0" stroke="#ccc" stroke-width="1.5" vector-effect="non-scaling-stroke" />
        <line x1="0" y1="-10000" x2="0" y2="10000" stroke="#ccc" stroke-width="1.5" vector-effect="non-scaling-stroke" />

        <!-- Puntos -->
        <circle 
          v-for="(pt, index) in points" 
          :key="index"
          :cx="draggingIndex === index ? tempDragPoint.x : pt.x" 
          :cy="draggingIndex === index ? -tempDragPoint.y : -pt.y" 
          :r="selectedIndex === index ? maxExtent * 0.06 : maxExtent * 0.04"
          :fill="selectedIndex === index ? '#2847fc' : '#f2dd1c'"
          stroke="black"
          stroke-width="1"
          vector-effect="non-scaling-stroke"
          class="map-point"
          @mousedown.stop="startDrag(index, $event)"
          @click.stop="selectPoint(index)"
        />
      </svg>
      <div v-if="points.length === 0" class="empty-msg">No points. Add one to start.</div>
    </div>

    <!-- EDITOR DE PUNTO SELECCIONADO -->
    <div v-if="selectedIndex !== null && points[selectedIndex]" class="selected-editor">
      <div class="editor-header">
        <span>EDIT POINT #{{ selectedIndex + 1 }}</span>
        <button class="delete-btn" @click="removePoint(selectedIndex)">Delete</button>
      </div>
      <div class="coord-row">
        <div class="input-group"><label>X</label><input type="number" v-model.number="points[selectedIndex].x"></div>
        <div class="input-group"><label>Y</label><input type="number" v-model.number="points[selectedIndex].y"></div>
        <div class="input-group"><label>Z</label><input type="number" v-model.number="points[selectedIndex].z"></div>
      </div>
    </div>
    <div v-else-if="points.length > 0" class="instruction">Enable Edit Mode to add starting points into the grid cords.</div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

// Recibimos la lista de puntos como v-model
const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:modelValue', 'clear-points', 'edit-mode-changed'])

const svgRef = ref(null)
const isEditing = ref(false)
const draggingIndex = ref(null) // Para saber qué punto se está arrastrando
const tempDragPoint = ref({ x: 0, y: 0 }) // Almacenamiento temporal para visualización suave

// Computada para leer/escribir de forma limpia
const points = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

function toggleEdit() {
  isEditing.value = !isEditing.value
  selectedIndex.value = null
  emit('edit-mode-changed', isEditing.value)
}

function onGridClick(event) {
  if (!isEditing.value || !svgRef.value || draggingIndex.value !== null) return

  const pt = svgRef.value.createSVGPoint()
  pt.x = event.clientX
  pt.y = event.clientY

  const CTM = svgRef.value.getScreenCTM()
  if (!CTM) return

  const svgP = pt.matrixTransform(CTM.inverse())

  // Map SVG coordinates back to World coordinates
  let x = Math.round(svgP.x * 10) / 10
  let y = Math.round(-svgP.y * 10) / 10
  
  // FIX: Inicializar el punto con las propiedades requeridas por el sistema (program, floorHeight)
  // Esto evita que 'computeData' falle o envíe undefined mientras el watcher del padre reacciona.
  
  // NUEVA TORRE: Valores por defecto estáticos
  const defaultProgram = [2, 2, 2, 2]
  const defaultFloor = 3

  const newPoint = { x, y, z: 0, floorHeight: defaultFloor, program: defaultProgram, rotation: 0, scaleX: 1, scaleY: 1, scaleZ: 1 }
  const newPoints = [...points.value, newPoint]
  emit('update:modelValue', newPoints)
  selectedIndex.value = newPoints.length - 1
}

function addPoint() {
  const defaultProgram = [2, 2, 2, 2]
  const defaultFloor = 3

  let newX = 0
  let newY = 0
  const spacing = 25 // Distancia aumentada entre torres para evitar colisión y dar más espacio

  if (points.value.length > 0) {
    let placed = false
    // Búsqueda en cuadrícula concéntrica (dinámica para asegurar siempre un espacio)
    const searchLimit = maxExtent.value + 50
    for (let radius = 0; radius <= searchLimit; radius += spacing) {
      for (let x = -radius; x <= radius; x += spacing) {
        for (let y = -radius; y <= radius; y += spacing) {
          // Evaluamos solo los puntos en el perímetro del 'cuadrado' de búsqueda actual
          if (Math.abs(x) !== radius && Math.abs(y) !== radius) continue

          // Validamos que la nueva posición no colisione con otras
          const isColliding = points.value.some(pt => 
            Math.sqrt((pt.x - x)**2 + (pt.y - y)**2) < spacing
          )

          if (!isColliding) {
            newX = x
            newY = y
            placed = true
            break
          }
        }
        if (placed) break
      }
      if (placed) break
    }
  }

  const newPoint = { x: newX, y: newY, z: 0, floorHeight: defaultFloor, program: defaultProgram, rotation: 0, scaleX: 1, scaleY: 1, scaleZ: 1 }
  const newPoints = [...points.value, newPoint]
  emit('update:modelValue', newPoints)
  selectedIndex.value = newPoints.length - 1
}

function startDrag(index, event) {
  if (!isEditing.value) return
  
  draggingIndex.value = index
  selectPoint(index)
  // Copiamos la posición actual al temporal para iniciar
  tempDragPoint.value = { ...points.value[index] }

  window.addEventListener('mousemove', onDrag)
  window.addEventListener('mouseup', stopDrag)
}

function onDrag(event) {
  if (draggingIndex.value === null || !svgRef.value) return
  event.preventDefault()

  const CTM = svgRef.value.getScreenCTM()
  if (!CTM) return

  const pt = svgRef.value.createSVGPoint()
  pt.x = event.clientX
  pt.y = event.clientY
  
  const svgP = pt.matrixTransform(CTM.inverse())

  let x = Math.round(svgP.x * 10) / 10
  let y = Math.round(-svgP.y * 10) / 10

  // SOLO actualizamos la variable temporal visual, NO el modelo reactivo
  tempDragPoint.value = { x, y }
}

function stopDrag() {
  if (draggingIndex.value !== null) {
    // Al soltar, AHORA SÍ actualizamos el modelo real para disparar el compute
    const newPoints = [...points.value]
    // FIX: Preservar las propiedades existentes (sliders) y solo actualizar posición
    newPoints[draggingIndex.value] = { ...newPoints[draggingIndex.value], ...tempDragPoint.value, z: 0 }
    emit('update:modelValue', newPoints)
  }

  draggingIndex.value = null
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', stopDrag)
}

function clearPoints() {
  emit('update:modelValue', [])
  emit('clear-points')
  selectedIndex.value = null
}

function removePoint(index) {
  // Emitimos una NUEVA lista sin el punto eliminado
  const newPoints = [...points.value]
  newPoints.splice(index, 1)
  emit('update:modelValue', newPoints)
  selectedIndex.value = null
}

function selectPoint(index) {
  selectedIndex.value = index
}

const selectedIndex = ref(null)

// --- LÓGICA DE AUTO-ZOOM INFINITO ---
const dynamicExtent = computed(() => {
  let maxX = 25 // Límite mínimo para que la cuadrícula no se colapse al centro
  let maxY = 25
  
  points.value.forEach((pt, i) => {
    const p = (draggingIndex.value === i) ? tempDragPoint.value : pt
    if (Math.abs(p.x) > maxX) maxX = Math.abs(p.x)
    if (Math.abs(p.y) > maxY) maxY = Math.abs(p.y)
  })
  
  return { x: maxX + 10, y: maxY + 10 } // Agregamos un margen perimetral
})

const maxExtent = computed(() => Math.max(dynamicExtent.value.x, dynamicExtent.value.y))

const gridBounds = computed(() => {
  const extX = dynamicExtent.value.x
  const extY = dynamicExtent.value.y
  return `${-extX} ${-extY} ${extX * 2} ${extY * 2}`
})
</script>

<style scoped>
.header-row {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 5px;
}
.header-actions { display: flex; gap: 5px; }

/* Copiamos el estilo de table-title para mantener consistencia */
.table-title {
  font-family: "Roboto Mono", monospace;
  font-size: 0.7rem;
  font-weight: bold;
  margin: 15px 0 10px 0;
  letter-spacing: 1px;
  opacity: 0.6;
}

.add-btn {
  background: #f2dd1c; color: black; border: none; border-radius: 4px;
  padding: 2px 8px; cursor: pointer; font-size: 0.65rem; font-weight: bold;
  font-family: 'Roboto Mono', monospace;
}
.add-btn:hover { background: #e0cc1b; }

.edit-btn {
  background: #2847fc; color: white; border: none; border-radius: 4px;
  padding: 2px 8px; cursor: pointer; font-size: 0.65rem; font-weight: bold;
  font-family: 'Roboto Mono', monospace; transition: background 0.2s;
}
.edit-btn:hover, .edit-btn.edit-active { background: #1f36c4; }

.clear-btn {
  background: #ffcccc; color: #d80000;
}
.clear-btn:hover { background: #ffaaaa; }

/* GRID MAP STYLES */
.grid-map-container {
  width: 100%;
  height: 150px;
  background-color: #f9f9f9;
  border: 1px solid #ddd;
  border-radius: 4px;
  position: relative;
  overflow: hidden;
  transition: background-color 0.3s ease, border-color 0.3s ease;
}

.grid-map-container.is-editing {
  background-color: rgba(40, 71, 252, 0.08); /* Azul muy sutil */
  border-color: rgba(40, 71, 252, 0.4);
}

.points-svg {
  width: 100%;
  height: 100%;
  cursor: default;
}
.points-svg.is-editing {
  cursor: crosshair;
}

.map-point {
  cursor: pointer;
  transition: r 0.2s, fill 0.2s;
}
.is-editing .map-point {
  cursor: move;
}

.map-point:hover { stroke: #2847fc; stroke-width: 2px; }

.empty-msg {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  color: #aaa; font-size: 0.7rem; pointer-events: none;
}

/* EDITOR STYLES */
.selected-editor {
  margin-top: 10px;
  background: white;
  border: 1px solid rgba(0,0,0,0.1);
  padding: 8px;
  border-radius: 4px;
}

.editor-header {
  display: flex; justify-content: space-between; margin-bottom: 5px;
  font-size: 0.65rem; font-weight: bold; color: #555;
}
.delete-btn {
  background: #ffcccc; color: #d80000; border: none; padding: 2px 6px;
  border-radius: 3px; cursor: pointer; font-size: 0.6rem;
}

.coord-row { display: flex; gap: 5px; }
.input-group { flex: 1; display: flex; flex-direction: column; }
.input-group label { font-size: 0.6rem; color: #888; text-align: center; }
.input-group input {
  width: 100%; border: 1px solid #ddd; text-align: center;
  font-size: 0.7rem; padding: 2px; border-radius: 3px;
}

.instruction {
  font-size: 0.65rem;
  color: #666;
  margin: 5px 0;
  font-style: italic;
}
</style>