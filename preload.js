const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  onModeChange: (callback) =>
    ipcRenderer.on("mode-change", (_event, value) => callback(value)),
  onSpawnSpark: (callback) =>
    ipcRenderer.on("spawn-spark", (_event, value) => callback(value)),
  onGlobalKeydown: (callback) =>
    ipcRenderer.on("global-keydown", (_event, value) => callback(value)),
});
