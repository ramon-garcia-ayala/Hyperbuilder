//////////////////////////////////////////////////////////////////////////////////////////////////////////
// 1. TEMPLATE
//////////////////////////////////////////////////////////////////////////////////////////////////////////

<template>
  <!-- WELCOME SCREEN -->
  <WelcomeScreen :visible="showWelcome" @start="() => { showWelcome = false; sessionStorage.setItem('hb_visited', '1') }" />

  <!-- Main Layout Container -->
  <div class="main-container">
    <!-- MOBILE BACKDROP: Closes sidebar when tapping outside -->
    <div v-if="isMobilePanelOpen" class="mobile-overlay" @click="isMobilePanelOpen = false"></div>

    <!-- LEFT SIDEBAR: Contains all inputs (Sliders, Tables) for the parametric model -->
    <div id="sidebar" :class="{ open: isMobilePanelOpen }">
      
      <div class="logo-section">
        <img :src="logo" alt="HyperBuilder" class="app-logo" />
        <p class="app-description">
          Welcome to <strong>HyperBuilder</strong>. Configure your vertical communities dynamically using the parameters below. Have fun!
        </p>
      </div>
      <hr />

      <!-- CONTROLES DE PUNTOS BASE (Project Grid) -->
      <BasePointsControl 
        v-model="buildingPoints" 
        @clear-points="handleClearPoints"
        @edit-mode-changed="isEditModeActive = $event"
      />
      
      <!-- ALERTA DE COLISIONES -->
      <div v-if="activeCollisions.length > 0" class="collision-alert">
        <span>⚠️ Collisions Detected</span>
        <button class="resolve-btn" @click="resolveCollisions">Resolve</button>
      </div>
      <hr />

      <!-- SITE CONTEXT UPLOAD -->
      <ContextImport 
        @load-context="handleLoadContext" 
        @clear-context="handleClearContext" 
        @toggle-edit-context="isContextEditMode = $event"
      />
      <hr />

      <!-- TOWER SELECTION TABS -->
      <div v-if="buildingPoints.length > 0">
        <div class="tower-tabs">
          <button 
            v-for="(pt, index) in buildingPoints" 
            :key="index"
            class="tab-btn"
            :class="{ active: activeTowerIndex === index }"
            :style="{ borderBottomColor: activeTowerIndex === index ? palette[index % palette.length] : 'transparent' }"
            @click="activeTowerIndex = index"
          >
            {{ globalTowerNames[index] || `Tower ${index + 1}` }}
          </button>
        </div>

        <!-- PARAMETERS FOR ACTIVE TOWER -->
        <div class="active-tower-params">
          <!-- PER-TOWER PROGRAM LIST -->
          <div class="program-section" style="margin-top: 15px;">
            <div class="header-row">
              <p class="table-title" style="margin:0">PROGRAMS ({{ buildingPoints[activeTowerIndex].program.length }})</p>
              <div class="program-actions">
                <button class="randomize-btn" @click="randomizeActiveTower" title="Randomize Values">🎲</button>
                <button class="add-program-btn" @click="addProgramToActive" title="Add Program">+</button>
              </div>
            </div>
            
            <div v-for="(val, pIndex) in buildingPoints[activeTowerIndex].program" :key="pIndex" class="program-row">
              <SliderInput
                :ref="el => setSliderRef(el, pIndex)"
                :title="globalProgramNames[pIndex] || `Prog ${pIndex + 1}`"
                :editableTitle="true"
                :min="1" :max="10" :step="1"
                :modelValue="val"
                :color="palette[pIndex % palette.length]"
                @update="(v) => updateActiveProgramValue(pIndex, v)" 
                @update-title="(name) => handleUpdateProgramName({ index: pIndex, name })"
              />
              <button v-if="buildingPoints[activeTowerIndex].program.length > 1" class="remove-program-btn" @click="removeProgramFromActive(pIndex)">×</button>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="no-tower-msg">
        Add a point to the grid to configure a tower.
      </div>
    </div>

    <!-- VIEWER AREA: The 3D window and floating controls -->
    <div id="viewer-wrapper">
      <div id="viewer">
        <!-- Retícula y Pantalla de Edición -->
        <div class="grid-overlay" :class="{ 'edit-mode-active': isEditModeActive }" :style="gridStyle"></div>

        <GeometryView 
          ref="geometryViewRef"
          :data="computeData" 
          :path="path" 
          backgroundColor="#ffffff" 
          highlightColor="#666633"
          :points="buildingPoints"
          :colors="geometryColors"
          :editMode="isEditModeActive"
          :editContextMode="isContextEditMode"
          :activeTowerIndex="activeTowerIndex"
          @updateMetadata="receiveMetadata"
          @selectObject="handleObjectSelection"
          @geometry-updated="handleGeometryUpdate"
          @collisions-detected="handleCollisions"
          @update-point="handleUpdatePoint"
          @select-tower="handleSelectTower"
          @transform-mode-changed="handleTransformModeChanged"
        />
        
        <!-- EXPORT BUTTONS: 3D Model, CAD (DXF), Image (PNG) -->
        <div class="export-controls-container">
          <ModelExport :target="geometryViewRef" />
          <DxfExport :target="geometryViewRef" />
          <PngExport />
        </div>

        <!-- TRANSFORM CONTROLS (Move, Rotate, Scale) -->
        <div class="transform-controls-container" v-show="isEditModeActive || isContextEditMode">
          <button class="viewport-btn" :class="{ active: activeTransformMode === 'translate' }" @click="setTransformMode('translate')" title="Translate / Move">MOVE (T)</button>
          <button class="viewport-btn" :class="{ active: activeTransformMode === 'rotate' }" @click="setTransformMode('rotate')" title="Rotate">ROTATE (R)</button>
          <button class="viewport-btn" :class="{ active: activeTransformMode === 'scale' }" @click="setTransformMode('scale')" title="Scale">SCALE (S)</button>
        </div>
        
        <!-- FLOATING WIDGETS: ViewCube, Display Modes, Layers -->
        <ViewCube :target="geometryViewRef" :gridSize="gridSettings.size" />
        <DisplayModes :target="geometryViewRef" :gridSize="gridSettings.size" />
        <ViewportLayers 
          :target="geometryViewRef" 
          @toggle-lines="handleToggleLines"
          @toggle-shadow="handleToggleShadow"
          :gridSize="gridSettings.size"
          v-model:showGrid="gridSettings.visible"
          v-model:gridSize="gridSettings.size"
        />
        
        <!-- UNDO / REDO CONTROLS -->
        <div class="undo-redo-container">
          <button class="undo-btn" @click="undo" :disabled="historyIndex <= 0" title="Undo (Ctrl+Z)">↶</button>
          <button class="redo-btn" @click="redo" :disabled="historyIndex >= historyStack.length - 1" title="Redo (Ctrl+Y)">↷</button>
        </div>

        <!-- INFO CARDS: Generated dynamically when clicking 3D objects -->
        <ObjectInfoCard 
          v-for="card in selectedObjects"
          :key="card.id"
          :data="card.data" 
          :initialPosition="card.position"
          :hitPoint="card.hitPoint"
          :size="cardSharedSize"
          :zIndex="card.zIndex"
          :gridSize="gridSettings.size"
          :showLines="areInfoLinesVisible"
          :viewRef="geometryViewRef"
          @close="removeCard(card.id)"
          @update-size="updateSharedSize"
          @update-hit-point="updateCardHitPoint"
          @update-position="updateCardPosition"
          @bring-to-front="bringCardToFront"
        />
        
        <!-- VERSION HISTORY: Bottom bar to save/restore design states -->
        <VersionHistory
          ref="versionHistoryRef"
          :getData="collectVersionData"
          @restoreVersion="restoreState"
          @visibilityChanged="handleHistoryVisibility"
        />

        <!-- MOBILE FAB: Toggle parameters sidebar (visible only on mobile) -->
        <div class="mobile-fab">
          <button class="mobile-fab-history" @click="versionHistoryRef?.toggle()" title="Version History">
            ⏱
          </button>
          <button class="mobile-fab-params" @click="isMobilePanelOpen = !isMobilePanelOpen">
            {{ isMobilePanelOpen ? '✕  CLOSE' : '☰  PARAMETERS' }}
          </button>
        </div>
      </div>
    </div>

    <!-- RIGHT SIDEBAR: Analytics Charts (Collapsible) -->
    <AnalyticsSidebar class="right-sidebar" @visibility-changed="handleAnalyticsVisibility" @clear-cards="clearAllCards">
      <!-- GLOBAL COLOR MODE CONTROLS -->
      <div class="color-mode-section" style="margin-bottom: 20px;">
        <p class="table-title" style="margin-top:0">COLOR MODE</p>
        <div class="mode-buttons">
          <button :class="{ active: colorMode === 'program' }" @click="colorMode = 'program'">
            By Program
          </button>
          <button :class="{ active: colorMode === 'tower' }" @click="colorMode = 'tower'">
            By Tower
          </button>
        </div>
      </div>

      <ChartOverlay 
          ref="chartOverlayRef"
          title="Area Analysis"
          :labels="chartLabels"
          :values="chartValues"
          :colors="geometryColors"
          :colorMode="colorMode"
          :points="buildingPoints"
          :programNames="globalProgramNames"
          :towerNames="globalTowerNames"
          @update-program-name="handleUpdateProgramName"
          @update-tower-name="handleUpdateTowerName"
          :gridSize="gridSettings.size"
          :sidebarOpen="isAnalyticsVisible"
        />
      <TowerBarChart 
          ref="towerBarChartRef"
          title="Tower Distributions"
          :points="buildingPoints"
          :colorMode="colorMode"
          :palette="palette"
          :programNames="globalProgramNames"
          :towerNames="globalTowerNames"
          :gridSize="gridSettings.size"
          :sidebarOpen="isAnalyticsVisible"
        />
    </AnalyticsSidebar>
  </div>
