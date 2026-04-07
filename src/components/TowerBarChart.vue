<template>
  <div class="chart-card" :style="chartCardStyle" :class="{ 'is-floating': isFloating, 'is-dragging': draggingTarget === 'chart' }" ref="cardRef">
    <div class="chart-header" @mousedown="startDragChart">
      <button v-if="isFloating" class="dock-btn" @click="dockChart" title="Return to sidebar">‹</button>
      {{ title }}
      <button class="snap-btn" @mousedown.stop @click="captureChart" title="Snapshot">+</button>
    </div>
    
    <div class="chart-body">
      <!-- Altura mínima dinámica: crece según haya más torres para que las barras no se aplasten -->
      <div class="chart-wrapper" :style="{ minHeight: isFloating ? '100%' : Math.max(150, points.length * 35) + 'px' }">
        <Bar 
          ref="barRef"
          v-if="chartData.labels.length > 0" 
          :data="chartData" 
          :options="chartOptions" 
        />
        <p v-else class="no-data">No Towers Found</p>
      </div>
    </div>
    
    <div v-if="isFloating" class="resize-handle" @mousedown.stop.prevent="startResize"></div>
  </div>
</template>

<script setup>
import { computed, ref, onUnmounted } from 'vue'
import { Bar } from 'vue-chartjs'
import { Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale } from 'chart.js'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

const props = defineProps({
  title: { type: String, default: 'Tower Programs' },
  points: { type: Array, default: () => [] },
  colorMode: { type: String, default: 'program' },
  palette: { type: Array, default: () => ['#f2dd1c', '#2847fc', '#e6194B', '#3cb44b', '#f58231', '#911eb4', '#42d4f4', '#f032e6'] },
  sidebarOpen: { type: Boolean, default: true },
  gridSize: { type: Number, default: 20 },
  programNames: { type: Array, default: () => [] },
  towerNames: { type: Array, default: () => [] }
})

const cardRef = ref(null)
const draggingTarget = ref(null)
const dragOffset = ref({ x: 0, y: 0 })
const chartPos = ref(null) 
const isFloating = ref(false)
const barRef = ref(null)
const customSize = ref({ width: null, height: null })

// Lógica para estructurar los datos del "Stacked Bar Chart"
const chartData = computed(() => {
  const labels = props.points.map((_, i) => props.towerNames && props.towerNames[i] ? props.towerNames[i] : `Tower ${i + 1}`)
  const maxPrograms = Math.max(0, ...props.points.map(p => p.program ? p.program.length : 0))
  
  const datasets = []
  for (let j = 0; j < maxPrograms; j++) {
    const data = []
    const bgColors = []
    
    for (let i = 0; i < props.points.length; i++) {
      const tower = props.points[i]
      // Obtenemos el valor del programa j para la torre i (0 si no existe)
      const val = tower.program && tower.program[j] ? tower.program[j] : 0
      data.push(val)
      
      // Asignar el color según el modo seleccionado
      if (props.colorMode === 'tower') {
        bgColors.push(props.palette[i % props.palette.length])
      } else {
        bgColors.push(props.palette[j % props.palette.length])
      }
    }
    
    datasets.push({
      label: props.programNames && props.programNames[j] ? props.programNames[j] : `Program ${j + 1}`,
      data: data,
      backgroundColor: bgColors,
      borderWidth: 1,
      borderColor: '#ffffff',
      barPercentage: 0.8,
      categoryPercentage: 0.9
    })
  }

  return { labels, datasets }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y', // Convertir las barras a horizontales
  scales: {
    x: { 
      stacked: true, 
      display: true, 
      grid: { display: true, color: 'rgba(0,0,0,0.05)' } 
    },
    y: { 
      stacked: true, 
      reverse: true, // "Hacia abajo": Ordenar la Torre 1 arriba y subsecuentes abajo
      grid: { display: false } 
    }
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      enabled: true,
      mode: 'nearest',
      intersect: true,
      callbacks: {
        label: (context) => {
          const programName = context.dataset.label;
          const towerName = context.label; // Nombre del eje Y (La torre)
          if (props.colorMode === 'tower') {
            return ` ${towerName} - ${programName}: ${context.raw}`;
          }
          return ` ${programName}: ${context.raw}`;
        }
      }
    }
  }
}

const chartCardStyle = computed(() => {
  if (!isFloating.value) return { width: null, height: null }
  
  const styles = {
    left: chartPos.value ? `${chartPos.value.x}px` : '0px',
    top: chartPos.value ? `${chartPos.value.y}px` : '0px',
  }
  
  if (customSize.value.width) {
    styles.width = `${customSize.value.width}px`
    styles.height = `${customSize.value.height}px`
  }
  return styles
})

