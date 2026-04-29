<template>
  <div class="export-wrapper">
    <button class="export-btn" @click="showOptions = !showOptions" title="Export Model (3D)">
      <span class="text">3D</span>
    </button>
    <div v-if="showOptions" class="export-options" @mouseleave="showOptions = false">
      <div class="option" @click="downloadRhino">
        Rhino (.3dm)
        <small>Native Format</small>
      </div>
      <div class="option" @click="downloadObj">
        SketchUp (.obj)
        <small>Mesh Format</small>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import * as THREE from 'three'

const props = defineProps({
  target: Object // GeometryView ref
})

const showOptions = ref(false)

function downloadRhino() {
  showOptions.value = false
  if (!props.target || !props.target.getRhinoDoc) return
  // Get raw Rhino document from GeometryView
  const doc = props.target.getRhinoDoc()
  
  if (!doc) {
    alert("No geometry computed yet.")
    return
  }

  // Create Binary Blob and download
  const buffer = doc.toByteArray()
  const blob = new Blob([buffer], { type: "application/octect-stream" })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = "MyDesign.3dm"
  link.click()
  URL.revokeObjectURL(link.href)
}

defineExpose({ downloadRhino, downloadObj })

function downloadObj() {
  showOptions.value = false
  if (!props.target || !props.target.getSceneObject) return
  const root = props.target.getSceneObject()
  if (!root) return

  // OBJ Header
  let output = "# Exported from BIM SC 26\n"
  let vertOffset = 1

  // Traverse Three.js scene to find Meshes
  root.traverse(child => {
    if (child.isMesh) {
      output += `g ${child.name || 'Mesh'}\n`
      
      const positions = child.geometry.attributes.position
      child.updateMatrixWorld()

      // Write Vertices
      for (let i = 0; i < positions.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(positions, i)
        v.applyMatrix4(child.matrixWorld)
        // Transform Y-Up (Three.js) to Z-Up (CAD/SketchUp)
        // (x, y, z) -> (x, -z, y)
        output += `v ${v.x.toFixed(4)} ${-v.z.toFixed(4)} ${v.y.toFixed(4)}\n`
      }

      // Write Faces (Indices are 1-based in OBJ)
      for (let i = 0; i < positions.count; i += 3) {
        output += `f ${vertOffset + i} ${vertOffset + i + 1} ${vertOffset + i + 2}\n`
      }

      vertOffset += positions.count
    }
  })

  const blob = new Blob([output], { type: 'text/plain' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = "MyDesign.obj"
  link.click()
  URL.revokeObjectURL(link.href)
}
</script>

<style scoped>
.export-wrapper { position: relative; pointer-events: auto; flex: 1; }
.export-btn {
  background: white; color: black;
  border: 1px solid rgba(0,0,0,0.1); border-radius: 8px;
  padding: 8px 0; cursor: pointer;
  width: 100%;
  justify-content: center;
  font-family: 'Roboto Mono', monospace; font-size: 0.7rem; font-weight: bold;
  display: flex; align-items: center;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08); transition: all 0.2s ease;
}
.export-btn:hover { transform: translateY(-2px); background: #f2dd1c; }
.export-options {
  position: absolute; top: 100%; right: 0; margin-top: 5px;
  background: white; border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 1px solid #eee;
  width: 140px; overflow: hidden;
}
.option { padding: 10px; font-size: 0.7rem; cursor: pointer; font-family: 'Roboto Mono', monospace; }
.option:hover { background: #f5f5f5; }
.option small { display: block; color: #888; font-size: 0.6rem; }
</style>