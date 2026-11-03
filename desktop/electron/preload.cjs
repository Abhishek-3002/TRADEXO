const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('bizora', Object.freeze({
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  database: Object.freeze({
    getSummary: () => ipcRenderer.invoke('db:summary'),
    getCurrentCompany: () => ipcRenderer.invoke('db:company:current'),
    listCompanies: () => ipcRenderer.invoke('db:companies:list'),
    createCompany: input => ipcRenderer.invoke('db:companies:create', input),
    setActiveCompany: id => ipcRenderer.invoke('db:company:set-active', id),
    listCompanyGstins: id => ipcRenderer.invoke('db:company:gstins:list', id),
    addCompanyGstin: input => ipcRenderer.invoke('db:company:gstins:add', input),
    listCustomers: limit => ipcRenderer.invoke('db:customers:list', limit),
    createCustomer: input => ipcRenderer.invoke('db:customers:create', input),
    listProducts: limit => ipcRenderer.invoke('db:products:list', limit),
    createProduct: input => ipcRenderer.invoke('db:products:create', input)
  })
}))
