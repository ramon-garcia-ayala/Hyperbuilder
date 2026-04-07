# HyperBuilder

A web-based parametric design tool for configuring multi-tower vertical communities. Built with Vue.js 3 and Three.js, it connects to a Rhino Compute backend to evaluate Grasshopper scripts and generate real-time 3D geometry.

![HyperBuilder](src/assets/HB_Logo_01.png)

## Features

- **Parametric Design** — Place multiple towers on a configurable grid and assign building programs (floor types, heights, densities) via sliders
- **Real-time Computation** — Sends parameters to a Rhino Compute server that evaluates a Grasshopper definition and returns 3D geometry
- **3D Visualization** — Interactive Three.js viewport with orbit controls, display modes (wireframe, arctic, shaded, rendered), and gumball transforms (move/rotate/scale per tower)
- **Analytics** — Live area breakdown charts by program type and per tower
- **Site Context** — Import external 3DM files (terrain, surroundings) and position them in the scene
- **Export** — Export to Rhino 3DM, OBJ (SketchUp), DXF (AutoCAD), or PNG screenshot
- **Version History** — Save and restore design snapshots with thumbnails

## Tech Stack

| Package | Purpose |
|---|---|
| Vue 3 + Pinia | UI framework and state management |
| Three.js | WebGL 3D rendering |
| compute-rhino3d | Client for Rhino Compute API |
| rhino3dm | Parse and decode Rhino geometry in the browser |
| Chart.js + vue-chartjs | Area analytics charts |
| html2canvas | Version snapshot thumbnails and PNG export |
| Vite | Build tool and dev server |

## Getting Started

### Prerequisites

- Node.js 18+
- Access to a running [Rhino Compute](https://www.rhino3d.com/compute/) server

### Installation

```bash
git clone https://github.com/ramon-garcia-ayala/Hyperbuilder.git
cd Hyperbuilder
npm install
```

### Development

```bash
npm run dev
```

Opens at `http://localhost:5173/Hyperbuilder/`

### Production Build

```bash
npm run build    # Output to /dist
npm run preview  # Preview the build locally
```

## Deployment

The app deploys automatically to GitHub Pages on every push to `master` via GitHub Actions.

Live URL: **https://ramon-garcia-ayala.github.io/Hyperbuilder/**

## Configuration

The Rhino Compute endpoint and API key are set in `src/scripts/compute.js`:

```js
RhinoCompute.url = 'https://compute8.iaac.net/'
RhinoCompute.apiKey = 'macad2026'
```

The Grasshopper definition used for tower generation is `src/assets/V2.0.0_Hyper-builder_Script.gh`.

## Project Structure

```
src/
├── assets/          # Logo, Grasshopper definitions (.gh)
├── components/      # Vue components (viewport, controls, charts, export)
├── scripts/
│   └── compute.js   # Rhino Compute client (load, evaluate, decode geometry)
├── stores/
│   └── computeStore.js  # Pinia store (computing state flag)
├── styles/          # Global CSS
└── App.vue          # Root component and main application logic
```

## License

IAAC — Institute for Advanced Architecture of Catalonia