</template>

//////////////////////////////////////////////////////////////////////////////////////////////////////////
// 2. SCRIPT SETUP
//////////////////////////////////////////////////////////////////////////////////////////////////////////

<script setup>
import { ref, computed } from 'vue'
import GeometryView from './components/GeometryView.vue'
import SliderInput from './components/SliderInput.vue'
import ChartOverlay from './components/ChartOverlay.vue' // IMPORTAR NUEVO COMPONENTE
import TowerBarChart from './components/TowerBarChart.vue' // IMPORTAR GRÁFICO DE BARRAS
import VersionHistory from './components/VersionHistory.vue' // IMPORTAR HISTORIAL
import DxfExport from './components/DxfExport.vue'
import PngExport from './components/PngExport.vue'
import BasePointsControl from './components/BasePointsControl.vue' // IMPORTAR NUEVO COMPONENTE DE PUNTOS
import ModelExport from './components/ModelExport.vue'
import ViewCube from './components/ViewCube.vue' // IMPORTAR VIEWCUBE
import ContextImport from './components/ContextImport.vue' // IMPORTAR COMPONENTE DE CONTEXTO
import DisplayModes from './components/DisplayModes.vue' // IMPORTAR DISPLAY MODES
import ViewportLayers from './components/ViewportLayers.vue' // IMPORTAR LAYERS
import ObjectInfoCard from './components/ObjectInfoCard.vue' // IMPORTAR TARJETA DE INFO
import AnalyticsSidebar from './components/AnalyticsSidebar.vue'
import WelcomeScreen from './components/WelcomeScreen.vue'
import def3 from '@/assets/HB01-Program_Aggregation_DM.gh'
import def4 from '@/assets/V2.0.0_Hyper-builder_Script.gh'
import def0 from '@/assets/Test.gh'
import logo from './assets/HB_Logo_01.png'

