<template>
  <Transition name="ws-fade">
    <div v-if="visible" class="ws-overlay" :class="{ 'is-tour': phase === 'tour' }">

      <!-- ── WELCOME PHASE ── -->
      <div v-if="phase === 'welcome'" class="ws-welcome">
        <img :src="hbLogo" class="ws-logo" alt="HyperBuilder" />
        <div class="ws-rule"></div>
        <p class="ws-desc">
          A parametric design tool for generating and exploring<br />
          vertical mixed-use communities in real time,<br />
          powered by Rhino Compute + Grasshopper.
        </p>
        <div class="ws-actions">
          <button class="ws-btn ws-primary" @click="emit('start')">START DESIGNING</button>
          <button class="ws-btn ws-outline" @click="beginTour">TAKE A TOUR &nbsp;→</button>
        </div>
        <div class="ws-footer">IAAC · HyperBuilder v2.0</div>
      </div>

      <!-- ── TOUR PHASE ── -->
      <div v-if="phase === 'tour'" class="ws-tour">
        <!-- Global progress bar -->
        <div class="tour-track">
          <div class="tour-bar" :style="{ width: progressPct }"></div>
        </div>

        <div class="tour-card">
          <div class="tour-step-label">STEP {{ currentStep + 1 }} OF {{ steps.length }}</div>

          <!-- CSS Illustration -->
          <div class="tour-illus">
            <!-- 1: Viewport -->
            <div v-if="currentStep === 0" class="illus-viewport">
              <div class="iv-screen">
                <div class="iv-cube">
                  <div class="iv-face iv-top"></div>
                  <div class="iv-face iv-front"></div>
                  <div class="iv-face iv-side"></div>
                </div>
              </div>
              <div class="iv-hints">
                <span>🖱 ORBIT</span><span>⚲ ZOOM</span><span>⇥ PAN</span>
              </div>
            </div>

            <!-- 2: Add towers -->
            <div v-else-if="currentStep === 1" class="illus-grid">
              <div v-for="i in 9" :key="i" class="ig-cell" :class="{ active: i === 5 }">
                <div class="ig-dot"></div>
              </div>
              <div class="ig-label">CLICK TO PLACE</div>
            </div>

            <!-- 3: Programs -->
            <div v-else-if="currentStep === 2" class="illus-programs">
              <div class="ip-tower">
                <div class="ip-bar" style="height:30px;background:#f2dd1c"></div>
                <div class="ip-bar" style="height:22px;background:#2847fc"></div>
                <div class="ip-bar" style="height:18px;background:#e6194b"></div>
                <div class="ip-bar" style="height:26px;background:#3cb44b"></div>
              </div>
              <div class="ip-sliders">
                <div class="ip-row"><span>HOUSING</span><div class="ip-track"><div class="ip-fill" style="width:75%;background:#f2dd1c"></div></div></div>
                <div class="ip-row"><span>OFFICE</span><div class="ip-track"><div class="ip-fill" style="width:55%;background:#2847fc"></div></div></div>
                <div class="ip-row"><span>RETAIL</span><div class="ip-track"><div class="ip-fill" style="width:45%;background:#e6194b"></div></div></div>
                <div class="ip-row"><span>CIVIC</span><div class="ip-track"><div class="ip-fill" style="width:65%;background:#3cb44b"></div></div></div>
              </div>
            </div>

            <!-- 4: Randomize -->
            <div v-else-if="currentStep === 3" class="illus-random">
              <div class="ir-before">
                <div class="ir-bar" style="height:35px"></div>
                <div class="ir-bar" style="height:50px"></div>
                <div class="ir-bar" style="height:25px"></div>
              </div>
              <div class="ir-arrow">🎲</div>
              <div class="ir-after">
                <div class="ir-bar" style="height:48px;background:#f2dd1c"></div>
                <div class="ir-bar" style="height:28px;background:#2847fc"></div>
                <div class="ir-bar" style="height:42px;background:#e6194b"></div>
              </div>
            </div>

            <!-- 5: Display & Navigate -->
            <div v-else-if="currentStep === 4" class="illus-display">
              <div class="id-modes">
                <div class="id-mode active"><div class="id-shape shaded"></div><span>SHADED</span></div>
                <div class="id-mode"><div class="id-shape wireframe"></div><span>WIRE</span></div>
                <div class="id-mode"><div class="id-shape arctic"></div><span>ARCTIC</span></div>
                <div class="id-mode"><div class="id-shape rendered"></div><span>RENDER</span></div>
              </div>
            </div>

            <!-- 6: Export & Analytics -->
            <div v-else-if="currentStep === 5" class="illus-export">
              <div class="ie-btns">
                <div class="ie-btn"><span>3DM</span></div>
                <div class="ie-btn"><span>DXF</span></div>
                <div class="ie-btn accent"><span>PNG</span></div>
              </div>
              <div class="ie-chart">
                <div class="ie-col" style="height:40px;background:#f2dd1c"></div>
                <div class="ie-col" style="height:60px;background:#2847fc"></div>
                <div class="ie-col" style="height:30px;background:#e6194b"></div>
                <div class="ie-col" style="height:50px;background:#3cb44b"></div>
              </div>
            </div>

            <!-- 7: Ready -->
            <div v-else-if="currentStep === 6" class="illus-ready">
              <div class="ird-blocks">
                <div class="ird-b" style="height:28px;animation-delay:0s"></div>
                <div class="ird-b" style="height:55px;animation-delay:.15s;background:#f2dd1c"></div>
                <div class="ird-b" style="height:38px;animation-delay:.30s"></div>
                <div class="ird-b" style="height:65px;animation-delay:.45s;background:#2847fc"></div>
                <div class="ird-b" style="height:42px;animation-delay:.60s"></div>
              </div>
              <div class="ird-text">YOU'RE READY TO BUILD</div>
            </div>
          </div>

          <div class="tour-title">{{ steps[currentStep].title }}</div>
          <p class="tour-desc">{{ steps[currentStep].desc }}</p>

          <div class="tour-nav">
            <button class="tn-skip" @click="emit('start')">SKIP</button>
            <div class="tn-right">
              <button v-if="currentStep > 0" class="tn-prev" @click="currentStep--">←</button>
              <button v-if="currentStep < steps.length - 1" class="tn-next" @click="currentStep++">NEXT →</button>
              <button v-else class="tn-next tn-finish" @click="emit('start')">START DESIGNING →</button>
            </div>
          </div>
        </div>
      </div>

    </div>
  </Transition>
