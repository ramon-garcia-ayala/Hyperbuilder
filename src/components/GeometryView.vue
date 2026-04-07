<template>
  <div id="viewport" ref="viewportRef">
    <div id="threejs-container"></div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, watch, ref } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { Rhino3dmLoader } from 'three/addons/loaders/3DMLoader.js'
import RhinoCompute from 'compute-rhino3d'
import { loadRhino, rhino } from '@/scripts/compute.js'
// Importamos utilidades para texto en 3D si fuera necesario, o usaremos sprites simples
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'

const loader = new Rhino3dmLoader()
loader.setLibraryPath('https://cdn.jsdelivr.net/npm/rhino3dm@8.0.0-beta2/')

const props = defineProps(['data', 'path', 'backgroundColor', 'highlightColor', 'points', 'editMode', 'editContextMode', 'colors', 'activeTowerIndex'])
const emits = defineEmits(['updateMetadata', 'selectObject', 'add-point', 'geometry-updated', 'collisions-detected', 'update-point', 'select-tower', 'transform-mode-changed'])

// Three.js core variables
let renderer, labelRenderer, camera, scene, controls, container
let modelContainer // CAMBIO: Contenedor para la rotación constante
let pointsGroup // Grupo para visualizar los puntos
let contextGroup // NUEVO: Contenedor para geometría estática importada
const isAutoRotating = ref(false) // Estado de la rotación automática

// Variables para capas auxiliares
let dimensionsGroup = null
let bboxGroup = null
let transformControls = []
let contextTransformControl = null

// Variables para Interacción (Raycaster)
const viewportRef = ref(null)
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
let isDragging = false
let mouseDownPos = new THREE.Vector2()

// Variables para Hover
let hoveredObject = null

let lastDoc = null // Store the Rhino document for Exporting
let lastPointCount = 0 // Track number of points to trigger auto-zoom on add
let isFirstLoad = true // Flag to prevent camera reset on updates
let shouldResetCamera = false // Flag to trigger zoom AFTER compute finishes
const currentDisplayMode = ref('shaded') // Estado para recordar el modo actual

// Variables para evitar condiciones de carrera en el compute
let computeTimeout = null;
let latestComputeId = 0;

watch(() => props.backgroundColor, (newColor) => {
  if (scene) scene.background = new THREE.Color(newColor)
})

watch(() => props.data, () => { 
  // Debounce: agrupamos múltiples cambios rápidos en una sola petición
  if (computeTimeout) clearTimeout(computeTimeout);
  computeTimeout = setTimeout(() => { compute() }, 50);
}, { deep: true })

// --- SINCRONIZACIÓN DE COLORES ---
watch(() => props.colors, (newColors) => {
  if (!modelContainer || !newColors || newColors.length === 0) return
  
  let meshIndex = 0
  modelContainer.traverse((child) => {
    if (child.isMesh) {
      const col = newColors[meshIndex] ? newColors[meshIndex] : 0xcccccc
      child.userData.originalColor = new THREE.Color(col)
      // Actualizar material actual si estamos en modo color
      if (currentDisplayMode.value !== 'wireframe' && currentDisplayMode.value !== 'arctic') {
        child.material.color.copy(child.userData.originalColor)
      }
      meshIndex++
    }
  })
}, { deep: true })

// --- VISUALIZACIÓN DE PUNTOS ---
watch(() => props.points, (newPoints) => {
  updatePointsVisuals(newPoints)
}, { deep: true })

function updatePointsVisuals(points) {
    if (!pointsGroup || !camera || !renderer) return

  // Si la cantidad coincide, solo actualizamos posiciones para no perder el Gumball
  if (pointsGroup.children.length === points.length) {
    points.forEach((pt, index) => {
      const mesh = pointsGroup.children[index]
      mesh.position.set(pt.x, pt.z || 0, -pt.y)
      mesh.rotation.set(0, pt.rotation || 0, 0)
      mesh.scale.set(pt.scaleX || pt.scale || 1, pt.scaleZ || pt.scale || 1, pt.scaleY || pt.scale || 1)
    })
    return
  }

  // De lo contrario reconstruimos
  pointsGroup.clear()
  transformControls.forEach(tc => {
    tc.detach(); tc.dispose(); scene.remove(tc)
  })
  transformControls = []

  if (points && points.length > 0) {
    points.forEach((pt, index) => {
      const geom = new THREE.SphereGeometry(1.5, 16, 16)
      const mat = new THREE.MeshStandardMaterial({ color: 0xf2dd1c, emissive: 0x554400 }) // Amarillo UI
      const mesh = new THREE.Mesh(geom, mat)
      mesh.position.set(pt.x, pt.z || 0, -pt.y) 
      mesh.rotation.set(0, pt.rotation || 0, 0)
      mesh.scale.set(pt.scaleX || pt.scale || 1, pt.scaleZ || pt.scale || 1, pt.scaleY || pt.scale || 1)
      mesh.userData.pointIndex = index
      mesh.userData.isPointControl = true
      pointsGroup.add(mesh)

      const tc = new TransformControls(camera, renderer.domElement)
      tc.setSize(0.6) // Gumballs reducidos para las torres
      tc.setSpace('local') // FIX: Previene que las flechas se deformen y pierdan el hitbox cuando la torre está rotada

       // --- CAMBIOS EN TIEMPO REAL AL ARRASTRAR ---
      tc.addEventListener('change', function () {
        if (tc.object) {
          const pos = tc.object.position;
          const rot = tc.object.rotation;
          const scl = tc.object.scale;
          
          if (modelContainer) {
            let moved = false;
            modelContainer.traverse((child) => {
              if (child.isMesh && child.userData.towerIndex === index) {
                child.position.set(pos.x, -pos.z, pos.y);
                child.rotation.set(0, 0, rot.y);
                child.scale.set(scl.x, scl.z, scl.y);
                moved = true;
              }
            });
            if (moved) {
              modelContainer.updateMatrixWorld(true); // FIX: Forzar actualización matemática antes de dibujar BBox
              if (dimensionsGroup && dimensionsGroup.visible) updateDimensions();
              if (bboxGroup && bboxGroup.visible) updateBBox();
              checkCollisions();
              emits('geometry-updated'); // Actualiza tarjetas flotantes que tengas abiertas
            }
          }
        }
      });
      
      tc.addEventListener('dragging-changed', function (event) {
        controls.enabled = !event.value
        if (!event.value && tc.object) {
          const pos = tc.object.position
          const rot = tc.object.rotation
          const scl = tc.object.scale
          const newPoint = {
            x: Math.round(pos.x * 10) / 10,
            y: Math.round(-pos.z * 10) / 10,
            z: Math.round(pos.y * 10) / 10,
            rotation: rot.y,
            scaleX: scl.x,
            scaleY: scl.z, // Guardamos la profundidad de Three.js (Z) como profundidad en Rhino (Y)
            scaleZ: scl.y  // Guardamos la altura de Three.js (Y) como altura en Rhino (Z)
          }
          emits('update-point', index, newPoint)
        }
      })
      tc.addEventListener('mouseDown', function () {
        emits('select-tower', index)
      })
      scene.add(tc)
      transformControls.push(tc)

      // Atar si estamos en modo edición
      if (props.editMode) tc.attach(mesh)
    })
  }
}