// --- DATA STRUCTURES ---
// Reactive objects to store the inputs for Towers and Podium.
const colorMode = ref('program') // Estado para el modo de color: 'tower' | 'program'
const activeTowerIndex = ref(0) // Índice de la torre que estamos editando actualmente
const isEditModeActive = ref(false) // Mantiene el estado del modo de edición del grid
const isContextEditMode = ref(false) // Estado para el modo edición de contexto
const isMobilePanelOpen = ref(false) // Controla el bottom sheet de parámetros en móvil
const showWelcome = ref(!sessionStorage.getItem('hb_visited')) // Solo la primera vez por sesión

const programSliders = ref([]) // Referencias a los componentes SliderInput
function setSliderRef(el, index) {
  if (el) {
    programSliders.value[index] = el
  }
}

// --- GUMBALL TRANSFORM MODE ---
const activeTransformMode = ref('translate')
function setTransformMode(mode) {
  activeTransformMode.value = mode
  if (geometryViewRef.value) geometryViewRef.value.setTransformMode(mode)
}
function handleTransformModeChanged(mode) {
  activeTransformMode.value = mode
}

// --- CONTEXT IMPORT HANDLERS ---
function handleLoadContext(buffer) {
  if (geometryViewRef.value) {
    geometryViewRef.value.loadContextFromBuffer(buffer)
  }
}
function handleClearContext() {
  if (geometryViewRef.value) {
    geometryViewRef.value.clearContext()
  }
}

// --- COLLISIONS STATE ---
const activeCollisions = ref([])

function handleCollisions(pairs) {
  activeCollisions.value = pairs
}

function resolveCollisions() {
  if (activeCollisions.value.length === 0) return;
  
  const newPoints = JSON.parse(JSON.stringify(buildingPoints.value));
  let changed = false;
  
  activeCollisions.value.forEach(col => {
    const p1 = newPoints[col.t1];
    const p2 = newPoints[col.t2];
    if (!p1 || !p2) return;
    
    // Calculamos el solapamiento usando las cajas perimetrales en los ejes de planta (X y Z del Mundo 3D)
    const overlapX = Math.min(col.box1.max.x, col.box2.max.x) - Math.max(col.box1.min.x, col.box2.min.x);
    const overlapZ = Math.min(col.box1.max.z, col.box2.max.z) - Math.max(col.box1.min.z, col.box2.min.z);

    if (overlapX > 0 && overlapZ > 0) {
      changed = true;
      
      let dx = p2.x - p1.x;
      let dy = p2.y - p1.y;
      
      let dist = Math.sqrt(dx * dx + dy * dy);
      if (dist === 0) { dx = 1; dy = 0; dist = 1; } // Prevención si están en el mismo centro exacto
      
      // Empujamos en la dirección contraria con un poco de margen (+1 metro)
      const pushDist = Math.max(overlapX, overlapZ) + 1.0;
      
      p2.x += (dx / dist) * pushDist;
      p2.y += (dy / dist) * pushDist;
    }
  });
  
  if (changed) {
    buildingPoints.value = newPoints;
    activeCollisions.value = []; // Se limpia temporalmente hasta que se redibuje el modelo
  }
}

// --- GLOBAL NAMES ---
const globalProgramNames = ref([
  'Prog 1', 'Prog 2', 'Prog 3', 'Prog 4', 'Prog 5', 'Prog 6', 'Prog 7', 'Prog 8'
])
const globalTowerNames = ref([])

function handleUpdateProgramName({ index, name }) {
  globalProgramNames.value[index] = name
}
function handleUpdateTowerName({ index, name }) {
  globalTowerNames.value[index] = name
}

// --- COMPUTED COLORS ---
// Genera los colores dinámicamente basándose en los inputs y el modo seleccionado
const geometryColors = computed(() => {
  const colors = []
  
  // Iteramos sobre cada torre REAL
  buildingPoints.value.forEach((tower, tIndex) => {
    const numPrograms = tower.program.length
    const colorForTower = palette[tIndex % palette.length]

    if (colorMode.value === 'tower') {
      // Modo Torre: Todos los segmentos de esta torre tienen el mismo color
      for (let p = 0; p < numPrograms; p++) {
        colors.push(colorForTower);
      }
    } else {
      // Modo Programa: Usamos la paleta secuencialmente para los segmentos de esta torre
      for (let p = 0; p < numPrograms; p++) {
        colors.push(palette[p % palette.length])
      }
    }
  })
  
  return colors
})

// --- POINTS STATE (Manual) ---
// Inicializamos con datos completos por defecto
const buildingPoints = ref([
  { x: 0, y: 0, z: 0, floorHeight: 3, program: [2, 2, 2, 2], rotation: 0, scaleX: 1, scaleY: 1, scaleZ: 1 }
])

let previousPointsLength = buildingPoints.value.length

// GARANTIZAR PUNTO POR DEFECTO: Si la lista se vacía, añadir uno en 0,0,0
import { watch } from 'vue'
watch(buildingPoints, (newVal) => {
  if (newVal.length === 0) {
    // Si se borran todos, agregamos uno nuevo por defecto
    buildingPoints.value = [{ x: 0, y: 0, z: 0, floorHeight: 3, program: [2, 2, 2, 2], rotation: 0, scaleX: 1, scaleY: 1, scaleZ: 1 }]
    activeTowerIndex.value = 0
    previousPointsLength = 1
  } else {
    // INICIALIZACIÓN DE NUEVOS PUNTOS:
    // Si se agrega un punto desde BasePointsControl, vendrá sin props (solo x,y,z).
    // Le inyectamos los valores por defecto aquí.
    // NOTA: BasePointsControl ahora intenta enviarlos, pero mantenemos esto por seguridad
    // y para restaurar versiones antiguas que no tengan estos campos.
    newVal.forEach(pt => {
      if (pt.floorHeight === undefined) pt.floorHeight = 3
      if (pt.program === undefined) pt.program = [2, 2, 2, 2]
      if (pt.rotation === undefined) pt.rotation = 0
      if (pt.scaleX === undefined) pt.scaleX = pt.scale !== undefined ? pt.scale : 1
      if (pt.scaleY === undefined) pt.scaleY = pt.scale !== undefined ? pt.scale : 1
      if (pt.scaleZ === undefined) pt.scaleZ = pt.scale !== undefined ? pt.scale : 1
    })
    
    // Saltar automáticamente a la torre correcta si cambia la cantidad
    if (newVal.length > previousPointsLength) {
      activeTowerIndex.value = newVal.length - 1 // Salta a la recién creada
    } else if (newVal.length < previousPointsLength) {
      activeTowerIndex.value = newVal.length - 1 // Vuelve a la última al borrar
    } else {
      // Si no cambió la cantidad (ej: arrastrando punto), solo asegurar que el índice sea válido
      if (activeTowerIndex.value >= newVal.length) {
        activeTowerIndex.value = Math.max(0, newVal.length - 1)
      }
    }
    previousPointsLength = newVal.length
  }
}, { deep: true })

