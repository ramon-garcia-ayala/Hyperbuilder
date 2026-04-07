<template>
  <div class="chart-card" :style="chartCardStyle" :class="{ 'is-floating': isFloating, 'is-dragging': draggingTarget }" ref="cardRef">
    <!-- HEADER ARRASTRABLE -->
    <div class="chart-header" @mousedown="startDragChart">
      <button v-if="isFloating" class="dock-btn" @click="dockChart" title="Return to sidebar">‹</button>
      {{ title }}
      <button class="random-name-btn" @mousedown.stop @click="randomizeNames" title="Randomize Program Names">🎲</button>
      <button class="snap-btn" @mousedown.stop @click="captureChart" title="Snapshot">+</button>
    </div>
    
    <div class="chart-body">
      <div class="chart-wrapper">
        <Doughnut 
          ref="doughnutRef"
          v-if="chartData.labels.length > 0" 
          :data="chartData" 
          :options="chartOptions" 
          :plugins="plugins"
        />
        <p v-else class="no-data">Waiting for Data...</p>

        <!-- FLOATING LABELS (Double click to edit) -->
        <div v-for="(coord, i) in labelCoords" :key="i"
             class="chart-label"
             :class="coord.align"
             :style="{ left: coord.x + 'px', top: coord.y + 'px' }"
             @dblclick="startEdit(i)">
             
          <!-- Edit Input -->
          <input v-if="editingIndex === i" v-model="localLabels[i]" @blur="stopEdit" @keyup.enter="stopEdit" class="label-input" autofocus />
          <!-- Normal Text -->
          <span v-else>{{ localLabels[i] }}</span>
        </div>

      </div>
    </div>
    
    <!-- RESIZE HANDLE: Only when floating -->
    <div v-if="isFloating" class="resize-handle" @mousedown.stop.prevent="startResize"></div>
  </div>

  <!-- 1. FLOATING TOOLTIP (Follows mouse) -->
  <div v-if="tooltip.visible" class="custom-tooltip info-card-style" :style="{ top: tooltip.y + 'px', left: tooltip.x + 'px' }">
    <div class="card-header">
      <span>{{ tooltip.label }}</span>
    </div>
    <div class="card-body">
      <div class="info-row">
        <span class="label">Area:</span>
        <span class="value">{{ tooltip.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) }} m²</span>
      </div>
      <template v-if="tooltip.breakdown && Object.keys(tooltip.breakdown).length > 0">
        <div v-for="(count, tower) in tooltip.breakdown" :key="tower" class="info-row">
          <span class="label">{{ tower }}:</span>
          <span class="value">{{ count }} {{ count === 1 ? 'prg' : 'prgs' }}</span>
        </div>
      </template>
      <div class="tooltip-hint">(Click to edit color)</div>
    </div>
  </div>

  <!-- 2. COLOR POPUP (Draggable) -->
  <div 
    v-if="colorPopup.visible" 
    class="color-popup" 
    :style="{ top: colorPopup.y + 'px', left: colorPopup.x + 'px' }"
    @mousedown="startDragPopup"
  >
    <div class="popup-header">Edit Color</div>
    <div class="popup-body">
      <!-- v-model asegura cambio en tiempo real -->
      <input type="color" class="color-input" v-model="colors[colorPopup.index]" />
      <button class="ok-btn" @click="closePopup">OK</button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { Doughnut } from 'vue-chartjs' // Importamos Doughnut
import { Chart as ChartJS, Title, Tooltip, Legend, ArcElement } from 'chart.js'

// Registramos ArcElement para gráficos circulares
ChartJS.register(Title, Tooltip, Legend, ArcElement)

const props = defineProps({
  title: { type: String, default: 'Data Analysis' },
  labels: { type: Array, default: () => [] }, // Ej: ['Piso 1', 'Piso 2']
  values: { type: Array, default: () => [] },  // Ej: [120, 150]
  sidebarOpen: { type: Boolean, default: true }, // New prop to know if we can dock
  gridSize: { type: Number, default: 20 },
  colors: { type: Array, default: null }, // Optional external colors
  colorMode: { type: String, default: 'program' }, // To know the current color mode
  points: { type: Array, default: () => [] }, // Added to know the towers mapping
  programNames: { type: Array, default: () => [] },
  towerNames: { type: Array, default: () => [] }
})

