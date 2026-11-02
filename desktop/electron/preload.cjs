const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('bizora', Object.freeze({
  getVersion: () => ipcRenderer.invoke('app:get-version')
}))
