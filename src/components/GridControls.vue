<template>
  <div class="grid-controls-card">
    <div class="title">GRID CONTROLS</div>
    <div class="control-item">
      <label for="show-grid">Show Grid</label>
      <input type="checkbox" id="show-grid" :checked="showGrid" @change="$emit('update:showGrid', $event.target.checked)">
    </div>
    <div class="control-item">
      <label for="grid-size">Size: {{ gridSize }}px</label>
      <input type="range" id="grid-size" :value="gridSize" @input="$emit('update:gridSize', Number($event.target.value))" min="10" max="100" step="5">
    </div>
  </div>
</template>

<script setup>
defineProps({
  gridSize: Number,
  showGrid: Boolean
})
defineEmits(['update:gridSize', 'update:showGrid'])
</script>

<style scoped>
.grid-controls-card {
  position: absolute;
  bottom: 20px;
  left: 80px; /* Al lado del botón de recentrar */
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(5px);
  padding: 10px 15px;
  border-radius: 8px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.05);
  z-index: 95;
  font-family: 'Roboto Mono', monospace;
  width: 200px;
}

.title {
  font-size: 0.7rem;
  font-weight: bold;
  color: #555;
  margin-bottom: 8px;
  border-bottom: 1px solid #eee;
  padding-bottom: 4px;
  text-align: center;
}

.control-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.control-item label {
  font-size: 0.75rem;
}

.control-item input[type="range"] {
  width: 100px;
}
</style>