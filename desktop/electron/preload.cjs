const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('tradexo', Object.freeze({
  getVersion: () => ipcRenderer.invoke('app:get-version')
}))
