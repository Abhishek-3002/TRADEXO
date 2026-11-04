const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('tradexo', Object.freeze({
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  sync: Object.freeze({
    enqueue: (event) => ipcRenderer.invoke('sync:enqueue', event),
    pendingCount: () => ipcRenderer.invoke('sync:pending-count'),
    pushPending: (context) => ipcRenderer.invoke('sync:push-pending', context),
    pullEvents: (context, limit) => ipcRenderer.invoke('sync:pull-events', context, limit),
    acknowledgePulled: (context, cursor) => ipcRenderer.invoke('sync:acknowledge-pulled', context, cursor)
  })
}))