function handleClearPoints() {
  if (geometryViewRef.value) {
    geometryViewRef.value.resetCameraView(false)
  }
}

// Path to the Grasshopper definition
const path = def4
const metadata = ref('')
// Chart data variables
const chartLabels = ref([])
const chartValues = ref([])

// Component References (to access their methods)
const geometryViewRef = ref(null)
const chartOverlayRef = ref(null)
const towerBarChartRef = ref(null)
const versionHistoryRef = ref(null)

const isAnalyticsVisible = ref(true)
function handleAnalyticsVisibility(visible) {
  isAnalyticsVisible.value = visible
  // Ya no es necesario forzar el 'resize'.
  // El ResizeObserver en GeometryView.vue lo detectará automáticamente.
}

const isHistoryVisible = ref(false)
function handleHistoryVisibility(visible) {
  isHistoryVisible.value = visible
}

// Grid Settings (passed to layers and helpers)
const gridSettings = ref({
  size: 20,
  visible: false
})

// --- SELECTION & INFO CARDS LOGIC ---
const selectedObjects = ref([])
const cardSharedSize = ref(null) // Tamaño inicial compartido (null para auto-ajuste)
const highestZIndex = ref(2000) // Z-index inicial para las tarjetas
import { nextTick, onMounted, onUnmounted } from 'vue'

// Handle click events from the 3D Viewer
function handleObjectSelection(event) {
  if (event) {
    // Verificamos si ya existe una tarjeta para este objeto
    const existing = selectedObjects.value.find(obj => obj.id === event.data.ID)
    if (!existing) {
      selectedObjects.value.push({
        id: event.data.ID,
        data: event.data,
        position: { x: event.x + 15, y: event.y + 15 },
        hitPoint: event.hitPoint,
        zIndex: highestZIndex.value++ // Asignar y aumentar el z-index
      })
      nextTick(() => layoutCards())
    } else {
      // Si existe, actualizamos solo el punto de impacto (línea) y datos, pero no la posición
      existing.hitPoint = event.hitPoint
      existing.data = event.data
      // Bring card to front
      bringCardToFront({ id: existing.id })
    }
  }
}

function bringCardToFront({ id }) {
  const card = selectedObjects.value.find(c => c.id === id)
  if (card) {
    card.zIndex = highestZIndex.value++
  }
}

function updateCardPosition({ id, position }) {
  const card = selectedObjects.value.find(c => c.id === id)
  if (card) {
    card.position = position
  }
}

function removeCard(id) {
  selectedObjects.value = selectedObjects.value.filter(c => c.id !== id)
}

function clearAllCards() {
  selectedObjects.value = []
  if (chartOverlayRef.value) {
    chartOverlayRef.value.setState({
      isFloating: false,
      chartPos: null,
      customSize: { width: null, height: null }
    })
  }
  if (towerBarChartRef.value) {
    towerBarChartRef.value.setState({
      isFloating: false,
      chartPos: null,
      customSize: { width: null, height: null }
    })
  }
}

// Update size for all cards (if one resizes, others might adapt if we wanted to enforce uniformity)
function updateSharedSize(newSize) {
  cardSharedSize.value = newSize
  nextTick(() => {
    layoutCards()
  })
}

// Simple collision detection algorithm to prevent cards from overlapping perfectly
function layoutCards() {
  const cards = selectedObjects.value
  if (cards.length < 2) return

  const size = cardSharedSize.value || { width: 220, height: 300 }
  const margin = 10
  let overlapsFound
  let iterations = 0
  const maxIterations = cards.length * cards.length

  do {
    overlapsFound = false
    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        const cardA = cards[i]
        const cardB = cards[j]

        const rectA = { x: cardA.position.x, y: cardA.position.y, w: size.width, h: size.height }
        const rectB = { x: cardB.position.x, y: cardB.position.y, w: size.width, h: size.height }

        const overlapX = Math.max(0, Math.min(rectA.x + rectA.w, rectB.x + rectB.w) - Math.max(rectA.x, rectB.x))
        const overlapY = Math.max(0, Math.min(rectA.y + rectA.h, rectB.y + rectB.h) - Math.max(rectA.y, rectB.y))

        if (overlapX > 0 && overlapY > 0) {
          overlapsFound = true
          const pushDirectionX = rectA.x < rectB.x ? 1 : -1
          const pushDirectionY = rectA.y < rectB.y ? 1 : -1

          // Push in the direction of smaller overlap to resolve collision
          if (overlapX < overlapY) {
            cardB.position.x += pushDirectionX * (overlapX + margin)
          } else {
            cardB.position.y += pushDirectionY * (overlapY + margin)
          }
        }
      }
    }
    iterations++
  } while (overlapsFound && iterations < maxIterations)

  // Final boundary check for all cards after layout
  cards.forEach(card => {
    const cardWidth = cardSharedSize.value?.width || 220
    const cardHeight = cardSharedSize.value?.height || 300
    card.position.x = Math.max(20, Math.min(card.position.x, window.innerWidth - cardWidth - 20))
    card.position.y = Math.max(20, Math.min(card.position.y, window.innerHeight - cardHeight - 20))
  })
}

