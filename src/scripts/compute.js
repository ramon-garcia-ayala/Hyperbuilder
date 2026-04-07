import rhino3dm from "https://cdn.jsdelivr.net/npm/rhino3dm@8.0.0-beta2/rhino3dm.module.js"
import RhinoCompute from "compute-rhino3d"
import { store } from "../stores/storeSingletons"

RhinoCompute.url = "https://compute8.iaac.net/"
RhinoCompute.apiKey = "macad2026"

let rhino, doc, res

async function runCompute(data, path) {
  store.computing = true;
  let def = await loadGH(path);
  res = await compute(def, data);
  doc = createDoc(res);
  store.computing = false;
  return doc;
}

async function loadRhino() {
  return new Promise((resolve, reject) => {
    RhinoCompute.url.includes("localhost")
    ? console.log("Using LOCAL compute server")
    : console.log("Using REMOTE compute server");

    rhino3dm().then(async (m) => {
      console.log("Loaded rhino3dm.");
      rhino = m;
      resolve(true)
    });
  })
}

async function loadGH(definitionPath) {
  const url = definitionPath;
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  const def = new Uint8Array(buffer);
  return def;
}

async function compute(definition, definitionInputs) {
  const startTime = performance.now();

  const trees = [];
  for (let [key, value] of Object.entries(definitionInputs)) {
    let param = new RhinoCompute.Grasshopper.DataTree(key);
    param.append([0], Array.isArray(value) ? value : [value]);
    trees.push(param);
  }

  const res = await RhinoCompute.Grasshopper.evaluateDefinition(
    definition,
    trees
  );

  const endTime = performance.now();
  const duration = (endTime - startTime) / 1000;
  console.log(`Gh script: ${duration.toFixed(3)} seconds`);
  return res;
}

function createDoc(res) {
  doc = new rhino.File3dm()

  let data;
  let metadata = [];

  for (let i = 0; i < res.values.length; i++) {
    for (const [key, value] of Object.entries(res.values[i].InnerTree)) {
      for (const d of value) {
        const dataType = String(d.type);

        if (dataType.includes("Geometry")) {
          data = JSON.parse(d.data);
          const rhinoObject = rhino.CommonObject.decode(data);
          doc.objects().add(rhinoObject, null);
        } else {
          const outputParameter = {
            name: res.values[i].ParamName,
            value: JSON.parse(d.data),
          };
          metadata.push(outputParameter);
        }
      }
    }
  }

  doc.metadata = metadata;

  let objects = doc.objects();
  for (let i = 0; i < objects.count; i++) {
    const rhinoObject = objects.get(i);
    if (rhinoObject.geometry().userStringCount > 0) {
      const g_userStrings = rhinoObject.geometry().getUserStrings();
      for (let j = 0; j < g_userStrings.length; j++) {
        rhinoObject
          .attributes()
          .setUserString(g_userStrings[j][0], g_userStrings[j][1]);
      }
    }
  }
  return doc;
}

function download(fileName) {
  const options = new rhino.File3dmWriteOptions();
  options.version = 7;
  let buffer = doc.toByteArrayOptions(options);
  let blob = new Blob([buffer], { type: "application/octect-stream" });
  let link = document.createElement("a");
  link.href = window.URL.createObjectURL(blob);
  link.download = fileName+'.3dm';
  link.click();
}

function base64ByteArray(bytes) {
  var base64 = ''
  var encodings = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

  if (bytes[0] === 239 && bytes[1] === 187 && bytes[2] === 191)
    bytes = bytes.slice(3)

  var byteLength = bytes.byteLength
  var byteRemainder = byteLength % 3
  var mainLength = byteLength - byteRemainder

  var a, b, c, d
  var chunk

  for (var i = 0; i < mainLength; i = i + 3) {
    chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]
    a = (chunk & 16515072) >> 18
    b = (chunk & 258048) >> 12
    c = (chunk & 4032) >> 6
    d = chunk & 63
    base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d]
  }

  if (byteRemainder == 1) {
    chunk = bytes[mainLength]
    a = (chunk & 252) >> 2
    b = (chunk & 3) << 4
    base64 += encodings[a] + encodings[b] + '=='
  } else if (byteRemainder == 2) {
    chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1]
    a = (chunk & 64512) >> 10
    b = (chunk & 1008) >> 4
    c = (chunk & 15) << 2
    base64 += encodings[a] + encodings[b] + encodings[c] + '='
  }

  return base64
}

export { loadRhino, runCompute, base64ByteArray, download, rhino };