watch(() => props.editMode, (isEditing) => {
  if (isEditing) {
    transformControls.forEach((tc, i) => {
      if (pointsGroup && pointsGroup.children[i]) tc.attach(pointsGroup.children[i])
    })
  } else {
    transformControls.forEach(tc => tc.detach())
  }
})

watch(() => props.editContextMode, (isEditing) => {
  if (isEditing && contextGroup && contextGroup.children.length > 0) {
    contextTransformControl.attach(contextGroup.children[0])
  } else if (contextTransformControl) {
    contextTransformControl.detach()
  }
})

function init() {
  // preserveDrawingBuffer: true is REQUIRED for screenshots to work
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap 
    
  container = document.getElementById('threejs-container')
  renderer.setSize(container.offsetWidth, container.offsetHeight)
  container.appendChild(renderer.domElement)

  // EVENTS (Distinguish between click and drag)
  container.addEventListener('mousedown', onMouseDown)
  container.addEventListener('mouseup', onMouseUp)
  container.addEventListener('mousemove', onMouseMove) // NUEVO: Para el hover

  // Inicializar CSS2DRenderer para etiquetas de texto
  labelRenderer = new CSS2DRenderer()
  labelRenderer.setSize(container.offsetWidth, container.offsetHeight)
  labelRenderer.domElement.style.position = 'absolute'
  labelRenderer.domElement.style.top = '0px'
  labelRenderer.domElement.style.pointerEvents = 'none' // Permitir clicks a través del texto
  container.appendChild(labelRenderer.domElement)

  // FIX: Usar ResizeObserver para detectar cambios de tamaño del contenedor de forma fiable.
  // Esto es más robusto que el evento 'resize' de la ventana.
  const resizeObserver = new ResizeObserver(onWindowResize)
  resizeObserver.observe(container)

  // CAMBIO: Configuración de cámara para vista "Isometric-like"
  camera = new THREE.PerspectiveCamera(20, container.offsetWidth / container.offsetHeight, 1, 10000)
  camera.position.set(200, 200, 200) // Posición aérea diagonal más alejada por defecto

  scene = new THREE.Scene()
  const initialColor = props.backgroundColor || '#ffffff'
  scene.background = new THREE.Color(initialColor)

  // Initialize the container group for the model
  modelContainer = new THREE.Group()
  scene.add(modelContainer)

  // Grupo para puntos (fuera del modelContainer para no ser borrado en compute)
  pointsGroup = new THREE.Group()
  scene.add(pointsGroup)

  // Grupo para contexto (terrenos, edificios estáticos, líneas)
  contextGroup = new THREE.Group()
  scene.add(contextGroup)

  // Iluminación
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7)
  scene.add(ambientLight)

  const sun = new THREE.DirectionalLight(0xffffff, 1.2)
  // Elevamos el sol para que ilumine edificios altos sin cortar sus sombras
  sun.position.set(100, 200, 100)
  sun.castShadow = true
  sun.shadow.mapSize.width = 2048
  sun.shadow.mapSize.height = 2048
  // Ampliamos el área matemática de la sombra para evitar el "cubo" en el origen
  sun.shadow.camera.left = -200
  sun.shadow.camera.right = 200
  sun.shadow.camera.top = 200
  sun.shadow.camera.bottom = -200
  sun.shadow.camera.far = 1000
  sun.shadow.bias = -0.0005 // Evita el parpadeo de sombras (Z-fighting)
  scene.add(sun)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true // Suaviza el movimiento manual
  controls.autoRotateSpeed = 1.0 // Velocidad suave (ajustable)

  // INICIALIZAR GUMBALL PARA EL CONTEXTO
  contextTransformControl = new TransformControls(camera, renderer.domElement)
  contextTransformControl.setSize(0.8) // Gumball reducido para el contexto
  contextTransformControl.setSpace('local') // FIX para rotaciones en el contexto
  contextTransformControl.addEventListener('dragging-changed', function (event) {
    controls.enabled = !event.value
  })
  scene.add(contextTransformControl)

  // Inicializar puntos si ya existen
  if (props.points) updatePointsVisuals(props.points)
  
  animate()
} 

