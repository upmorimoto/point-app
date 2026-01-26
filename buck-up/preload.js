const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  onModeChange: (callback) =>
    ipcRenderer.on("mode-change", (event, mode) => callback(mode)),
  onSpawnSpark: (callback) =>
    ipcRenderer.on("spawn-spark", (event, pos) => callback(pos)),
});
