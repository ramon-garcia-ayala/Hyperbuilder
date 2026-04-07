<template>
  <div id="viewport">
    <!-- To this element we will append our 3d scene. -->
    <div id="threejs-container-torus"></div>
  </div>
</template>

<script setup>
// Imports;
import { onMounted } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

const props = defineProps([
  'radius',
  'tube',
  'tubularSegments',
  'radialSegments',
])

// Three js objects
let renderer, camera, scene, controls, torus

let width = 600
let height = 700

function init() {
  // https://threejs.org/docs/#api/en/renderers/WebGLRenderer
  // This object will render our scene
  renderer = new THREE.WebGLRenderer()
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  // Rendered needs to know what's the size of the scene.
  renderer.setSize(width, height)
  renderer.setPixelRatio(window.devicePixelRatio)

  // We are taking element defined in <template> and appending our render to it.
  document
    .getElementById('threejs-container-torus')
    .appendChild(renderer.domElement)

  // https://threejs.org/docs/?q=scene#api/en/scenes/Scene
  scene = new THREE.Scene()
  scene.background = new THREE.Color('#ffffff')

  // https://threejs.org/docs/#api/en/cameras/PerspectiveCamera
  camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
  camera.position.set(0, 0, 40)

  // Add a spot light
  const spotLight = new THREE.SpotLight(0xebbd34, 2)
  spotLight.position.set(30, 50, 30)
  spotLight.castShadow = true // Enable shadows for the light

  scene.add(spotLight)

  // Add light helper
  const lightHelper = new THREE.SpotLightHelper(spotLight)
  scene.add(lightHelper)

  // add fun shape
  // 1. Create the geometry:
  const geometry = new THREE.TorusKnotGeometry(
    props.radius,
    props.tube,
    props.tubularSegments,
    props.radialSegments
  )

  // 2. Create the material:
  const material = new THREE.MeshNormalMaterial()

  // 3. Create the object
  torus = new THREE.Mesh(geometry, material)
  torus.castShadow = true // Enable shadows for the torus
  torus.receiveShadow = true // Enable the torus to receive shadows

  // 4. Add it to the scene
  scene.add(torus)

  // Orbit controls allow to rotate and zoom the camera
  // https://threejs.org/docs/?q=orbit%20contro#examples/en/controls/OrbitControls
  controls = new OrbitControls(camera, renderer.domElement)

  // Add a plane to receive shadows
  const planeGeometry = new THREE.PlaneGeometry(1000, 1000)

  // Assign shadow material to the plane
  // https://threejs.org/docs/#api/en/materials/ShadowMaterial
  const planeMaterial = new THREE.ShadowMaterial({
    opacity: 0.8,
    color: 0x948d96,
  })
  const plane = new THREE.Mesh(planeGeometry, planeMaterial)
  plane.rotation.x = -Math.PI / 2
  plane.position.y = -17
  plane.receiveShadow = true // Enable the plane to receive shadows
  scene.add(plane)

  animate()
}

// Render
function animate() {
  // https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame
  // native Javascript function that tells your browser you are animating!
  requestAnimationFrame(animate)

  // rotate torus a little bit each frame
  torus.rotation.x += 0.005
  torus.rotation.y += 0.005

  renderer.render(scene, camera)
}

// This will be run whenever this component is instantiated
onMounted(() => {
  init()
  animate()
})
</script>