async function compute() {
  const currentComputeId = ++latestComputeId;
  try {
    if (!modelContainer) return;
    
    const trees = []
    
    // 1. CONSTRUCCIÓN DE ÁRBOLES
    for (const [name, inputVal] of Object.entries(props.data)) {
      const tree = new RhinoCompute.Grasshopper.DataTree(name)
      
      // Verificamos si hay datos y si tienen el formato correcto {path, data}
      if (Array.isArray(inputVal) && inputVal.length > 0 && inputVal[0].path !== undefined) {
        
        // Iteramos sobre cada rama (cada torre)
        inputVal.forEach(item => {
          // Convertimos "{0;0}" -> [0, 0]
          const pathArr = item.path.replace(/[{}]/g, '').split(';').map(Number)
          
          // Nos aseguramos de que data sea siempre un array
          const dataArray = Array.isArray(item.data) ? item.data : [item.data]
          
          // AÑADIMOS LA LISTA COMPLETA A LA RAMA DE GOLPE
          tree.append(pathArr, dataArray) 
        })
      }
      trees.push(tree)
    }

    console.log("🔥 ÁRBOLES LISTOS PARA ENVIAR:", trees);

    // 2. DESCARGAR EL SCRIPT Y ENVIAR AL SERVIDOR
    const responseBytes = await fetch(props.path);
    const arrayBuffer = await responseBytes.arrayBuffer();
    const definitionBytes = new Uint8Array(arrayBuffer);

    const res = await RhinoCompute.Grasshopper.evaluateDefinition(definitionBytes, trees);
    console.log("✅ Respuesta de Grasshopper:", res);

    // Cancelar si una petición más reciente ya ha comenzado
    if (currentComputeId !== latestComputeId) return;

    if (!res) throw new Error("El servidor devolvió un documento vacío o falló.")
    if (res.metadata) emits('updateMetadata', res.metadata)

    // 3. CONVERTIR EL JSON A UN ARCHIVO 3DM
    const rhinoInstance = typeof rhino !== 'undefined' ? rhino : window.rhino;
    if (!rhinoInstance) throw new Error("No se encontró rhino3dm. Revisa tu import.");

    const doc = new rhinoInstance.File3dm();
    const metadata = []; // Aquí guardaremos tus FloorAreas y FloorLabels

    // Extraemos la geometría horneada (Bake) del resultado
    for (let i = 0; i < res.values.length; i++) {
      const param = res.values[i];
      for (const [path, branch] of Object.entries(param.InnerTree)) {
        for (let j = 0; j < branch.length; j++) {
          const d = branch[j];
          const dataType = String(d.type);

          // VERIFICACIÓN: ¿Es un objeto 3D o son datos?
          if (dataType.includes("Rhino.Geometry")) {
            // Es Geometría: La decodificamos al archivo 3D
            const dataObj = JSON.parse(d.data);
            const rhinoObject = rhinoInstance.CommonObject.decode(dataObj);
            if (rhinoObject) {
              // Asignar un nombre estable basado en la ruta de Grasshopper
              let attributes = null;
              if (rhinoInstance.ObjectAttributes) {
                attributes = new rhinoInstance.ObjectAttributes();
                attributes.name = `GH_Path_${path}_Item_${j}`;
              }
              doc.objects().add(rhinoObject, attributes);
            }
          } else {
            // Son Datos (Números/Textos): Los guardamos para tus gráficos
            metadata.push({
              name: param.ParamName,
              value: JSON.parse(d.data)
            });
          }
        }
      }
    }

    lastDoc = doc; // Guardamos el documento para exportar a CAD/3D luego

    // Enviamos los datos a tu App.vue para que tus gráficos vuelvan a funcionar
    if (metadata.length > 0) {
      emits('updateMetadata', metadata);
    }

    // 4. LIMPIEZA DE PANTALLA
    disposeGroup(modelContainer);

    // 5. RENDERIZAR CON THREE.JS
    const buffer = new Uint8Array(doc.toByteArray()).buffer
    loader.parse(buffer, function (object) {
      if (currentComputeId !== latestComputeId) return; // Doble validación
      
      object.rotation.x = -Math.PI / 2

      // MAPEO DE TORRES PARA APLICAR ROTACIÓN/ESCALA
      const towerMap = [];
      if (props.points) {
        props.points.forEach((tower, tIndex) => {
          if (tower.program) {
            tower.program.forEach(() => {
              towerMap.push(tIndex);
            });
          }
        });
      }

      let meshIndex = 0
      object.traverse((child) => {
        if (child.isMesh) {
          child.userData.meshIndex = meshIndex;
          child.userData.stableID = (child.name && child.name.startsWith('GH_Path')) ? child.name : `mesh-${meshIndex}`;
          
          const col = (props.colors && props.colors[meshIndex]) ? props.colors[meshIndex] : 0xcccccc
          child.userData.originalColor = new THREE.Color(col)
          child.material = new THREE.MeshStandardMaterial({
            vertexColors: false, 
            side: THREE.DoubleSide,
            color: child.userData.originalColor,
            roughness: 0.8,      
            metalness: 0.1
          });
          child.castShadow = true;
          child.receiveShadow = true;

          // --- APLICAR TRANSFORMACIONES DEL GUMBALL NATIVAMENTE ---
          let tIndex = towerMap[meshIndex];
          child.userData.towerIndex = tIndex;
          
          if (tIndex !== undefined && props.points[tIndex]) {
            const pt = props.points[tIndex];
            const pZ = pt.z || 0;
            
            // 1. Mover al origen local (Pivot)
            child.geometry.translate(-pt.x, -pt.y, -pZ);
            
            // FIX: Destruir el "fantasma" re-calculando los límites reales de los vértices
            child.geometry.computeBoundingBox();
            child.geometry.computeBoundingSphere();

            // 2. En lugar de quemar la matriz estática, usamos propiedades vivas para tiempo real
            const sX = pt.scaleX !== undefined ? pt.scaleX : (pt.scale !== undefined ? pt.scale : 1);
            const sY = pt.scaleY !== undefined ? pt.scaleY : (pt.scale !== undefined ? pt.scale : 1);
            const sZ = pt.scaleZ !== undefined ? pt.scaleZ : (pt.scale !== undefined ? pt.scale : 1);

            child.position.set(pt.x, pt.y, pZ);
            child.rotation.set(0, 0, pt.rotation || 0);
            child.scale.set(sX, sY, sZ);
          }

          const edges = new THREE.EdgesGeometry(child.geometry);
          const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000 }));
          child.add(line);
          meshIndex++
        }
      });
        
      modelContainer.add(object);

      const currentPointCount = props.points ? props.points.length : 0;
      const isPointCountChanged = currentPointCount !== lastPointCount;

      // Solo encuadrar en el primer render, explícitamente, o al añadir/borrar torres
      if (isFirstLoad || shouldResetCamera || isPointCountChanged) {
        zoomCameraToSelection(camera, controls, modelContainer);
        isFirstLoad = false;
        shouldResetCamera = false;
        lastPointCount = currentPointCount;
      }

      if (dimensionsGroup && dimensionsGroup.visible) updateDimensions()
      if (bboxGroup && bboxGroup.visible) updateBBox()

      setDisplayMode(currentDisplayMode.value)
      
      checkCollisions()
      
      emits('geometry-updated')
    });
  } catch (error) {
    console.error("❌ ERROR EN RHINO COMPUTE:", error);
  }
}

