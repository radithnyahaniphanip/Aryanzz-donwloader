// Same-origin module-worker bootstrap for ffmpeg.wasm. The package worker and its relative imports load from jsDelivr.
import("https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/worker.js").catch(error=>{self.postMessage({type:"LOAD",data:{error:String(error?.message||error)}});});