// --- ARRASTRAR Y SOLTAR ---
function startDragChart(event) {
  draggingTarget.value = 'chart'
  const card = event.target.closest('.chart-card')

  if (!isFloating.value) {
    isFloating.value = true
    const rect = card.getBoundingClientRect()
    chartPos.value = { x: rect.left, y: rect.top }
    // Ajustar el alto inicial dinámicamente si se vuelve flotante
    customSize.value = { width: 280, height: Math.max(200, props.points.length * 40 + 50) } 
  }
  
  dragOffset.value = {
    x: event.clientX - chartPos.value.x,
    y: event.clientY - chartPos.value.y
  }
  addListeners()
}

function startResize(e) {
  window.addEventListener('mousemove', onResize)
  window.addEventListener('mouseup', stopResize)
}

function onResize(e) {
  const rect = cardRef.value.getBoundingClientRect()
  let w = Math.max(200, e.clientX - rect.left)
  let h = Math.max(150, e.clientY - rect.top)

  w = Math.round(w / props.gridSize) * props.gridSize
  h = Math.round(h / props.gridSize) * props.gridSize

  customSize.value = { width: w, height: h }
}

function stopResize() {
  window.removeEventListener('mousemove', onResize)
  window.removeEventListener('mouseup', stopResize)
}

function addListeners() {
  window.addEventListener('mousemove', onDrag)
  window.addEventListener('mouseup', stopDrag)
}

function onDrag(event) {
  if (draggingTarget.value === 'chart') {
    chartPos.value = {
      x: event.clientX - dragOffset.value.x,
      y: event.clientY - dragOffset.value.y
    }
  }
}

function stopDrag(event) {
  if (draggingTarget.value === 'chart' && isFloating.value) {
    if (props.sidebarOpen && event.clientX > window.innerWidth - 360) dockChart()
    else {
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
  isFloating.value = false
  chartPos.value = null
  customSize.value = { width: null, height: null }
}

function captureChart() {
  const chartInstance = barRef.value?.chart
  if (!chartInstance) return

  const canvas = chartInstance.canvas
  const link = document.createElement('a')
  link.href = canvas.toDataURL("image/png")
  link.download = `Analysis_${props.title.replace(/\s+/g, '_')}.png`
  link.click()
}

onUnmounted(() => {
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', stopDrag)
})

defineExpose({
  getState: () => ({
    isFloating: isFloating.value,
    chartPos: chartPos.value,
    customSize: { ...customSize.value }
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
  position: relative;
  width: 100%;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(5px);
  display: flex;
  flex-direction: column;
  border-radius: 15px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.1);
  border: 1px solid rgba(0,0,0,0.1);
  margin-bottom: 20px;
  box-sizing: border-box;
  transition: width 0.15s ease-out, height 0.15s ease-out, left 0.15s ease-out, top 0.15s ease-out;
}
.chart-card.is-dragging { transition: width 0.15s ease-out, height 0.15s ease-out; }
.chart-card.is-floating { position: fixed; width: 280px; z-index: 1001; }
.chart-header { background: #f5f5f5; font-size: 0.65rem; font-weight: bold; padding: 6px; text-align: center; border-bottom: 1px solid #eee; text-transform: uppercase; color: #555; cursor: move; position: relative; display: flex; align-items: center; justify-content: center; border-top-left-radius: 15px; border-top-right-radius: 15px; }
.chart-body { padding: 15px; display: flex; flex-direction: column; flex-grow: 1; overflow: hidden; }
.chart-wrapper { flex-grow: 1; width: 100%; position: relative; }
.no-data { font-size: 0.7rem; color: #999; text-align: center; margin-top: 20px; }
.dock-btn, .snap-btn { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.05); border: 1px solid rgba(0,0,0,0.1); color: #333; width: 22px; height: 22px; border-radius: 50%; cursor: pointer; font-size: 1.2rem; padding: 0; display: flex; align-items: center; justify-content: center; transition: background 0.2s; }
.dock-btn { left: 10px; }
.snap-btn { right: 10px; font-size: 0.9rem; }
.dock-btn:hover, .snap-btn:hover { background: rgba(0,0,0,0.15); }
.resize-handle { position: absolute; bottom: 0; right: 0; width: 15px; height: 15px; cursor: nwse-resize; z-index: 10; }
.resize-handle::after { content: ''; position: absolute; bottom: 4px; right: 4px; width: 6px; height: 6px; border-right: 2px solid #ccc; border-bottom: 2px solid #ccc; }
</style>