function animate() {
  requestAnimationFrame(animate)
  
  // Use OrbitControls auto-rotate so ViewCube stays synced
  if (controls) {
    controls.autoRotate = isAutoRotating.value
  }

  if (controls) controls.update()
  if (renderer && scene && camera) renderer.render(scene, camera)
  if (labelRenderer && scene && camera) labelRenderer.render(scene, camera)
}

function onWindowResize() {
  if (!container) return
  camera.aspect = container.offsetWidth / container.offsetHeight
  camera.updateProjectionMatrix()
  renderer.setSize(container.offsetWidth, container.offsetHeight)
  labelRenderer.setSize(container.offsetWidth, container.offsetHeight)
}

// --- GUMBALL HOTKEYS ---
function onKeyDown(event) {
  // Evitar que las teclas cambien el Gumball si estamos escribiendo en un input
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return
  
  const modeMap = { 't': 'translate', 'r': 'rotate', 's': 'scale' }
  const newMode = modeMap[event.key.toLowerCase()]
  
  if (newMode) {
    setTransformMode(newMode)
    emits('transform-mode-changed', newMode)
  }
}

function setTransformMode(mode) {
  transformControls.forEach(tc => tc.setMode(mode))
  if (contextTransformControl) contextTransformControl.setMode(mode)
}

onMounted(async () => {
  init()
  await loadRhino()
  compute()
  window.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
})

function zoomCameraToSelection(camera, controls, selection) {
  const box = new THREE.Box3().setFromObject(modelContainer)
  
  // Incluir el terreno importado en el encuadre si existe
  if (contextGroup && contextGroup.children.length > 0) {
    const ctxBox = new THREE.Box3().setFromObject(contextGroup)
    if (!ctxBox.isEmpty()) box.union(ctxBox)
  }

  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  
  const maxSize = Math.max(size.x, size.y, size.z) || 20 // Fallback si es 0

  // MANTENER ANGULO: Calcular vector de dirección actual (Target -> Camera)
  const direction = camera.position.clone().sub(controls.target).normalize()
  if (direction.lengthSq() === 0) direction.set(0, 0, 1) // Protección

  let targetPos
  let targetZoom = camera.zoom

  if (camera.isOrthographicCamera) {
    // --- CÁMARA ORTOGONAL ---
    // Ajustamos el ZOOM, no solo la distancia
    const h = camera.top - camera.bottom
    const w = camera.right - camera.left
    const padding = 2 // Aumentado el margen para encuadre inicial
    
    const zoomV = h / (maxSize * padding)
    const zoomH = w / (maxSize * padding)
    targetZoom = Math.min(zoomV, zoomH)

    // Distancia segura constante (en ortho no afecta tamaño, solo clipping)
    const dist = Math.max(1000, maxSize * 2)
    targetPos = center.clone().add(direction.multiplyScalar(dist))
  } else {
    // --- CÁMARA PERSPECTIVA ---
    // Ajustamos la DISTANCIA usando trigonometría (FOV)
    const fitHeightDistance = maxSize / (2 * Math.tan(Math.PI * camera.fov / 360))
    const fitWidthDistance = fitHeightDistance / camera.aspect
    const distance = 2 * Math.max(fitHeightDistance, fitWidthDistance) // Multiplicador aumentado para alejar la cámara
    
    targetPos = center.clone().add(direction.multiplyScalar(distance))
  }
  
  // Animamos hacia la nueva posición
  animateCamera(targetPos, center, targetZoom)
}

function animateCamera(targetPos, targetCenter, targetZoom) {
  const startPos = camera.position.clone()
  const startTarget = controls.target.clone()
  const startZoom = camera.zoom
  const duration = 800 // Duración en ms
  const startTime = performance.now()

  function update(time) {
    const elapsed = time - startTime
    const t = Math.min(elapsed / duration, 1)
    const ease = 1 - Math.pow(1 - t, 3) // Cubic Ease Out para suavidad

    camera.position.lerpVectors(startPos, targetPos, ease)
    controls.target.lerpVectors(startTarget, targetCenter, ease)
    
    // Interpolación de Zoom (necesario para Ortho)
    camera.zoom = THREE.MathUtils.lerp(startZoom, targetZoom, ease)
    camera.updateProjectionMatrix()
    
    controls.update()

    if (t < 1) requestAnimationFrame(update)
  }
  requestAnimationFrame(update)
}

// --- CONTEXT IMPORT LOGIC ---
function loadContextFromBuffer(buffer) {
  clearContext() // Limpiar cualquier contexto anterior
  loader.parse(buffer, function (object) {
    // Orientar correctamente de Rhino a Three.js
    object.rotation.x = -Math.PI / 2
    
    // Asignar materiales básicos de "maqueta" o líneas de terreno
    object.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({ color: 0xdddddd, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
        child.receiveShadow = true
        child.castShadow = true
      } else if (child.isLine || child.isLineSegments) {
        child.material = new THREE.LineBasicMaterial({ color: 0x888888 })
      }
    })
    contextGroup.add(object)

    // Si el usuario activó la edición rápido antes de que terminara de cargar
    if (props.editContextMode && contextTransformControl) {
      contextTransformControl.attach(object)
    }
  }, function(err) {
    console.error("Error cargando 3DM de contexto:", err)
  })
}