const emits = defineEmits(['update-program-name', 'update-tower-name'])

// --- STATE: Editable labels and coords ---
const localLabels = ref([])
const labelCoords = ref([])
const editingIndex = ref(null)

// Selection and Color State
const selectedIndex = ref(null)
const colors = ref([])

// Floating Tooltip State
const tooltip = ref({ visible: false, x: 0, y: 0, label: '', value: 0, breakdown: {} })

// Color Popup State
const colorPopup = ref({ visible: false, x: 0, y: 0, index: -1 })

const cardRef = ref(null) // Referencia al elemento DOM de la tarjeta
// Drag & Drop State
const draggingTarget = ref(null) // 'chart' o 'popup'
const dragOffset = ref({ x: 0, y: 0 })

// Posición de la tarjeta del gráfico (null = está "docked" en la sidebar)
const chartPos = ref(null) 
const isFloating = ref(false)
const doughnutRef = ref(null)
const customSize = ref({ width: null, height: null })

// --- GROUPING LOGIC ---
const processedData = computed(() => {
  const groups = {}
  const towerMap = []
  
  // Construir mapa de a qué torre pertenece cada índice
  if (props.points) {
    props.points.forEach((tower, tIndex) => {
      if (tower.program) {
        tower.program.forEach(() => {
          towerMap.push(tIndex)
        })
      }
    })
  }

  const len = Math.max(props.values.length, props.colors ? props.colors.length : 0)
  
  // Agrupar los segmentos iterando sobre todos ellos
  for(let i=0; i < len; i++) {
     const color = (props.colors && props.colors[i]) ? props.colors[i] : '#cccccc'
     const val = props.values[i] || 0
     const tIndex = towerMap[i] !== undefined ? towerMap[i] : -1
     
     // Determinar a qué índice de programa corresponde este segmento
     let pIndex = -1;
     if (props.points && tIndex >= 0) {
       let currentFlat = 0;
       for(let t=0; t<=tIndex; t++) {
         const tower = props.points[t];
         if(t === tIndex) {
            pIndex = i - currentFlat;
         }
         currentFlat += tower.program ? tower.program.length : 0;
       }
     }

     let baseLabel = (props.labels && props.labels[i]) ? props.labels[i] : `Program ${pIndex + 1}`

     if (props.programNames && props.programNames[pIndex]) {
       baseLabel = props.programNames[pIndex]
     }

     if (props.colorMode === 'tower' && tIndex >= 0) {
       baseLabel = props.towerNames && props.towerNames[tIndex] ? props.towerNames[tIndex] : `Tower ${tIndex + 1}`
     }

     if (!groups[color]) {
       groups[color] = { color, area: 0, label: baseLabel, towerCounts: {}, pIndex, tIndex }
     }
     groups[color].area += val
     
     if (tIndex >= 0) {
       const tName = props.towerNames && props.towerNames[tIndex] ? props.towerNames[tIndex] : `Tower ${tIndex + 1}`
       groups[color].towerCounts[tName] = (groups[color].towerCounts[tName] || 0) + 1
     }
  }
  return Object.values(groups)
})

// Computamos los datos para que el gráfico reaccione a los cambios de Grasshopper
const chartData = computed(() => {
  return {
    labels: localLabels.value, // Usamos las etiquetas locales (editables)
    datasets: [
      {
        label: 'Area',
        backgroundColor: colors.value,
        hoverOffset: 10, // Pequeña elevación al pasar el mouse
        offset: (ctx) => ctx.dataIndex === selectedIndex.value ? 25 : 0, // Elevación GRANDE al hacer clic
        borderColor: '#ffffff',
        borderWidth: 1,
        data: processedData.value.map(g => g.area)
      }
    ]
  }
})

