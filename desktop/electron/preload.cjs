const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('bizora', Object.freeze({
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  database: Object.freeze({
    getSummary: () => ipcRenderer.invoke('db:summary'),
    listCustomers: limit => ipcRenderer.invoke('db:customers:list', limit),
    createCustomer: input => ipcRenderer.invoke('db:customers:create', input),
    listProducts: limit => ipcRenderer.invoke('db:products:list', limit),
    createProduct: input => ipcRenderer.invoke('db:products:create', input)
  })
}))