function clearContext() {
  if (contextTransformControl) contextTransformControl.detach()
  if (contextGroup) disposeGroup(contextGroup)
}

// --- VIEWCUBE & CAMERA LOGIC ---

function toggleAutoRotation() {
  isAutoRotating.value = !isAutoRotating.value
}

function getAutoRotationState() {
  return isAutoRotating.value
}

function toggleCamera(isOrtho) {
  if (!container || !camera || !controls) return

  const oldCam = camera
  const aspect = container.offsetWidth / container.offsetHeight
  const dist = controls.getDistance() // Distancia actual al objetivo
  
  // Calculate Orthographic frustum size based on current distance
  // h = 2 * dist * tan(fov/2)
  const fovRad = (oldCam.fov * Math.PI) / 180
  const height = 2 * dist * Math.tan(fovRad / 2)
  const width = height * aspect

  if (isOrtho) {
    camera = new THREE.OrthographicCamera(width / -2, width / 2, height / 2, height / -2, 1, 10000)
    camera.zoom = 1
  } else {
    camera = new THREE.PerspectiveCamera(20, aspect, 1, 10000)
  }

  // Copy position and orientation to avoid "jump"
  camera.position.copy(oldCam.position)
  camera.quaternion.copy(oldCam.quaternion)
  
  // Actualizamos el controlador para usar la nueva cámara
  controls.object = camera
  controls.update()
}

function setCameraView(viewName) {
  if (!controls || !modelContainer) return
  
  // Calculate model center and size to know where to look and how far to be
  const box = new THREE.Box3().setFromObject(modelContainer)
  
  // Incluir el terreno importado en el encuadre si existe
  if (contextGroup && contextGroup.children.length > 0) {
    const ctxBox = new THREE.Box3().setFromObject(contextGroup)
    if (!ctxBox.isEmpty()) box.union(ctxBox)
  }

  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z) || 20 // Fallback
  
  let distance
  let targetZoom = camera.zoom

  if (camera.isOrthographicCamera) {
    // --- CÁMARA ORTOGONAL ---
    const h = camera.top - camera.bottom
    const w = camera.right - camera.left
    const padding = 2
    
    const zoomV = h / (maxDim * padding)
    const zoomH = w / (maxDim * padding)
    targetZoom = Math.min(zoomV, zoomH)
    
    distance = Math.max(1000, maxDim * 2) // Distancia segura para evitar clipping
  } else {
    // --- CÁMARA PERSPECTIVA ---
    const fov = camera.fov || 50
    const aspect = camera.aspect || 1
    const fitHeightDistance = maxDim / (2 * Math.tan(Math.PI * fov / 360))
    const fitWidthDistance = fitHeightDistance / aspect
    distance = 2 * Math.max(fitHeightDistance, fitWidthDistance)
  }

  // Definimos las posiciones relativas
  const positions = {
    'Front':  new THREE.Vector3(0, 0, distance),
    'Back':   new THREE.Vector3(0, 0, -distance),
    'Right':  new THREE.Vector3(distance, 0, 0),
    'Left':   new THREE.Vector3(-distance, 0, 0),
    'Top':    new THREE.Vector3(0, distance, 0),
    'Bottom': new THREE.Vector3(0, -distance, 0)
  }
  
  // Add Corners (Isometric)
  // Distribuir distancia en 3 ejes: x = distance / sqrt(3)
  const iso = distance / Math.sqrt(3)

  positions['TopFrontRight'] = new THREE.Vector3(iso, iso, iso)
  positions['TopFrontLeft']  = new THREE.Vector3(-iso, iso, iso)
  positions['TopBackRight']  = new THREE.Vector3(iso, iso, -iso)
  positions['TopBackLeft']   = new THREE.Vector3(-iso, iso, -iso)
  
  positions['BottomFrontRight'] = new THREE.Vector3(iso, -iso, iso)
  positions['BottomFrontLeft']  = new THREE.Vector3(-iso, -iso, iso)
  positions['BottomBackRight']  = new THREE.Vector3(iso, -iso, -iso)
  positions['BottomBackLeft']   = new THREE.Vector3(-iso, -iso, -iso)

  if (positions[viewName]) {
    const targetPos = center.clone().add(positions[viewName])
    // Usamos animateCamera para una transición suave y correcta
    animateCamera(targetPos, center, targetZoom)
  }
}

function manualOrbit(deltaX, deltaY) {
  if (!controls) return
  const speed = 0.005
  // OrbitControls handles mouse normally, here we inject it manually
  controls.rotateLeft(deltaX * speed)
  controls.rotateUp(deltaY * speed)
  controls.update()
}

function getCameraState() {
  if (!camera || !controls) return null
  return {
    position: camera.position.toArray(),
    target: controls.target.toArray(),
    zoom: camera.zoom,
    isOrthographic: camera.isOrthographicCamera
  }
}

function setCameraState(state) {
  if (!camera || !controls || !state) return

  // Restaurar tipo de cámara (Ortho vs Perspective) si es diferente
  if (state.isOrthographic !== undefined && state.isOrthographic !== camera.isOrthographicCamera) {
    toggleCamera(state.isOrthographic)
  }

  // Restaurar posición y objetivo
  if (state.position) camera.position.fromArray(state.position)
  if (state.target) controls.target.fromArray(state.target)
  if (state.zoom) camera.zoom = state.zoom
  
  camera.updateProjectionMatrix()
  controls.update()
}