function updateCardHitPoint({ id, point }) {
  const card = selectedObjects.value.find(c => c.id === id)
  if (card) {
    card.hitPoint = point
  }
}

function handleGeometryUpdate() {
  if (!geometryViewRef.value) return
  
  // Verificamos y actualizamos cada tarjeta abierta
  for (let i = selectedObjects.value.length - 1; i >= 0; i--) {
    const card = selectedObjects.value[i]
    const newData = geometryViewRef.value.getMeshData(card.id)
    if (newData) {
      // Actualizar información (Area, Height, etc) y reconectar la línea al nuevo centro
      card.data = newData.data
      card.hitPoint = newData.hitPoint
    } else {
      // Si eliminaste una torre/programa, cerramos la tarjeta huérfana automáticamente
      selectedObjects.value.splice(i, 1)
    }
  }
}

const areInfoLinesVisible = ref(true)
function handleToggleLines(visible) {
  areInfoLinesVisible.value = visible
}

function handleToggleShadow(visible) {
  if (geometryViewRef.value) {
    geometryViewRef.value.toggleShadow(visible)
  }
}

// --- ACTIVE TOWER LOGIC ---

function updateActiveTowerParam(key, value) {
  if (buildingPoints.value[activeTowerIndex.value]) {
    buildingPoints.value[activeTowerIndex.value][key] = value
  }
}

function updateActiveProgramValue(pIndex, value) {
  buildingPoints.value[activeTowerIndex.value].program[pIndex] = value
}

function addProgramToActive() {
  buildingPoints.value[activeTowerIndex.value].program.push(2)
}

function removeProgramFromActive(pIndex) {
  buildingPoints.value[activeTowerIndex.value].program.splice(pIndex, 1)
  programSliders.value.splice(pIndex, 1)
}

function randomizeActiveTower() {
  const tower = buildingPoints.value[activeTowerIndex.value]
  if (tower && tower.program) {
    tower.program = tower.program.map((_, i) => {
      const max = programSliders.value[i] && programSliders.value[i].localMax ? programSliders.value[i].localMax : 10
      return Math.floor(Math.random() * max) + 1
    })
    if (geometryViewRef.value) geometryViewRef.value.resetCameraView(false)
  }
}

// --- VIEWPORT POINT MANIPULATION ---
function handleUpdatePoint(index, newPos) {
  if (buildingPoints.value[index]) {
    buildingPoints.value[index].x = newPos.x
    buildingPoints.value[index].y = newPos.y
    buildingPoints.value[index].z = newPos.z !== undefined ? newPos.z : 0
    buildingPoints.value[index].rotation = newPos.rotation !== undefined ? newPos.rotation : 0
    buildingPoints.value[index].scaleX = newPos.scaleX !== undefined ? newPos.scaleX : 1
    buildingPoints.value[index].scaleY = newPos.scaleY !== undefined ? newPos.scaleY : 1
    buildingPoints.value[index].scaleZ = newPos.scaleZ !== undefined ? newPos.scaleZ : 1
  }
}

function handleSelectTower(index) {
  activeTowerIndex.value = index
}

// --- UNDO / REDO LOGIC ---
const historyStack = ref([])
const historyIndex = ref(-1)
const isUndoing = ref(false)
let historyTimeout = null

onMounted(() => {
  historyStack.value.push(JSON.parse(JSON.stringify(buildingPoints.value)))
  historyIndex.value = 0
  window.addEventListener('keydown', handleGlobalKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeyDown)
})

watch(buildingPoints, (newVal) => {
  if (isUndoing.value) {
    isUndoing.value = false
    return
  }
  clearTimeout(historyTimeout)
  historyTimeout = setTimeout(() => {
    const snapshot = JSON.parse(JSON.stringify(newVal))
    if (historyIndex.value < historyStack.value.length - 1) {
      historyStack.value = historyStack.value.slice(0, historyIndex.value + 1)
    }
    const lastSnapshot = historyStack.value[historyStack.value.length - 1]
    if (JSON.stringify(lastSnapshot) !== JSON.stringify(snapshot)) {
      historyStack.value.push(snapshot)
      if (historyStack.value.length > 50) historyStack.value.shift() // Límite de 50 pasos
      else historyIndex.value++
    }
  }, 300) // Retraso de 300ms para no guardar cada frame al deslizar un slider
}, { deep: true })

function undo() {
  if (historyIndex.value > 0) {
    historyIndex.value--
    isUndoing.value = true
    buildingPoints.value = JSON.parse(JSON.stringify(historyStack.value[historyIndex.value]))
  }
}

function redo() {
  if (historyIndex.value < historyStack.value.length - 1) {
    historyIndex.value++
    isUndoing.value = true
    buildingPoints.value = JSON.parse(JSON.stringify(historyStack.value[historyIndex.value]))
  }
}

function handleGlobalKeyDown(e) {
  // Ignorar si estamos escribiendo en un input
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
  
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault()
    if (e.shiftKey) redo()
    else undo()
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
    e.preventDefault()
    redo()
  }
}

