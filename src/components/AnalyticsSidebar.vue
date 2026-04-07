<template>
  <div class="analytics-container" :class="{ 'is-collapsed': !isOpen }">
    <!-- The actual sidebar content -->
    <div class="analytics-sidebar">
      <div class="sidebar-header">
        ANALYTICS
        <button class="clear-btn" @click="$emit('clear-cards')" title="Clear All Info Cards">Reset</button>
      </div>
      <div class="sidebar-body">
        <slot></slot>
      </div>
    </div>

    <!-- The toggle button that sits on the edge -->
    <div class="toggle-btn" @click="toggleSidebar" :title="isOpen ? 'Collapse Sidebar' : 'Expand Sidebar'">
      {{ isOpen ? '›' : '‹' }}
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const isOpen = ref(true)
const emit = defineEmits(['visibility-changed', 'clear-cards'])

function toggleSidebar() {
  isOpen.value = !isOpen.value
}

// Notify parent when visibility changes
watch(isOpen, (newValue) => {
  emit('visibility-changed', newValue)
})
</script>

<style scoped>
.analytics-container {
  position: relative;
  height: 100%;
  display: flex;
}

.analytics-sidebar {
  width: 340px; /* Ligeramente más estrecho para compactar */
  height: 100%;
  background-color: #f8f9fa;
  border-left: 1px solid #e9ecef;
  transition: width 0.3s ease;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.analytics-container.is-collapsed .analytics-sidebar {
  width: 0;
}

.sidebar-header {
  position: relative;
  padding: 10px;
  font-family: 'Roboto Mono', monospace;
  font-weight: bold;
  font-size: 0.8rem;
  text-align: center;
  border-bottom: 1px solid #e9ecef;
  color: #555;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%; /* Use full width of parent */
}

.clear-btn {
  position: absolute;
  font-family: 'Roboto Mono', monospace;
  font-weight: bold;
  right: 25px;
  background: #f2dd1c;
  color: black;
  border: none;
  border-radius: 4px;
  padding: 2px 8px;
  cursor: pointer;
  font-size: 0.65rem;
}
.clear-btn:hover { background: #e0cc1b; }

.sidebar-body {
  padding: 15px;
  overflow-y: auto;
  flex-grow: 1;
  width: 100%; /* Use full width of parent */
}

.toggle-btn {
  position: absolute;
  left: -15px;
  top: 50%;
  transform: translateY(-50%);
  width: 30px;
  height: 60px;
  background: white;
  border: 1px solid #ddd;
  border-right: none;
  border-radius: 15px 0 0 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1.5rem;
  color: #555;
  box-shadow: -2px 0 5px rgba(0,0,0,0.05);
}
</style>