// --- DISPLAY MODES ---
function setDisplayMode(mode) {
  currentDisplayMode.value = mode // Guardamos el modo seleccionado
  if (!modelContainer) return;
  
  modelContainer.traverse((child) => {
    if (child.isMesh) {
      // Find edges (LineSegments) added previously
      const edges = child.children.find(c => c.isLineSegments);
      
      switch (mode) {
        case 'wireframe': // Lines only
          child.material.visible = false;
          child.material.wireframe = true; // Por si acaso
          if (edges) edges.visible = true;
          break;
          
        case 'arctic': // Pure white, no edges (Clay style)
          child.material.visible = true;
          child.material.wireframe = false;
          child.material.vertexColors = false;
          child.material.color.setHex(0xffffff);
          if (edges) edges.visible = false;
          break;
          
        case 'rendered': // Original colors, no edges
          child.material.visible = true;
          child.material.wireframe = false;
          child.material.vertexColors = false; // CAMBIO
          // Usar color original si existe, si no gris
          if (child.userData.originalColor) child.material.color.copy(child.userData.originalColor);
          else child.material.color.setHex(0xcccccc);
          if (edges) edges.visible = false;
          break;
          
        case 'shaded': // Colors + Edges (Technical - Default)
          child.material.visible = true;
          child.material.wireframe = false;
          child.material.vertexColors = false; // CAMBIO
          // Usar color original si existe, si no gris
          if (child.userData.originalColor) child.material.color.copy(child.userData.originalColor);
          else child.material.color.setHex(0xcccccc);
          if (edges) edges.visible = true;
          break;
      }
    }
  });
}

function resetCameraView(immediate = true) {
  if (immediate) {
    // Ejecución inmediata (para el botón del ViewCube)
    if (camera && controls && modelContainer) zoomCameraToSelection(camera, controls, modelContainer)
  } else {
    // Ejecución diferida (para cuando se limpia el modelo y esperamos geometría nueva)
    shouldResetCamera = true
  }
}

function toggleShadow(visible) {
  // Ya no usamos el shadowFloor, así que apagamos la luz del sol directamente
  scene.traverse((child) => {
    if (child.isDirectionalLight) {
      child.castShadow = visible
    }
  })
}

// Helper para limpiar grupos y liberar memoria
function disposeGroup(group) {
  group.traverse((child) => {
    if (child.geometry) child.geometry.dispose()
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m.dispose())
      } else {
        child.material.dispose()
      }
    }
  })
  group.clear()
}

// --- LAYER LOGIC (Dimensions & BBox) ---

function toggleDimensions(visible) {
  if (!dimensionsGroup) {
    dimensionsGroup = new THREE.Group()
    scene.add(dimensionsGroup)
  }
  dimensionsGroup.visible = visible
  if (visible) {
    updateDimensions()
  } else {
    // FIX: Explicitly dispose to remove HTML labels from DOM
    disposeGroup(dimensionsGroup)
  }
}

function toggleBBox(visible) {
  if (!bboxGroup) {
    bboxGroup = new THREE.Group()
    scene.add(bboxGroup)
  }
  bboxGroup.visible = visible
  if (visible) {
    updateBBox()
  } else {
    disposeGroup(bboxGroup)
  }
}

function updateDimensions() {
  if (!dimensionsGroup || !modelContainer) return
  
  disposeGroup(dimensionsGroup)

  // 1. Agrupar mallas por el índice de su torre
  const towers = {}
  const towerMap = []
  if (props.points) {
    props.points.forEach((tower, tIndex) => {
      if (tower.program) {
        tower.program.forEach(() => towerMap.push(tIndex))
      }
    })
  }

  modelContainer.traverse(child => {
    if (child.isMesh) {
      const tIndex = towerMap[child.userData.meshIndex]
      if (tIndex !== undefined) {
        if (!towers[tIndex]) towers[tIndex] = []
        towers[tIndex].push(child)
      }
    }
  })

  // Material for dimension lines
  const lineMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 })

  // Helper para crear cota
  const createDim = (start, end, labelPos, text) => {
    const geom = new THREE.BufferGeometry().setFromPoints([start, end])
    const line = new THREE.Line(geom, lineMat)
    dimensionsGroup.add(line)

    const div = document.createElement('div')
    div.className = 'dimension-label'
    div.textContent = text
    const label = new CSS2DObject(div)
    label.position.copy(labelPos)
    dimensionsGroup.add(label)
  }

  // 2. Iterar sobre cada torre y dibujar sus cotas
  for (const tIndex in towers) {
    const towerMeshes = towers[tIndex]
    if (towerMeshes.length === 0) continue

    const towerBox = new THREE.Box3()
    towerMeshes.forEach(mesh => {
      const meshBox = new THREE.Box3().setFromObject(mesh, true)
      if (towerBox.isEmpty()) towerBox.copy(meshBox)
      else towerBox.union(meshBox)
    })

    if (towerBox.isEmpty()) continue

    const size = towerBox.getSize(new THREE.Vector3())
    const min = towerBox.min
    const max = towerBox.max
    const center = towerBox.getCenter(new THREE.Vector3())
    const offset = 5 // Distancia de la cota al objeto

    // Cota X (Ancho) - Al frente de la torre
    createDim(
      new THREE.Vector3(min.x, min.y, max.z + offset),
      new THREE.Vector3(max.x, min.y, max.z + offset),
      new THREE.Vector3(center.x, min.y, max.z + offset),
      `W: ${size.x.toFixed(1)}m`
    )
    // Cota Y (Alto) - A la derecha de la torre
    createDim(
      new THREE.Vector3(max.x + offset, min.y, center.z),
      new THREE.Vector3(max.x + offset, max.y, center.z),
      new THREE.Vector3(max.x + offset, center.y, center.z),
      `H: ${size.y.toFixed(1)}m`
    )
    // Cota Z (Profundidad) - A la izquierda de la torre
    createDim(
      new THREE.Vector3(min.x - offset, min.y, min.z),
      new THREE.Vector3(min.x - offset, min.y, max.z),
      new THREE.Vector3(min.x - offset, min.y, center.z),
      `D: ${size.z.toFixed(1)}m`
    )
  }
}