</template>

<script setup>
import { ref, computed } from 'vue'
import hbLogo from '@/assets/HB_Logo_01.png'

defineProps({ visible: { type: Boolean, default: true } })
const emit = defineEmits(['start'])

const phase = ref('welcome')   // 'welcome' | 'tour'
const currentStep = ref(0)

const steps = [
  {
    title: 'THE 3D VIEWPORT',
    desc: 'Your design canvas. Orbit by dragging with the left mouse button, zoom with the scroll wheel, and pan with the right button. Use the ViewCube to snap to standard orthographic views.'
  },
  {
    title: 'ADDING TOWERS',
    desc: 'Open the left panel and activate Edit Mode. Then click anywhere on the viewport grid to place a tower. Each tower is fully independent and can be moved, rotated, and scaled.'
  },
  {
    title: 'CONFIGURING PROGRAMS',
    desc: 'Select a tower tab and use the sliders to set its floor program mix — housing, office, retail, and more. Each program segment maps directly to a floor stack in the 3D model.'
  },
  {
    title: 'RANDOMIZE',
    desc: 'Hit the 🎲 button to instantly generate a random program distribution across all sliders. The viewport will zoom to fit the new geometry automatically.'
  },
  {
    title: 'DISPLAY MODES',
    desc: 'Switch between Shaded, Wireframe, Arctic, and Rendered display modes from the DISPLAY panel. Toggle dimension lines, bounding boxes, and shadows from the LAYERS panel.'
  },
  {
    title: 'EXPORT & ANALYTICS',
    desc: 'Export your model as .3DM (Rhino), .DXF (AutoCAD), or .PNG. Open the Analytics panel on the right to visualize floor area distributions and program breakdowns per tower.'
  },
  {
    title: 'YOU\'RE READY',
    desc: 'That covers the essentials. Explore freely — every change triggers a live recompute via Grasshopper. Save snapshots using Version History to compare design iterations.'
  }
]

const progressPct = computed(() =>
  `${((currentStep.value + 1) / steps.length) * 100}%`
)

function beginTour() {
  currentStep.value = 0
  phase.value = 'tour'
}
</script>

<style scoped>
/* ── OVERLAY ── */
.ws-overlay {
  position: fixed;
  inset: 0;
  z-index: 9000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}
.ws-overlay.is-tour {
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

/* ── WELCOME ── */
.ws-welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  animation: wsFadeUp 0.6s ease both;
}

.ws-title {
  font-family: 'Roboto Mono', monospace;
  font-size: 2rem;
  font-weight: bold;
  letter-spacing: 8px;
  color: #000;
  animation: wsFadeUp 0.5s 0.2s ease both;
}

.ws-logo {
  width: 160px;
  height: auto;
  animation: wsFadeUp 0.5s 0.1s ease both;
}

.ws-rule {
  width: 40px;
  height: 2px;
  background: #f2dd1c;
  margin: 20px 0;
  animation: wsFadeUp 0.5s 0.3s ease both;
}

