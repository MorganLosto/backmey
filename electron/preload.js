const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("backmey", {
  detect: () => ipcRenderer.invoke("detect"),
  list: (payload) => ipcRenderer.invoke("list", payload),
  backup: (payload) => ipcRenderer.invoke("backup", payload),
  restore: (payload) => ipcRenderer.invoke("restore", payload),
  inspect: (payload) => ipcRenderer.invoke("inspect", payload),
  selectDirectory: () => ipcRenderer.invoke("select-directory"),
  onProgress: (callback) => ipcRenderer.on("cli-progress", (_event, value) => callback(value)),
});