function updateBBox() {
  if (!bboxGroup || !modelContainer) return
  disposeGroup(bboxGroup)

  // FIX: Forzamos 'true' para que lea los vértices precisos escalados y no la caché
  const box = new THREE.Box3().setFromObject(modelContainer, true);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  // Creamos una geometría de caja y extraemos sus bordes
  const boxGeom = new THREE.BoxGeometry(size.x, size.y, size.z);
  const edges = new THREE.EdgesGeometry(boxGeom);

  // Usamos un material de línea punteada
  const lineMat = new THREE.LineDashedMaterial({
    color: 0xcccccc, // Gris muy claro
    dashSize: 0.2,   // Longitud del guion
    gapSize: 0.2,    // Espacio entre guiones
  });

  const line = new THREE.LineSegments(edges, lineMat);
  line.position.copy(center); // Movemos la caja a la posición correcta
  line.computeLineDistances(); // Necesario para que se renderice el punteado

  bboxGroup.add(line);
}

// --- COLLISION DETECTION LOGIC ---
function checkCollisions() {
  if (!modelContainer) return;

  // 1. FORZAR ACTUALIZACIÓN DE MATRICES: Vital para que el BBox considere la rotación del mundo
  modelContainer.updateMatrixWorld(true);
  const meshes = [];
  modelContainer.traverse(c => {
    if (c.isMesh) meshes.push(c);
  });
  
  const towers = {};

  // 2. MAPEO EXACTO: Vinculamos cada malla a su torre contando los programas.
  // Esto asegura que bloques de una misma torre nunca se evalúen como torres separadas.
  const towerMap = [];
  if (props.points) {
    props.points.forEach((tower, tIndex) => {
      if (tower.program) {
        tower.program.forEach(() => {
          towerMap.push(tIndex);
        });
      }
    });
  }

  meshes.forEach(m => {
     // Calcular la caja usando vértices precisos, para evitar que geometrías compartidas inflen la caja global
     const meshBox = new THREE.Box3().setFromObject(m, true);
     m.userData.isColliding = false;
     
     // Asignamos la torre leyendo el índice de generación (mismo sistema que los colores)
     let tIndex = towerMap[m.userData.meshIndex];
     if (tIndex === undefined) tIndex = -1; // Fallback de seguridad

     m.userData.towerIndex = tIndex;

     if (tIndex >= 0) {
       if (!towers[tIndex]) {
         towers[tIndex] = {
           index: tIndex,
           aabb: new THREE.Box3(),
           isColliding: false
         };
       }
       if (towers[tIndex].aabb.isEmpty()) {
         towers[tIndex].aabb.copy(meshBox);
       } else {
         towers[tIndex].aabb.union(meshBox);
       }
     }
  });

  const collisionPairs = [];
  const towerIndices = Object.keys(towers).map(Number);

  for(let i=0; i < towerIndices.length; i++) {
    for(let j=i+1; j < towerIndices.length; j++) {
       const t1 = towers[towerIndices[i]];
       const t2 = towers[towerIndices[j]];
       
       // DEBUG: Cambiado a 0.0 para ver colisiones exactas. 
       // Si quieres que detecte la colisión antes de tocarse, pon un valor positivo (ej: 2.0).
       const box1 = t1.aabb.clone().expandByScalar(0.0);
       const box2 = t2.aabb.clone().expandByScalar(0.0);

       if (box1.intersectsBox(box2)) {
          t1.isColliding = true;
          t2.isColliding = true;
          
          collisionPairs.push({ 
             t1: t1.index, 
             t2: t2.index, 
             box1: box1, 
             box2: box2 
          });
       }
    }
  }

  meshes.forEach(m => {
     if (m.userData.towerIndex >= 0 && towers[m.userData.towerIndex] && towers[m.userData.towerIndex].isColliding) {
        m.userData.isColliding = true;
     } else {
        m.userData.isColliding = false;
     }
     // Aplicar o retirar el tinte rojo sutil
     m.material.emissive.setHex(m.userData.isColliding ? 0x550000 : 0x000000);
  });
  
  emits('collisions-detected', collisionPairs);
}

// --- EXTRACTION HELPER ---
function extractMeshInfo(obj) {
  const info = {}
  info['Name'] = (obj.name && obj.name.startsWith('GH_Path')) ? 'Program Segment' : (obj.name || 'Geometry')
  info['ID'] = obj.userData.stableID || obj.uuid
  info['UUID'] = obj.uuid
  info['Type'] = 'Mesh'

  // Usamos el bounding box real del objeto transformado para las tarjetas en tiempo real
  const box = new THREE.Box3().setFromObject(obj)
  const size = new THREE.Vector3()
  box.getSize(size)
  info['Dimensions'] = `${size.x.toFixed(1)}m x ${size.z.toFixed(1)}m`
  info['Height'] = `${size.y.toFixed(1)}m`

  const geom = obj.geometry
  if (geom && geom.attributes.position) {
    let area = 0
    const pos = geom.attributes.position
    const index = geom.index
    const count = index ? index.count / 3 : pos.count / 3
    const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3()
    const tri = new THREE.Triangle()

    for (let i = 0; i < count; i++) {
      if (index) {
        va.fromBufferAttribute(pos, index.getX(i * 3 + 0))
        vb.fromBufferAttribute(pos, index.getX(i * 3 + 1))
        vc.fromBufferAttribute(pos, index.getX(i * 3 + 2))
      } else {
        va.fromBufferAttribute(pos, i * 3 + 0)
        vb.fromBufferAttribute(pos, i * 3 + 1)
        vc.fromBufferAttribute(pos, i * 3 + 2)
      }
      tri.set(va, vb, vc)
      area += tri.getArea()
    }
    info['Surface Area'] = `${area.toFixed(2)} m²`
  }

  if (obj.userData && obj.userData.attributes && obj.userData.attributes.userStrings) {
     for (const [k, v] of Object.entries(obj.userData.attributes.userStrings)) info[k] = v
  }
  return info
}

