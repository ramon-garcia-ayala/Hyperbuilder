<template>
  <button class="export-btn" @click="generateDxf" title="Download .dxf (AutoCAD)">
    <span class="text">DXF</span>
  </button>
</template>

<script setup>
import * as THREE from 'three'

const props = defineProps({
  target: Object // Referencia al componente GeometryView
})

defineExpose({ generateDxf })

function generateDxf() {
  // 1. Get 3D Model
  if (!props.target || !props.target.getSceneObject) {
    alert("No model found to export.")
    return
  }

  const rootObject = props.target.getSceneObject()
  if (!rootObject) {
    alert("Geometry is not ready yet.")
    return
  }

  // 2. Init DXF File Content
  let dxfString = `0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n`

  // 3. Traverse model finding Lines
  rootObject.traverse((child) => {
    // Look for "LineSegments" (the black edges added in GeometryView)
    if (child.isLineSegments || child.isLine) {
      
      const geometry = child.geometry
      const position = geometry.attributes.position
      
      // Apply World Matrix for real coordinates
      child.updateMatrixWorld() 
      
      // Iterate vertex pairs (start -> end)
      for (let i = 0; i < position.count; i += 2) {
        const start = new THREE.Vector3().fromBufferAttribute(position, i)
        const end = new THREE.Vector3().fromBufferAttribute(position, i + 1)

        // Local to World
        start.applyMatrix4(child.matrixWorld)
        end.applyMatrix4(child.matrixWorld)

        // 4. COORDINATE CONVERSION (Three.js Y-Up -> CAD Z-Up)
        // Three(x, y, z) => CAD(x, z, -y)
        // This makes the model "stand up" in AutoCAD
        const x1 = start.x; const y1 = -start.z; const z1 = start.y;
        const x2 = end.x;   const y2 = -end.z;   const z2 = end.y;

        // 5. Write LINE Entity
        dxfString += `0\nLINE\n8\nMyDesign\n` // Layer "MyDesign"
        dxfString += `10\n${x1.toFixed(4)}\n20\n${y1.toFixed(4)}\n30\n${z1.toFixed(4)}\n` // Start Point
        dxfString += `11\n${x2.toFixed(4)}\n21\n${y2.toFixed(4)}\n31\n${z2.toFixed(4)}\n` // End Point
      }
    }
  })

  // 6. Close File
  dxfString += `0\nENDSEC\n0\nEOF`

  // 7. Download
  downloadBlob(dxfString, 'MyDesign_Export.dxf')
}

function downloadBlob(content, filename) {
  const blob = new Blob([content], { type: 'application/dxf' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}
</script>

<style scoped>
.export-btn {
  background: white;
  color: black;
  border: 1px solid rgba(0,0,0,0.1);
  border-radius: 8px;
  padding: 8px 0;
  cursor: pointer;
  width: 100%;
  flex: 1;
  justify-content: center;
  font-family: 'Roboto Mono', monospace;
  font-size: 0.7rem;
  font-weight: bold;
  display: flex;
  align-items: center;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  transition: all 0.2s ease;
}

.export-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 15px rgba(0,0,0,0.12);
  background: #f2dd1c; /* Color IAAC */
}

.text { letter-spacing: 0.5px; }
</style>