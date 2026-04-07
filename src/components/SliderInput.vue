//////////////////////////////////////////////////////////////////////////////////////////////////////////
// 1. TEMPLATE
//////////////////////////////////////////////////////////////////////////////////////////////////////////

<template>
  <div class="definition-input">
    <div class="label-container">
      <input 
        v-if="isEditingTitle"
        ref="titleInputRef"
        type="text"
        class="title-edit-input"
        v-model="localTitle"
        @blur="stopEditTitle"
        @keyup.enter="stopEditTitle"
      />
      <span v-else class="input-title" :class="{ 'editable': editableTitle }" @dblclick="startEditTitle" :title="editableTitle ? 'Double click to edit' : ''">
        {{ props.title }}
      </span>
      
      <input 
        v-if="isEditingValue"
        ref="valueInputRef"
        type="number"
        class="value-edit-input"
        v-model="tempValue"
        @blur="stopEditValue"
        @keyup.enter="stopEditValue"
      />
      <span v-else class="input-value editable" @dblclick="startEditValue" title="Double click to edit value">
        {{ sliderValue }}
      </span>
    </div>

    <input
      type="range"
      class="modern-range"
      :min="min"
      :max="localMax"
      :step="step"
      v-model="sliderValue"
      @input="sendValueUpdate" 
    />
  </div>
</template>

//////////////////////////////////////////////////////////////////////////////////////////////////////////
// 2. SCRIPT SETUP
//////////////////////////////////////////////////////////////////////////////////////////////////////////

<script setup>
import { ref, watch, nextTick } from "vue";

const props = defineProps({
  title: String,
  min: { type: Number, default: 1 },
  max: { type: Number, default: 10 },
  step: { type: Number, default: 1 },
  modelValue: { type: Number }, // Recibimos el valor desde el padre
  color: { type: String, default: '#000000' }, // Nuevo prop para color personalizado
  editableTitle: { type: Boolean, default: false } // Permite editar el nombre del slider
});

const emits = defineEmits(["update", "update-title"]);

const sliderValue = ref(props.modelValue || props.min);
const localMax = ref(props.max);

const isEditingValue = ref(false);
const tempValue = ref(sliderValue.value);
const valueInputRef = ref(null);

const isEditingTitle = ref(false);
const localTitle = ref(props.title);
const titleInputRef = ref(null);

watch(() => props.title, (newVal) => {
  localTitle.value = newVal;
});

function startEditTitle() {
  if (!props.editableTitle) return;
  isEditingTitle.value = true;
  nextTick(() => {
    if (titleInputRef.value) titleInputRef.value.focus();
  });
}

function stopEditTitle() {
  isEditingTitle.value = false;
  if (localTitle.value !== props.title) {
    emits("update-title", localTitle.value);
  }
}

function startEditValue() {
  tempValue.value = sliderValue.value;
  isEditingValue.value = true;
  nextTick(() => {
    if (valueInputRef.value) {
      valueInputRef.value.focus();
      valueInputRef.value.select();
    }
  });
}

function stopEditValue() {
  isEditingValue.value = false;
  let val = parseInt(tempValue.value, 10);
  
  if (isNaN(val)) val = props.min;
  if (val < props.min) val = props.min; // No bajar del mínimo (ej. 1)
  if (val > 100) val = 100; // Tope máximo absoluto de 100
  
  // Calculamos la siguiente decena más cercana (ej. 55 -> 60, 82 -> 90)
  let nextTen = Math.ceil(val / 10) * 10;
  if (nextTen > 100) nextTen = 100;
  if (nextTen < props.max) nextTen = props.max; // Respetar el límite visual inicial
  
  localMax.value = nextTen;
  sliderValue.value = val;
  sendValueUpdate();
}

watch(() => props.modelValue, (newValue) => {
  if (newValue !== undefined) {
    sliderValue.value = newValue;
    let nextTen = Math.ceil(newValue / 10) * 10;
    if (nextTen > localMax.value) localMax.value = Math.min(100, nextTen);
  }
})

function sendValueUpdate() {
  emits("update", Number(sliderValue.value), props.title);
}

defineExpose({
  localMax
})
</script>

//////////////////////////////////////////////////////////////////////////////////////////////////////////
// 3. STYLE
//////////////////////////////////////////////////////////////////////////////////////////////////////////

<style scoped>
.definition-input {
  padding: 2px 0; /* Espacio vertical aún más reducido para pegar sliders */
  width: 100%;
}

.label-container {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 4px;
}

.input-title {
  font-family: "Roboto Mono", monospace;
  font-size: 0.7rem;
  font-weight: bold;
  margin: 1px 0 1px 0;
  letter-spacing: .5px;
  opacity: 0.6;
}

.input-title.editable {
  cursor: text;
}
.input-title.editable:hover {
  background: rgba(0,0,0,0.05);
  border-radius: 2px;
}

.title-edit-input {
  font-family: "Roboto Mono", monospace;
  font-size: 0.7rem;
  font-weight: bold;
  border: none;
  border-bottom: 1px solid rgba(0,0,0,0.5);
  background: transparent;
  outline: none;
  padding: 0;
  margin: 1px 0 1px 0;
  width: 90px;
}

.input-value {
  font-family: "Roboto Mono", monospace;
  font-size: 0.75rem;
  font-weight: bold;
  color: inherit;
}

.input-value.editable {
  cursor: text;
  padding: 0 2px;
}
.input-value.editable:hover {
  background: rgba(0,0,0,0.05);
  border-radius: 2px;
}

.value-edit-input {
  font-family: "Roboto Mono", monospace;
  font-size: 0.75rem;
  font-weight: bold;
  border: none;
  border-bottom: 1px solid rgba(0,0,0,0.5);
  background: transparent;
  outline: none;
  padding: 0;
  margin: 0;
  width: 30px;
  text-align: right;
  -moz-appearance: textfield;
}
.value-edit-input::-webkit-outer-spin-button,
.value-edit-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

/* --- EL SLIDER FINO --- */
.modern-range {
  -webkit-appearance: none;
  width: 100%;
  height: 2px; /* Track ultra fino */
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
  outline: none;
  margin: 6px 0;
}

/* Chrome, Safari, Edge */
.modern-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 10px; /* Thumb pequeño */
  height: 10px;
  border-radius: 50%;
  background: v-bind('props.color'); /* Color dinámico */
  cursor: pointer;
  transition: transform 0.1s ease-in-out;
  border: none;
}

.modern-range::-webkit-slider-thumb:hover {
  transform: scale(1.3); /* Feedback sutil al tocarlo */
}

/* Firefox */
.modern-range::-moz-range-thumb {
  width: 10px;
  height: 10px;
  border: none;
  border-radius: 50%;
  background: v-bind('props.color'); /* Color dinámico */
  cursor: pointer;
}
</style>