// --- RHINO COMPUTE RESPONSE HANDLER ---
// Parses the metadata returned by Grasshopper to update charts
function receiveMetadata(newMetadata) {
  // Limpiamos datos anteriores
  chartLabels.value = []
  chartValues.value = []

  if(newMetadata) {
    console.log("Metadata recibida:", newMetadata)
    metadata.value = newMetadata[0]

    // PARSING LOGIC:
    // 1. Find all data with name "FloorAreas"
    const areaItems = newMetadata.filter(item => item.name === "FloorAreas")
    // 2. Find custom labels "FloorLabels"
    const labelItems = newMetadata.filter(item => item.name === "FloorLabels")
    
    if (areaItems.length > 0) {
      let values = []
      
      // If multiple items, it's a Grasshopper list
      if (areaItems.length > 1) {
        values = areaItems.map(item => Number(item.value))
      } 
      // If single item, check if it's a JSON array or single number
      else {
        const val = areaItems[0].value
        values = Array.isArray(val) ? val : [Number(val)]
      }

      console.log("✅ Datos procesados para gráfico:", values)
      
      chartValues.value = values.map(v => Number(v))

      // PROCESS LABELS
      let labels = []
      if (labelItems.length > 0) {
        if (labelItems.length > 1) {
          labels = labelItems.map(item => String(item.value))
        } else {
          const val = labelItems[0].value
          labels = Array.isArray(val) ? val : [String(val)]
        }
      }

      // Si encontramos etiquetas y coinciden en cantidad, las usamos. Si no, generamos default.
      if (labels.length === values.length) {
        console.log("✅ Etiquetas encontradas:", labels)
        chartLabels.value = labels
      } else {
        // Fallback: Generamos etiquetas automáticas (Lvl 1, Lvl 2...)
        chartLabels.value = values.map((_, index) => `Lvl ${index + 1}`)
      }
    } 
    else {
      // Si no encuentra los datos, te avisa en la consola qué nombres sí llegaron
      console.warn("⚠️ No encontré 'FloorAreas'. Nombres recibidos:", newMetadata.map(m => m.name))
      
      // Opcional: Si quieres graficar datos de prueba si falla GH, descomenta esto:
      // chartValues.value = [100, 200, 150, 300]; chartLabels.value = ["Test A", "Test B", "Test C", "Test D"];
    }
  }
}

// Paleta de colores de alto contraste (movida fuera para uso global)
const palette = [
  '#f2dd1c', // UI Yellow
  '#2847fc', // UI Blue
  '#e6194B', // Red
  '#3cb44b', // Green
  '#f58231', // Orange
  '#911eb4', // Purple
  '#42d4f4', // Cyan
  '#f032e6', // Magenta
];

// --- STATE RESTORATION ---
// Restores the app state from a saved version (History)
function restoreState(savedData) {
  if (!savedData) return
  console.log("Restaurando versión...", savedData)

  // Compatibility check: simple GH data vs full UI state
  const ghData = savedData.ghInputs || savedData

  // 4. Restore UI State (Cards, Charts, Camera)
  if (savedData.uiState) {
    // Restaurar tarjetas de información
    selectedObjects.value = savedData.uiState.selectedObjects || []
    
    // Restaurar posición del gráfico
    if (chartOverlayRef.value && savedData.uiState.chartState) {
      chartOverlayRef.value.setState(savedData.uiState.chartState)
    }
    
    // Restaurar posición gráfico de barras
    if (towerBarChartRef.value && savedData.uiState.towerBarChartState) {
      towerBarChartRef.value.setState(savedData.uiState.towerBarChartState)
    }
    
    // Restaurar CÁMARA
    if (geometryViewRef.value && savedData.uiState.cameraState) {
      geometryViewRef.value.setCameraState(savedData.uiState.cameraState)
    }

    // 5. Restaurar Puntos
    if (savedData.uiState.buildingPoints) {
      buildingPoints.value = savedData.uiState.buildingPoints
    }
    
    // Restaurar Nombres Personalizados
    if (savedData.uiState.globalProgramNames) {
      globalProgramNames.value = savedData.uiState.globalProgramNames
    }
    if (savedData.uiState.globalTowerNames) {
      globalTowerNames.value = savedData.uiState.globalTowerNames
    }

  } else {
    // Si la versión no tenía estado UI guardado, limpiamos por seguridad
    selectedObjects.value = []
    if (chartOverlayRef.value) {
      chartOverlayRef.value.setState({ isFloating: false, chartPos: null, customSize: { width: null, height: null } })
    }
    if (towerBarChartRef.value) {
      towerBarChartRef.value.setState({ isFloating: false, chartPos: null, customSize: { width: null, height: null } })
    }
  }
}

// Computed style for the background grid pattern
const gridStyle = computed(() => {
  // Mostrar si está encendida en los layers O si estamos en modo edición
  if (!gridSettings.value.visible && !isEditModeActive.value) return {}
  return {
    backgroundPosition: '-1px -1px', // Alinea la retícula perfectamente con los bordes
    backgroundSize: `${gridSettings.value.size}px ${gridSettings.value.size}px`,
    backgroundImage: `
      radial-gradient(circle at 1px 1px, rgba(0,0,0,0.15) 1px, transparent 1px)
    `
  }
})

// --- COMPUTE DATA PREPARATION ---
const computeData = computed(() => {
  const programTree = []
  const floorTree = []
  const segmentsTree = []
  const pointsTree = []
  const rotationTree = []
  const scaleTree = []

  buildingPoints.value.forEach((pt, i) => {
    const path = `{0;${i}}` 

    // TRUCO MAESTRO: Convertimos TODOS los números a Texto (String)
    // Grasshopper los recibirá y los convertirá de vuelta a números sin errores.
    
    // 1. Programas de la torre
    const progs = pt.program || [2]
    programTree.push({ path: path, data: progs.map(p => String(p)) })

    // 2. Altura de piso
    floorTree.push({ path: path, data: [String(pt.floorHeight || 3)] })
    
    // 3. Segmentos
    segmentsTree.push({ path: path, data: ["4"] })

    // 4. Puntos
    pointsTree.push({ path: path, data: [`${pt.x},${pt.y},${pt.z}`] })

    // 5. Rotation
    rotationTree.push({ path: path, data: [String(pt.rotation || 0)] })
    
    // 6. Scale
    scaleTree.push({ path: path, data: [`${pt.scaleX || 1},${pt.scaleY || 1},${pt.scaleZ || 1}`] })
  })

  return {
    'Tower_Program': programTree,
    'floor_height': floorTree,
    'tower_segments': segmentsTree,
    'Points': pointsTree,
    'Tower_Rotation': rotationTree,
    'Tower_Scale': scaleTree
  }
})