// --- OBJECT & POINT SELECTION LOGIC ---

function onMouseDown(event) {
  isDragging = false
  mouseDownPos.set(event.clientX, event.clientY)
}

function onMouseUp(event) {
  // If mouse moved less than 5px, it's a click, not a drag
  const dx = event.clientX - mouseDownPos.x
  const dy = event.clientY - mouseDownPos.y
  if (Math.sqrt(dx * dx + dy * dy) < 5) {
    onMouseClick(event)
  }
}

function onMouseClick(event) {
  if (!container || !camera || !modelContainer) return

  // 1. Calculate normalized mouse coordinates (-1 to +1)
  const rect = container.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

  // 2. Raycast
  raycaster.setFromCamera(mouse, camera)
  // Find intersections recursively in modelContainer

  // 1.5 SELECCIONAR PUNTOS DE CONTROL
  const intersectsPoints = raycaster.intersectObjects(pointsGroup.children, true)
  if (intersectsPoints.length > 0) {
    const hit = intersectsPoints.find(i => i.object.userData.isPointControl)
    if (hit) {
      emits('select-tower', hit.object.userData.pointIndex)
      return
    }
  }

  // Evitar seleccionar mallas o piso si estamos interactuando directamente con un gumball
  const isAnyGumballHovered = transformControls.some(tc => tc.axis !== null)
  if (isAnyGumballHovered) return

  const isContextGumballHovered = contextTransformControl && contextTransformControl.axis !== null
  if (isContextGumballHovered) return

  // 1. MODO EDICIÓN: Clic en el suelo virtual (matemático)
  if (props.editMode) {
    const virtualPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const pt = new THREE.Vector3()
    const intersected = raycaster.ray.intersectPlane(virtualPlane, pt)
    if (intersected) {
      // CONVERSIÓN INVERSA: Visual(Three) -> Data(Rhino)
      const rhinoPoint = { x: pt.x, y: -pt.z, z: pt.y } 
      emits('add-point', rhinoPoint)
      return // Detenemos aquí para no seleccionar objetos
    }
  }

  // 2. SELECCIÓN NORMAL DE OBJETOS
  const intersects = raycaster.intersectObjects(modelContainer.children, true)
  if (intersects.length > 0) {
    // Encontramos el primer objeto (el más cercano) que sea una malla
    const hit = intersects.find(i => i.object.isMesh)
    
    if (hit) {
      const obj = hit.object
      const info = extractMeshInfo(obj)

      // Emit event to parent to show the card
      emits('selectObject', { data: info, x: event.clientX, y: event.clientY, hitPoint: hit.point })
      return
    }
  }
}

// --- HOVER LOGIC (HIGHLIGHT) ---

function onMouseMove(event) {
  if (!container || !camera || !modelContainer) return

  // Si estamos arrastrando (mouse presionado), dejamos que OrbitControls maneje el cursor
  if (event.buttons > 0) return

  // 1. Calcular coordenadas mouse
  const rect = container.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

  // 2. Raycast
  raycaster.setFromCamera(mouse, camera)
  const intersects = raycaster.intersectObjects(modelContainer.children, true)
  const hit = intersects.find(i => i.object.isMesh)

  // Hover sobre los puntos de control
  const intersectsPoints = raycaster.intersectObjects(pointsGroup.children, true)
  if (intersectsPoints.length > 0) {
    container.style.cursor = 'pointer'
    return
  }

  // Cursor especial para modo edición
  if (props.editMode) {
    // Si estamos sobre el suelo (asumimos que siempre lo estamos en vista aérea), cursor crosshair
    container.style.cursor = 'crosshair'
    return
  }

  if (hit) {
    container.style.cursor = 'pointer' // Cambiar cursor a mano

    if (hoveredObject !== hit.object) {
      // Restaurar anterior
      if (hoveredObject) hoveredObject.material.emissive.setHex(hoveredObject.userData.isColliding ? 0x550000 : 0x000000)
      // Resaltar nuevo (Gris muy suave)
      hoveredObject = hit.object
      hoveredObject.material.emissive.set(props.highlightColor || '#444444')
    }
  } else {
    container.style.cursor = 'default' // Restaurar cursor

    if (hoveredObject) {
      hoveredObject.material.emissive.setHex(hoveredObject.userData.isColliding ? 0x550000 : 0x000000)
      hoveredObject = null
    }
  }
}

function getMeshData(id) {
  if (!modelContainer) return null
  let foundObj = null
  modelContainer.traverse((child) => {
    if (child.isMesh && child.userData.stableID === id) foundObj = child
  })
  
  if (foundObj) {
    const info = extractMeshInfo(foundObj)
    const box = new THREE.Box3().setFromObject(foundObj)
    return { data: info, hitPoint: box.getCenter(new THREE.Vector3()) }
  }
  return null
}

// EXPOSE: Funciones públicas para componentes externos
defineExpose({
  getRhinoDoc: () => lastDoc,
  getSceneObject: () => modelContainer && modelContainer.children.length > 0 ? modelContainer.children[0] : null,
  getCamera: () => camera,
  toggleCamera,
  setCameraView,
  toggleAutoRotation,
  getAutoRotationState,
  manualOrbit,
  resetCameraView,
  toggleDimensions,
  toggleBBox,
  getCameraState,
  setCameraState,
  setDisplayMode,
  toggleShadow,
  setTransformMode,
  getMeshData,
  loadContextFromBuffer,
  clearContext
})
</script>

<style scoped>
#viewport, #threejs-container {
  height: 100%; width: 100%; min-width: 200px;
}
/* Estilo para las etiquetas de cota HTML */
:deep(.dimension-label) {
  background: rgba(255, 255, 255, 0.8);
  padding: 2px 5px;
  border-radius: 4px;
  font-family: 'Roboto Mono', monospace;
  font-size: 0.7rem;
  font-weight: bold;
  color: #333;
  pointer-events: none;
}
</style>