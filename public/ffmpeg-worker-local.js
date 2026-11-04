// ARYANZZ local FFmpeg worker — no runtime CDN import for the worker wrapper.
const TYPE = {
  LOAD: "LOAD", EXEC: "EXEC", WRITE_FILE: "WRITE_FILE",
  READ_FILE: "READ_FILE", DELETE_FILE: "DELETE_FILE",
  ERROR: "ERROR", LOG: "LOG", PROGRESS: "PROGRESS"
};
let core = null;

async function loadCore(data) {
  const candidates = [
    { js: data.coreURL, wasm: data.wasmURL },
    { js: data.coreFallbackURL, wasm: data.wasmFallbackURL }
  ].filter(item => item.js && item.wasm);
  let lastError;
  for (const item of candidates) {
    try {
      const module = await import(item.js);
      const factory = module.default;
      if (typeof factory !== "function") throw new Error("Factory FFmpeg core tidak ditemukan.");
      const mainScriptUrlOrBlob = item.js + "#" + btoa(JSON.stringify({ wasmURL: item.wasm, workerURL: "" }));
      const instance = await factory({ mainScriptUrlOrBlob });
      instance.setLogger(event => self.postMessage({ type: TYPE.LOG, data: event }));
      instance.setProgress(event => self.postMessage({ type: TYPE.PROGRESS, data: event }));
      return instance;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error("Core FFmpeg gagal dimuat dari CDN utama maupun cadangan: " + String(lastError?.message || lastError));
}

self.onmessage = async ({ data: message }) => {
  const { id, type, data } = message || {};
  try {
    let result;
    switch (type) {
      case TYPE.LOAD:
        if (!core) core = await loadCore(data || {});
        result = true;
        break;
      case TYPE.EXEC:
        if (!core) throw new Error("Core FFmpeg belum dimuat.");
        core.setTimeout(Number(data?.timeout) > 0 ? Number(data.timeout) : -1);
        core.exec(...(data?.args || []));
        result = core.ret;
        core.reset();
        break;
      case TYPE.WRITE_FILE:
        if (!core) throw new Error("Core FFmpeg belum dimuat.");
        core.FS.writeFile(data.path, data.data);
        result = true;
        break;
      case TYPE.READ_FILE:
        if (!core) throw new Error("Core FFmpeg belum dimuat.");
        result = core.FS.readFile(data.path, { encoding: data.encoding || "binary" });
        break;
      case TYPE.DELETE_FILE:
        if (!core) throw new Error("Core FFmpeg belum dimuat.");
        core.FS.unlink(data.path);
        result = true;
        break;
      default:
        throw new Error("Perintah worker tidak dikenal: " + String(type));
    }
    const transfer = result instanceof Uint8Array ? [result.buffer] : [];
    self.postMessage({ id, type, data: result }, transfer);
  } catch (error) {
    self.postMessage({ id, type: TYPE.ERROR, data: String(error?.message || error) });
  }
};