<template>
  <div class="export-controls-container">
    <DxfExport :target="target" />
    <PngExport />
  </div>
</template>

<script setup>
import DxfExport from './DxfExport.vue'
import PngExport from './PngExport.vue'

defineProps({
  target: Object
})
</script>

<style scoped>
.export-controls-container {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 100;
  display: flex;
  gap: 10px;
}
</style>