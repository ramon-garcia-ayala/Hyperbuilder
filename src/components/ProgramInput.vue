<template>
  <div class="program-box">
    <label :for="label">{{ label }}</label>
    <input 
      type="number" 
      :id="label" 
      v-model.number="internalValue" 
      @change="sendUpdate"
      min="0"
    />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps(['label', 'modelValue'])
const emits = defineEmits(['update:modelValue'])

const internalValue = ref(props.modelValue)

// Watch for external changes
watch(() => props.modelValue, (newVal) => {
  internalValue.value = newVal
})

function sendUpdate() {
  emits('update:modelValue', internalValue.value)
}
</script>

<style scoped>
.program-box {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(0,0,0,0.05);
}

label {
  font-family: "Roboto Mono", monospace;
  font-size: 0.85rem;
  text-transform: uppercase;
  opacity: 0.7;
}

input {
  width: 60px;
  border: 1px solid #eee;
  border-radius: 4px;
  padding: 4px 8px;
  font-family: inherit;
  text-align: right;
  background: #f9f9f9;
}

input:focus {
  outline: none;
  border-color: #0004ff;
  background: #fff;
}
</style>