// Dynamic style for the card
const chartCardStyle = computed(() => {
  // If docked, reset styles
  if (!isFloating.value) {
    return {}
  }

  // If floating, use coords and size
  const width = customSize.value.width || 280
  const height = customSize.value.height || 360 // Por defecto será más alta (rectangular)
  return {
    left: chartPos.value ? `${chartPos.value.x}px` : '0px',
    top: chartPos.value ? `${chartPos.value.y}px` : '0px',
    width: `${width}px`,
    height: `${height}px`
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  layout: { padding: 55 }, // Padding uniforme para mantener la dona circular y dar espacio al texto
  plugins: {
    legend: { display: false }, // Ocultamos leyenda para ahorrar espacio
    tooltip: { enabled: false } // DISABLE native tooltip
  },
  // HOVER EVENT for Custom Tooltip
  onHover: (evt, elements) => {
    if (elements.length > 0) {
      const idx = elements[0].index
      const group = processedData.value[idx]
      tooltip.value = {
        visible: true,
        x: evt.native.clientX + 15, // Un poco a la derecha del cursor
        y: evt.native.clientY + 15,
        label: localLabels.value[idx], // Usamos etiqueta local
        value: group.area,
        breakdown: group.towerCounts
      }
    } else {
      tooltip.value.visible = false
    }
  },
  // CLICK EVENT to open Color Popup
  onClick: (evt, elements) => {
    if (elements.length > 0) {
      const clickedIndex = elements[0].index
      selectedIndex.value = selectedIndex.value === clickedIndex ? null : clickedIndex
      
      if (selectedIndex.value !== null) {
        // Abrir popup cerca del mouse inicialmente
        colorPopup.value = {
          visible: true,
          x: evt.native.clientX,
          y: evt.native.clientY,
          index: clickedIndex
        }
      } else {
        colorPopup.value.visible = false
      }
    } else {
      // Clic fuera limpia selección
      selectedIndex.value = null
      colorPopup.value.visible = false
    }
  }
}

watch(() => processedData.value, (newData) => {
  if (newData) {
    localLabels.value = newData.map(g => g.label)
    colors.value = newData.map(g => g.color)
  }
}, { immediate: true, deep: true })

// --- PLUGIN PERSONALIZADO PARA LINEAS CONECTORAS ---
const labelPlugin = {
  id: 'labelConnector',
  afterDraw(chart) {
    const ctx = chart.ctx
    const meta = chart.getDatasetMeta(0)
    const newCoords = []
    
    ctx.save()
    ctx.strokeStyle = 'rgba(0,0,0,0.2)' // Línea sutil
    ctx.lineWidth = 1

    meta.data.forEach((arc, i) => {
      const { x, y, outerRadius, startAngle, endAngle } = arc
      const midAngle = startAngle + (endAngle - startAngle) / 2
      
      // Calculate line points
      const rStart = outerRadius + 2
      const rEnd = outerRadius + 25 // Longitud de la línea
      
      const x1 = x + Math.cos(midAngle) * rStart
      const y1 = y + Math.sin(midAngle) * rStart
      const x2 = x + Math.cos(midAngle) * rEnd
      const y2 = y + Math.sin(midAngle) * rEnd
      
      // Draw line
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
      
      // Save coord for HTML text
      newCoords.push({
        x: x2,
        y: y2,
        align: Math.cos(midAngle) >= 0 ? 'left' : 'right'
      })
    })
    ctx.restore()

    // Update coords (avoid infinite loop)
    if (JSON.stringify(newCoords) !== JSON.stringify(labelCoords.value)) {
       labelCoords.value = newCoords
    }
  }
}
const plugins = [labelPlugin]

function startEdit(index) {
  editingIndex.value = index
  nextTick(() => { document.querySelector('.label-input')?.focus() })
}
function stopEdit() { 
  const i = editingIndex.value
  editingIndex.value = null 
  
  if (i !== null && i !== undefined) {
    const group = processedData.value[i]
    if (group) {
      if (props.colorMode === 'program' && group.pIndex >= 0) {
        emits('update-program-name', { index: group.pIndex, name: localLabels.value[i] })
      } else if (props.colorMode === 'tower' && group.tIndex >= 0) {
        emits('update-tower-name', { index: group.tIndex, name: localLabels.value[i] })
      }
    }
  }
}

// --- NOMBRES ALEATORIOS PARA PROGRAMAS ---
function randomizeNames() {
  const programs = ['Offices', 'Hotel', 'Residential', 'Retail', 'Amenities', 'Parking', 'Labs', 'Education', 'Green Area', 'Restaurant', 'Gym', 'Clinic', 'Library', 'Exhibition'];
  let availablePrograms = [...programs];
  
  processedData.value.forEach(group => {
    // Si por casualidad hay más programas que nombres en la lista, la reiniciamos
    if (availablePrograms.length === 0) {
      availablePrograms = [...programs];
    }
    
    // Elegimos un índice al azar, extraemos el nombre y lo eliminamos de los disponibles
    const randomIndex = Math.floor(Math.random() * availablePrograms.length);
    const randomName = availablePrograms.splice(randomIndex, 1)[0];

    // Dependiendo del modo, actualizamos el programa o la torre globalmente
    if (props.colorMode === 'program' && group.pIndex >= 0) {
      emits('update-program-name', { index: group.pIndex, name: randomName });
    } else if (props.colorMode === 'tower' && group.tIndex >= 0) {
      emits('update-tower-name', { index: group.tIndex, name: randomName });
    }
  });
}

// --- DRAG & DROP LOGIC ---

function startDragChart(event) {
  draggingTarget.value = 'chart'
  const card = event.target.closest('.chart-card')

  // If docked, make it float at current mouse pos
  if (!isFloating.value) {
    isFloating.value = true
    const rect = card.getBoundingClientRect()
    chartPos.value = { x: rect.left, y: rect.top }
    // Ensure clean size state
    customSize.value = { width: 280, height: 360 } // Altura extendida para la vista flotante
  }
  
  dragOffset.value = {
    x: event.clientX - chartPos.value.x,
    y: event.clientY - chartPos.value.y
  }
  addListeners()
}

// --- RESIZE LOGIC ---
function startResize(e) {
  window.addEventListener('mousemove', onResize)
  window.addEventListener('mouseup', stopResize)
}

function onResize(e) {
  const rect = cardRef.value.getBoundingClientRect()
  // Calculate new size
  let w = Math.max(280, e.clientX - rect.left)
  let h = Math.max(300, e.clientY - rect.top)

  // Snap to grid in real-time
  w = Math.round(w / props.gridSize) * props.gridSize
  h = Math.round(h / props.gridSize) * props.gridSize

  customSize.value = { width: w, height: h }
}

function stopResize() {
  window.removeEventListener('mousemove', onResize)
  window.removeEventListener('mouseup', stopResize)
}


function startDragPopup(event) {
  draggingTarget.value = 'popup'
  dragOffset.value = {
    x: event.clientX - colorPopup.value.x,
    y: event.clientY - colorPopup.value.y
  }
  addListeners()
}

function addListeners() {
  // Añadimos listeners globales
  window.addEventListener('mousemove', onDrag)
  window.addEventListener('mouseup', stopDrag)
}

function onDrag(event) {
  if (draggingTarget.value === 'popup') {
    colorPopup.value.x = event.clientX - dragOffset.value.x
    colorPopup.value.y = event.clientY - dragOffset.value.y
  } else if (draggingTarget.value === 'chart') {
    chartPos.value = {
      x: event.clientX - dragOffset.value.x,
      y: event.clientY - dragOffset.value.y
    }
  }
}

function stopDrag(event) {
  // MAGNET LOGIC: Dock if close to sidebar
  if (draggingTarget.value === 'chart' && isFloating.value) {
    // La barra lateral mide aprox 340px. Usamos 360px como umbral de atracción.
    if (props.sidebarOpen && event.clientX > window.innerWidth - 360) dockChart()
    else {
      // --- BOUNDARY CHECK ---
      // Si no se acopla, verificamos que no se salga de la pantalla
      const card = cardRef.value
      if (card && chartPos.value) {
        const rect = card.getBoundingClientRect()
        const winW = window.innerWidth
        const winH = window.innerHeight
        
        let newX = chartPos.value.x
        let newY = chartPos.value.y

        if (newX < 0) newX = 0
        if (newY < 0) newY = 0
        if (newX + rect.width > winW) newX = winW - rect.width
        if (newY + rect.height > winH) newY = winH - rect.height

        // --- SNAP TO GRID ---
        newX = Math.round(newX / props.gridSize) * props.gridSize
        newY = Math.round(newY / props.gridSize) * props.gridSize

        chartPos.value = { x: newX, y: newY }
      }
    }
  }

  draggingTarget.value = null
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', stopDrag)
}

function dockChart() {
  isFloating.value = false // Disable floating
  chartPos.value = null    // Clear coords
  // FORCE RESET SIZE
  customSize.value = { width: null, height: null }
}

function captureChart() {
  const chartInstance = doughnutRef.value?.chart
  if (!chartInstance) return

  const ctx = chartInstance.ctx
  const canvas = chartInstance.canvas
  
  // 1. Draw HTML labels onto canvas temporarily
  ctx.save()
  ctx.font = "bold 10px 'Roboto Mono', monospace"
  ctx.fillStyle = "#333"
  ctx.textBaseline = "middle"

  localLabels.value.forEach((label, i) => {
    const coord = labelCoords.value[i]
    if (coord) {
      ctx.textAlign = coord.align
      ctx.fillText(label, coord.x, coord.y)
    }
  })
  ctx.restore()

  // 2. Download Image
  const link = document.createElement('a')
  link.href = canvas.toDataURL("image/png")
  link.download = `Analysis_${props.title.replace(/\s+/g, '_')}.png`
  link.click()

  // 3. Cleanup Canvas (redraw)
  chartInstance.update('none')
}

function closePopup() {
  colorPopup.value.visible = false
  selectedIndex.value = null // Opcional: deseleccionar al cerrar
}

// Limpieza de eventos al desmontar
onUnmounted(() => {
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', stopDrag)
})

// EXPOSE: Allow Version History to save/restore state
defineExpose({
  getState: () => ({
    isFloating: isFloating.value,
    chartPos: chartPos.value,
    customSize: { ...customSize.value } // Copia del objeto
  }),
  setState: (state) => {
    if (!state) return
    isFloating.value = state.isFloating
    chartPos.value = state.chartPos
    customSize.value = state.customSize || { width: null, height: null }
  }
})
</script>

<style scoped>

.chart-card {
  position: relative; /* Por defecto, se posiciona dentro de la sidebar */
  align-self: stretch; /* Se estira en el sidebar sin usar width:100% que rompe el fixed */
  aspect-ratio: 1/1; /* FIX: Forzar forma cuadrada */
  background: rgba(255, 255, 255, 0.95); /* Más opaco para mejor lectura */
  backdrop-filter: blur(5px);
  padding: 0; /* Padding movido al chart-body */
  display: flex;
  flex-direction: column;
  border-radius: 15px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.1);
  border: 1px solid rgba(0,0,0,0.1);
  margin-bottom: 20px; /* Espacio entre diagramas en la sidebar */
  box-sizing: border-box; /* Asegura que el borde no sume al tamaño total */
}

.chart-card.is-floating {
  position: fixed; /* Se vuelve flotante al arrastrar */
  aspect-ratio: auto !important; /* FIX: Permitir altura libre al flotar */
  z-index: 1001;
  transition: left 0.2s ease, top 0.2s ease, width 0.2s ease, height 0.2s ease;
}

.chart-card.is-dragging {
  /* Anulamos las transiciones al arrastrar o hacer resize para que siga el mouse al instante */
  transition: none !important; 
}

/* Reactivamos los eventos del mouse dentro de la tarjeta para poder hacer clic en el gráfico */
.chart-card * {
}

.chart-body {
  padding: 12px;
  display: flex;
  align-items: center;      /* Centra horizontalmente */
  justify-content: center;  /* Centra verticalmente */
  flex-grow: 1;
  overflow: visible;
  min-height: 0; /* Vital para que el flex-child pueda encogerse hacia adentro */
}

.chart-wrapper {
  position: relative;
  width: 100%;
  max-height: 100%; /* Limita el crecimiento y fuerza al aspect-ratio a achicar el ancho si choca arriba/abajo */
  aspect-ratio: 1 / 1;
}

.no-data {
  font-size: 0.7rem;
  color: #999;
  text-align: center;
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  transform: translateY(-50%);
  margin: 0;
}

/* --- ETIQUETAS MINIMALISTAS --- */
.chart-label {
  position: absolute;
  font-family: 'Roboto Mono', monospace;
  font-size: 0.65rem;
  color: #333;
  white-space: nowrap;
  pointer-events: auto;
  cursor: text;
  padding: 2px 4px;
  border-radius: 4px;
  
  /* Limites para asegurar que no rompan la tarjeta */
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background 0.2s;
}
.chart-label:hover { background: rgba(0,0,0,0.05); }

/* Alineación basada en la posición (Izquierda/Derecha del gráfico) */
.chart-label.left { transform: translate(0, -50%); text-align: left; }
.chart-label.right { transform: translate(-100%, -50%); text-align: right; }

.label-input {
  width: 60px;
  border: none;
  border-bottom: 1px solid black;
  background: transparent;
  font-family: inherit;
  font-size: inherit;
  outline: none;
  padding: 0;
}

/* --- TOOLTIP FLOTANTE (ESTILO INFO CARD) --- */
.custom-tooltip.info-card-style {
  position: fixed;
  z-index: 9999;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(0,0,0,0.1);
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.15);
  font-family: 'Roboto Mono', monospace;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
  min-width: 150px;
}