// --- COLLECT VERSION DATA ---
// Captures a snapshot of ALL current state (Inputs + UI + Camera)
function collectVersionData() {
  return {
    ghInputs: computeData.value,
    uiState: {
      buildingPoints: buildingPoints.value, // Guardar puntos en historial
      selectedObjects: selectedObjects.value,
      chartState: chartOverlayRef.value ? chartOverlayRef.value.getState() : null,
      towerBarChartState: towerBarChartRef.value ? towerBarChartRef.value.getState() : null,
      cameraState: geometryViewRef.value ? geometryViewRef.value.getCameraState() : null,
      globalProgramNames: globalProgramNames.value,
      globalTowerNames: globalTowerNames.value
    }
  }
}
</script>

//////////////////////////////////////////////////////////////////////////////////////////////////////////
// 3. STYLE
//////////////////////////////////////////////////////////////////////////////////////////////////////////

<style scoped>
.main-container {
  display: flex;
  width: 100%;
  height: 100%;
  background-color: #ffffff;
  color: #000000;
  transition: background-color 0.3s ease;
  overflow: hidden; /* FIX: Corta cualquier desbordamiento horizontal */
}

#viewer-wrapper {
  flex-grow: 1;
  position: relative;
  min-width: 0; /* FIX: Permite que el visor se encoja para dejar espacio a la barra */
}

#sidebar {
  width: 320px;
  padding: 25px;
  border-right: 1px solid rgba(0,0,0,0.05);
  overflow-y: auto; /* Adds scroll if content is too long */
  flex-shrink: 0; /* Evita que la barra se comprima cuando aparece la otra */
}

.right-sidebar {
  flex-shrink: 0; /* Asegura que la barra de analytics no se aplaste */
}

#viewer {
  /* FIX: Restamos los 40px totales de margen (20 izq + 20 der / 20 arriba + 20 abajo) para evitar scroll */
  width: calc(100% - 40px); height: calc(100% - 40px);
  margin: 20px;
  border-radius: 30px;
  overflow: hidden;
  position: relative; /* IMPORTANTE: Para que el ChartOverlay se posicione absoluto respecto a esto */
  box-shadow: 0 15px 45px rgba(0,0,0,0.05);
  background-color: #eee; /* Light gray until Three.js loads */
}

.grid-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1; /* Detrás de los widgets flotantes */
  border-radius: 30px; /* Igualar al radio del contenedor para que la sombra siga la curva */
  box-sizing: border-box;
  transition: background-color 0.3s ease, box-shadow 0.3s ease;
}

.grid-overlay.edit-mode-active {
  background-color: rgba(40, 71, 252, 0.08); /* Filtro azul sutil sobre el 3D */
  box-shadow: inset 0 0 0 4px rgba(40, 71, 252, 0.5); /* Marco perimetral azul curvo */
}

/* 2. TABLES & GRIDS */
.table-title {
  font-family: "Roboto Mono", monospace;
  font-size: 0.7rem;
  font-weight: bold;
  margin: 15px 0 10px 0;
  letter-spacing: 1px;
  opacity: 0.6;
}

.tower-grid {
  display: grid;
  grid-template-columns: 70px 1fr 1fr 1fr;
  gap: 5px;
  align-items: center;
  margin-bottom: 20px;
}

.podium-grid {
  display: grid;
  grid-template-columns: 90px 1fr 1fr;
  gap: 5px;
  align-items: center;
}

.grid-header {
  font-family: "Roboto Mono", monospace;
  font-size: 0.65rem;
  font-weight: bold;
  opacity: 0.4;
}

.center { text-align: center; }

.row-label {
  font-size: 0.6rem;
  font-weight: 600;
  text-transform: uppercase;
}

.row-label.small { 
  font-size: 0.6rem; 
  font-weight: 600;
  text-transform: uppercase; }

.mini-input {
  width: 100%;
  border: 1px solid rgba(0,0,0,0.08);
  background: rgba(0,0,0,0.02);
  border-radius: 4px;
  padding: 3px;
  text-align: center;
  font-size: 0.8rem;
}

hr {
  margin: 20px 0;
  border: 0;
  border-top: 1px solid rgba(0,0,0,0.05);
}

.export-controls-container {
  position: absolute;
  top: 20px;
  right: 20px;
  display: flex;
  width: 130px; /* Mismo ancho que ViewCube */
  justify-content: space-between;
  gap: 5px;
  z-index: 95;
}

.transform-controls-container {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
  z-index: 95;
}

.viewport-btn {
  background: white; color: black;
  border: 1px solid rgba(0,0,0,0.1); border-radius: 8px;
  padding: 8px 12px; cursor: pointer;
  font-family: 'Roboto Mono', monospace; font-size: 0.7rem; font-weight: bold;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08); transition: all 0.2s ease;
  letter-spacing: 0.5px;
}
.viewport-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 15px rgba(0,0,0,0.12);
  background: #f0f0f0;
}
.viewport-btn.active {
  background: #2847fc; /* IAAC Blue */
  color: white; border-color: #2847fc;
}

.undo-redo-container {
  position: absolute;
  top: 20px;
  left: 180px; /* Alineado justo al lado de la tarjeta de Layers */
  display: flex;
  gap: 6px;
  z-index: 95;
}

.undo-btn, .redo-btn {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(5px);
  border: 1px solid rgba(0,0,0,0.1);
  border-radius: 8px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1.1rem;
  color: #333;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  transition: all 0.2s ease;
}
.undo-btn:hover:not(:disabled), .redo-btn:hover:not(:disabled) {
  background: #f2dd1c; /* IAAC Yellow */
  transform: translateY(-2px);
}
.undo-btn:disabled, .redo-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.logo-section {
  text-align: left;
  margin-bottom: 15px;
}
.app-logo {
  max-width: 140px;
  height: auto;
  margin-bottom: 10px;
}
.app-description {
  font-size: 0.75rem;
  color: #555;
  line-height: 1.4;
  font-family: 'Roboto Mono', monospace;
}