.ws-desc {
  font-family: 'Roboto Mono', monospace;
  font-size: 0.72rem;
  color: #555;
  text-align: center;
  line-height: 1.9;
  margin: 0 0 36px;
  animation: wsFadeUp 0.5s 0.4s ease both;
}

.ws-actions {
  display: flex;
  gap: 12px;
  animation: wsFadeUp 0.5s 0.5s ease both;
}

.ws-btn {
  font-family: 'Roboto Mono', monospace;
  font-size: 0.7rem;
  font-weight: bold;
  letter-spacing: 1.5px;
  padding: 14px 28px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.ws-primary {
  background: #000;
  color: #fff;
  border: 2px solid #000;
}
.ws-primary:hover { background: #222; }

.ws-outline {
  background: transparent;
  color: #000;
  border: 2px solid rgba(0,0,0,0.2);
}
.ws-outline:hover { border-color: #000; background: rgba(0,0,0,0.03); }

.ws-footer {
  font-family: 'Roboto Mono', monospace;
  font-size: 0.6rem;
  color: #bbb;
  letter-spacing: 2px;
  margin-top: 48px;
  animation: wsFadeUp 0.5s 0.6s ease both;
}

/* ── TOUR ── */
.tour-track {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: 3px;
  background: rgba(255,255,255,0.15);
  z-index: 1;
}
.tour-bar {
  height: 100%;
  background: #f2dd1c;
  transition: width 0.4s ease;
}

.tour-card {
  background: #fff;
  border-radius: 16px;
  padding: 36px 40px 28px;
  width: min(480px, 92vw);
  animation: wsFadeUp 0.35s ease both;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tour-step-label {
  font-family: 'Roboto Mono', monospace;
  font-size: 0.6rem;
  letter-spacing: 2px;
  color: #bbb;
  font-weight: bold;
}

.tour-illus {
  width: 100%;
  height: 110px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f8f8;
  border-radius: 10px;
  overflow: hidden;
}

.tour-title {
  font-family: 'Roboto Mono', monospace;
  font-size: 0.85rem;
  font-weight: bold;
  letter-spacing: 3px;
  color: #000;
}

.tour-desc {
  font-family: 'Roboto Mono', monospace;
  font-size: 0.68rem;
  color: #555;
  line-height: 1.8;
  margin: 0;
}

.tour-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 8px;
  border-top: 1px solid #f0f0f0;
}
.tn-skip {
  font-family: 'Roboto Mono', monospace;
  font-size: 0.6rem;
  color: #bbb;
  background: none;
  border: none;
  cursor: pointer;
  letter-spacing: 1px;
  padding: 4px;
}
.tn-skip:hover { color: #888; }
.tn-right { display: flex; gap: 8px; }

.tn-prev, .tn-next {
  font-family: 'Roboto Mono', monospace;
  font-size: 0.65rem;
  font-weight: bold;
  padding: 10px 18px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  letter-spacing: 1px;
}
.tn-prev {
  background: #f5f5f5;
  border: 1px solid #eee;
  color: #333;
}
.tn-prev:hover { background: #eee; }
.tn-next {
  background: #000;
  border: 1px solid #000;
  color: #fff;
}
.tn-next:hover { background: #222; }
.tn-finish {
  background: #f2dd1c;
  border-color: #f2dd1c;
  color: #000;
}
.tn-finish:hover { background: #e0cc1b; }

/* ── TRANSITION ── */
.ws-fade-enter-active { transition: opacity 0.4s ease; }
.ws-fade-leave-active { transition: opacity 0.5s ease; }
.ws-fade-enter-from, .ws-fade-leave-to { opacity: 0; }

@keyframes wsFadeUp {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ══════════════════════════════
   ILLUSTRATIONS
══════════════════════════════ */

/* 1 – Viewport */
.illus-viewport {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.iv-screen {
  width: 90px; height: 60px;
  border: 2px solid #000;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f0f0;
}
.iv-cube {
  width: 34px; height: 34px;
  position: relative;
  transform: rotateX(-20deg) rotateY(30deg);
  transform-style: preserve-3d;
}
.iv-face {
  position: absolute;
  background: #fff;
  border: 1.5px solid #000;
}
.iv-top    { width:20px;height:20px; top:0; left:7px; transform: rotateX(90deg) translateZ(10px); }
.iv-front  { width:20px;height:20px; top:7px; left:7px; }
.iv-side   { width:20px;height:20px; top:7px; left:14px; transform: rotateY(90deg) translateZ(7px); }
.iv-hints {
  display: flex; gap: 10px;
  font-family: 'Roboto Mono', monospace;
  font-size: 0.55rem; color: #888;
}

/* 2 – Grid */
.illus-grid {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  position: relative;
}
.ig-cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.illus-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding: 12px;
  position: relative;
  width: 100px;
}
.ig-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #ccc;
}
.ig-cell.active .ig-dot {
  background: #f2dd1c;
  box-shadow: 0 0 0 4px rgba(242,221,28,0.3);
  width: 12px; height: 12px;
}
.ig-label {
  position: absolute;
  bottom: -4px;
  font-family: 'Roboto Mono', monospace;
  font-size: 0.5rem;
  color: #aaa;
  letter-spacing: 1px;
  grid-column: 1 / -1;
  white-space: nowrap;
}

/* 3 – Programs */
.illus-programs {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 16px;
}
.ip-tower {
  display: flex;
  flex-direction: column-reverse;
  gap: 2px;
  height: 80px;
  justify-content: flex-start;
}
.ip-bar {
  width: 20px;
  border-radius: 2px;
  opacity: 0.9;
}
.ip-sliders {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}
.ip-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.ip-row span {
  font-family: 'Roboto Mono', monospace;
  font-size: 0.48rem;
  color: #888;
  width: 40px;
}
.ip-track {
  flex: 1;
  height: 4px;
  background: #eee;
  border-radius: 2px;
  overflow: hidden;
}
.ip-fill {
  height: 100%;
  border-radius: 2px;
}

/* 4 – Randomize */
.illus-random {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 0 20px;
}
.ir-before, .ir-after {
  display: flex;
  align-items: flex-end;
  gap: 4px;
}
.ir-bar {
  width: 12px;
  background: #ccc;
  border-radius: 2px 2px 0 0;
}
.ir-after .ir-bar {
  border-radius: 2px 2px 0 0;
}
.ir-arrow {
  font-size: 1.5rem;
  padding-bottom: 4px;
}

/* 5 – Display modes */
.illus-display {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 0 16px;
}
.id-modes {
  display: flex;
  gap: 12px;
}
.id-mode {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  opacity: 0.5;
}
.id-mode.active { opacity: 1; }
.id-mode span {
  font-family: 'Roboto Mono', monospace;
  font-size: 0.45rem;
  color: #555;
  letter-spacing: 0.5px;
}
.id-shape {
  width: 36px; height: 36px;
  border-radius: 4px;
}
.id-shape.shaded  { background: linear-gradient(135deg, #ddd 50%, #bbb 50%); border: 1.5px solid #999; }
.id-shape.wireframe { background: transparent; border: 1.5px solid #000; background-image: repeating-linear-gradient(0deg,#ddd,#ddd 1px,transparent 1px,transparent 6px), repeating-linear-gradient(90deg,#ddd,#ddd 1px,transparent 1px,transparent 6px); }
.id-shape.arctic  { background: #fff; border: 1.5px solid #ddd; }
.id-shape.rendered { background: linear-gradient(135deg, #f2dd1c 40%, #2847fc 40%); border: 1.5px solid transparent; }

/* 6 – Export & Analytics */
.illus-export {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 0 20px;
}
.ie-btns { display: flex; flex-direction: column; gap: 4px; }
.ie-btn {
  background: #f5f5f5;
  border: 1px solid #eee;
  border-radius: 4px;
  padding: 4px 10px;
  font-family: 'Roboto Mono', monospace;
  font-size: 0.55rem;
  font-weight: bold;
  color: #333;
}
.ie-btn.accent { background: #f2dd1c; border-color: #f2dd1c; }
.ie-chart {
  display: flex;
  align-items: flex-end;
  gap: 5px;
}
.ie-col {
  width: 14px;
  border-radius: 2px 2px 0 0;
}

/* 7 – Ready */
.illus-ready {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: 100%;
}
.ird-blocks {
  display: flex;
  align-items: flex-end;
  gap: 6px;
}
.ird-b {
  width: 12px;
  background: #000;
  border-radius: 2px 2px 0 0;
  transform-origin: bottom;
  animation: irdRise 1.4s ease-in-out infinite;
}
@keyframes irdRise {
  0%, 100% { transform: scaleY(0); opacity: 0; }
  30%, 70%  { transform: scaleY(1); opacity: 1; }
}
.ird-text {
  font-family: 'Roboto Mono', monospace;
  font-size: 0.6rem;
  letter-spacing: 2px;
  color: #333;
  font-weight: bold;
}

/* ── MOBILE ── */
@media (max-width: 768px) {
  .ws-title { font-size: 1.3rem; letter-spacing: 5px; }
  .ws-actions { flex-direction: column; width: 80vw; }
  .ws-btn { text-align: center; }
  .tour-card { padding: 24px 20px 20px; }
  .tour-illus { height: 90px; }
}
</style>