.custom-tooltip .card-header {
  background: #f5f5f5;
  padding: 6px 10px;
  font-size: 0.75rem;
  font-weight: bold;
  color: #333;
  border-bottom: 1px solid #eee;
  text-align: left;
}

.custom-tooltip .card-body {
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
}

.custom-tooltip .info-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
  font-size: 0.7rem;
  white-space: nowrap;
  gap: 15px;
}

.custom-tooltip .label { color: #888; font-weight: 500; }
.custom-tooltip .value { color: #000; font-weight: 600; text-align: right; }

.custom-tooltip .tooltip-hint { 
  font-size: 0.6rem; 
  color: #aaa; 
  margin-top: 6px; 
  font-style: italic; 
  text-align: center; 
  border-top: 1px dashed #eee;
  padding-top: 4px;
}

/* --- POPUP ARRASTRABLE MINIMALISTA --- */
.color-popup {
  position: fixed;
  z-index: 10000;
  width: 140px;
  background: white;
  border-radius: 10px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.2);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  cursor: move; /* Indica que se puede mover */
  border: 1px solid #eee;
}

/* Estilos compartidos para headers */
.popup-header, .chart-header {
  background: #f5f5f5;
  font-size: 0.65rem; /* Fuente ligeramente más pequeña */
  font-weight: bold;
  padding: 6px;
  text-align: center;
  border-bottom: 1px solid #eee;
  text-transform: uppercase;
  color: #555;
  cursor: move; /* Cursor de movimiento */
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dock-btn {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(0,0,0,0.05);
  border: 1px solid rgba(0,0,0,0.1);
  color: #333;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1.2rem;
  padding: 0;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.random-name-btn {
  position: absolute;
  right: 36px; /* Acomodado justo a un lado del botón snap (+) */
  top: 50%;
  transform: translateY(-50%);
  background: rgba(0,0,0,0.05);
  border: 1px solid rgba(0,0,0,0.1);
  color: #333;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.random-name-btn:hover { background: rgba(0,0,0,0.15); }

.dock-btn:hover {
  background: rgba(0,0,0,0.15);
}

.snap-btn {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(0,0,0,0.05);
  border: 1px solid rgba(0,0,0,0.1);
  color: #333;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.snap-btn:hover {
  background: rgba(0,0,0,0.15);
}

.popup-body {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  cursor: default;
}

.color-input {
  width: 100%;
  height: 30px;
  border: none;
  cursor: pointer;
  background: none;
}

.ok-btn {
  background: black;
  color: white;
  border: none;
  padding: 4px 15px;
  border-radius: 4px;
  font-size: 0.7rem;
  cursor: pointer;
  width: 100%;
}
.ok-btn:hover { background: #333; }

/* --- RESIZE HANDLE --- */
.resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 15px;
  height: 15px;
  cursor: nwse-resize; /* Cursor diagonal */
  z-index: 10;
}
/* Indicador visual (esquina gris) */
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