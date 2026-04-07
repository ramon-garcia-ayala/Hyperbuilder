<template>
  <div class="building-params-card">
    <div class="card-header" @click="isOpen = !isOpen">
      <div class="header-left">
        <div class="color-indicator" :style="{ backgroundColor: color }"></div>
        <span class="building-title">BUILDING {{ index + 1 }}</span>
      </div>
      <span class="toggle-icon">{{ isOpen ? '▼' : '►' }}</span>
    </div>

    <div class="card-content" v-show="isOpen">
      <SliderInput
        title="tower_segments" 
        :min="3" :max="6" :step="1"
        :modelValue="config.tower_segments"
        @update="(v) => config.tower_segments = v" 
      />

      <SliderInput 
        title="floor_height" 
        :min="3" :max="5" :step="0.2"
        :modelValue="config.floor_height"
        @update="(v) => config.floor_height = v" 
      />

      <SliderInput 
        title="tower_curvature" 
        :min="0.5" :max="2" :step="0.1"
        :modelValue="config.tower_curvature"
        @update="(v) => config.tower_curvature = v" 
      />
      
      <hr />

      <p class="section-title">TOWERS CONFIGURATION</p>
      <div class="tower-grid" v-if="config.towers">
        <div class="grid-header"></div> 
        <div class="grid-header center">A</div>
        <div class="grid-header center">B</div>
        <div class="grid-header center">C</div>

        <div class="row-label">Hotel</div>
        <input type="number" v-model.number="config.towers.A.Hotel" class="mini-input" />
        <input type="number" v-model.number="config.towers.B.Hotel" class="mini-input" />
        <input type="number" v-model.number="config.towers.C.Hotel" class="mini-input" />

        <div class="row-label">Resid.</div>
        <input type="number" v-model.number="config.towers.A.Residential" class="mini-input" />
        <input type="number" v-model.number="config.towers.B.Residential" class="mini-input" />
        <input type="number" v-model.number="config.towers.C.Residential" class="mini-input" />

        <div class="row-label">Office</div>
        <input type="number" v-model.number="config.towers.A.Offices" class="mini-input" />
        <input type="number" v-model.number="config.towers.B.Offices" class="mini-input" />
        <input type="number" v-model.number="config.towers.C.Offices" class="mini-input" />
      </div>

      <hr />

      <p class="section-title">PODIUM & GROUND</p>
      <div class="podium-grid" v-if="config.podium">
        <div class="grid-header"></div>
        <div class="grid-header center">Podium</div>
        <div class="grid-header center">Ground</div>

        <template v-for="(val, key) in config.podium" :key="key">
          <div class="row-label small">{{ key }}</div>
          <input type="number" v-model.number="config.podium[key].Podium" class="mini-input" />
          <input type="number" v-model.number="config.podium[key].Ground" class="mini-input" />
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import SliderInput from './SliderInput.vue'

const props = defineProps({
  config: Object,
  index: Number,
  color: String
})

const isOpen = ref(false)
</script>

<style scoped>
.building-params-card {
  background: white;
  border: 1px solid rgba(0,0,0,0.1);
  border-radius: 8px;
  margin-bottom: 10px;
  overflow: hidden;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f9f9f9;
  cursor: pointer;
  border-bottom: 1px solid rgba(0,0,0,0.05);
}
.card-header:hover { background: #f0f0f0; }

.header-left { display: flex; align-items: center; gap: 8px; }

.color-indicator {
  width: 10px; height: 10px;
  border-radius: 50%;
  border: 1px solid rgba(0,0,0,0.1);
}

.building-title {
  font-family: 'Roboto Mono', monospace;
  font-size: 0.7rem;
  font-weight: bold;
  color: #333;
}

.toggle-icon { font-size: 0.7rem; color: #888; }

.card-content { padding: 15px; }

.section-title {
  font-family: "Roboto Mono", monospace;
  font-size: 0.65rem;
  font-weight: bold;
  margin: 10px 0 5px 0;
  opacity: 0.6;
}

/* TABLES & GRIDS (Copied from parent) */
.tower-grid {
  display: grid;
  grid-template-columns: 50px 1fr 1fr 1fr;
  gap: 4px;
  align-items: center;
  margin-bottom: 10px;
}
.podium-grid {
  display: grid;
  grid-template-columns: 60px 1fr 1fr;
  gap: 4px;
  align-items: center;
}
.grid-header { font-family: "Roboto Mono", monospace; font-size: 0.6rem; font-weight: bold; opacity: 0.4; }
.center { text-align: center; }
.row-label { font-size: 0.6rem; font-weight: 600; text-transform: uppercase; }
.row-label.small { font-size: 0.55rem; }

.mini-input {
  width: 100%;
  border: 1px solid rgba(0,0,0,0.1);
  background: rgba(0,0,0,0.02);
  border-radius: 3px;
  padding: 2px;
  text-align: center;
  font-size: 0.75rem;
}

hr { margin: 15px 0; border: 0; border-top: 1px solid rgba(0,0,0,0.05); }
</style>