/* --- COLLISIONS --- */
.collision-alert {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 0, 0, 0.05);
  border: 1px solid rgba(255, 0, 0, 0.2);
  padding: 8px 15px;
  border-radius: 8px;
  margin-top: 10px;
}
.collision-alert span {
  font-size: 0.65rem; font-weight: bold; color: #cc0000; font-family: 'Roboto Mono', monospace;
}
.resolve-btn {
  background: #cc0000; color: white; border: none; padding: 4px 10px;
  border-radius: 4px; font-size: 0.6rem; font-weight: bold; cursor: pointer;
  font-family: 'Roboto Mono', monospace; transition: background 0.2s;
}
.resolve-btn:hover { background: #aa0000; }

/* --- PROGRAM LIST STYLES --- */
.program-section {
  display: flex;
  flex-direction: column;
  gap: 0px;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
}

.program-row {
  display: flex;
  align-items: center;
  gap: 5px;
  position: relative;
}

.program-row .definition-input {
  flex-grow: 1; /* Slider ocupa el espacio */
}

.add-program-btn, .remove-program-btn {
  border: none; cursor: pointer; font-weight: bold;
  display: flex; align-items: center; justify-content: center;
}

.add-program-btn {
  background: #f2dd1c; color: black; width: 20px; height: 20px; border-radius: 4px; font-size: 1rem;
}
.remove-program-btn {
  background: transparent; color: #cc0000; font-size: 1.2rem; padding: 0 5px; margin-top: 4px;
}
.add-program-btn:hover { background: #e0cc1b; }
.remove-program-btn:hover { color: #ff0000; background: rgba(255,0,0,0.05); border-radius: 4px; }

.program-actions {
  display: flex; gap: 5px; align-items: center;
}
.randomize-btn {
  background: #f5f5f5; border: 1px solid rgba(0,0,0,0.1); color: #333; width: 20px; height: 20px; border-radius: 4px; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; transition: all 0.2s;
}
.randomize-btn:hover { background: #e0e0e0; border-color: #ccc; }

/* --- TOWER TABS --- */
.tower-tabs {
  display: flex;
  gap: 5px;
  overflow-x: auto;
  padding-bottom: 5px;
  margin-bottom: 15px;
  border-bottom: 1px solid #eee;
}

.tab-btn {
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  padding: 5px 8px;
  font-family: 'Roboto Mono', monospace;
  font-size: 0.65rem;
  font-weight: bold;
  cursor: pointer;
  white-space: nowrap;
  opacity: 0.5;
  transition: all 0.2s;
}

.tab-btn:hover { opacity: 0.8; background: rgba(0,0,0,0.02); }
.tab-btn.active { opacity: 1; color: black; }

/* --- NO TOWER MSG --- */
.no-tower-msg {
  font-size: 0.7rem; color: #999; text-align: center; padding: 20px 0; font-style: italic;
}

/* --- COLOR MODE BUTTONS --- */
.mode-buttons {
  display: flex;
  gap: 5px;
  margin-top: 5px;
}

.mode-buttons button {
  flex: 1;
  padding: 6px;
  border: 1px solid rgba(0,0,0,0.1);
  background: #f5f5f5;
  border-radius: 4px;
  font-family: 'Roboto Mono', monospace;
  font-size: 0.65rem;
  cursor: pointer;
  transition: all 0.2s;
}

.mode-buttons button.active {
  background: #2847fc;
  color: white;
  font-weight: bold;
  border-color: #2847fc;
}

.mode-buttons button:hover:not(.active) {
  background: #e0e0e0;
}

/* ─── MOBILE FAB (hidden on desktop) ─── */
.mobile-fab {
  display: none;
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 110;
  gap: 10px;
  align-items: center;
}
.mobile-fab-history {
  background: white;
  border: 1px solid rgba(0,0,0,0.12);
  border-radius: 50%;
  width: 44px;
  height: 44px;
  font-size: 1.2rem;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(0,0,0,0.15);
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.mobile-fab-history:hover { background: #f5f5f5; transform: translateY(-2px); }
.mobile-fab-params {
  background: white;
  border: 1px solid rgba(0,0,0,0.12);
  border-radius: 30px;
  height: 44px;
  padding: 0 18px;
  font-size: 0.75rem;
  font-family: 'Roboto Mono', monospace;
  font-weight: bold;
  letter-spacing: 0.5px;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(0,0,0,0.15);
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
}
.mobile-fab-params:hover { background: #f5f5f5; transform: translateY(-2px); }

/* ─── MOBILE OVERLAY BACKDROP (hidden on desktop) ─── */
.mobile-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.35);
  z-index: 499;
  backdrop-filter: blur(2px);
}

/* ─── MOBILE RESPONSIVE (≤768px) ─── */
@media (max-width: 768px) {
  /* El sidebar se convierte en un bottom sheet */
  #sidebar {
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    max-height: 70vh;
    z-index: 500;
    border-radius: 20px 20px 0 0;
    border-right: none;
    border-top: 1px solid rgba(0,0,0,0.08);
    box-shadow: 0 -10px 40px rgba(0,0,0,0.15);
    transform: translateY(101%);
    transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    padding: 20px 20px 40px 20px;
    background: white;
  }
  #sidebar.open {
    transform: translateY(0);
  }
  /* Drag handle visual */
  #sidebar::before {
    content: '';
    display: block;
    width: 40px;
    height: 4px;
    background: rgba(0,0,0,0.12);
    border-radius: 2px;
    margin: 0 auto 18px;
  }

  /* El viewer ocupa todo el espacio */
  #viewer-wrapper {
    width: 100%;
  }
  #viewer {
    width: calc(100% - 10px);
    height: calc(100% - 10px);
    margin: 5px;
    border-radius: 15px;
  }

  /* El sidebar de analytics no empuja el viewer */
  .right-sidebar {
    position: fixed;
    right: 0;
    top: 0;
    height: 100%;
    z-index: 400;
  }

  /* Mostrar FAB y backdrop en móvil */
  .mobile-fab { display: flex; align-items: center; }
  .mobile-overlay { display: block; }
}
</style>