import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktop", {
  isDesktop: true,
  getLocalToken: () => ipcRenderer.invoke("auth:get-local-token"),
  keychain: {
    isAvailable: () => ipcRenderer.invoke("keychain:is-available"),
    getKey: (provider: string) => ipcRenderer.invoke("keychain:get-key", provider),
    setKey: (provider: string, apiKey: string) => ipcRenderer.invoke("keychain:set-key", provider, apiKey),
    deleteKey: (provider: string) => ipcRenderer.invoke("keychain:delete-key", provider),
    listProviders: () => ipcRenderer.invoke("keychain:list-providers"),
    clearAll: () => ipcRenderer.invoke("keychain:clear-all"),
  },
  llamafile: {
    getStatus: () => ipcRenderer.invoke("llamafile:get-status"),
    getPort: () => ipcRenderer.invoke("llamafile:get-port"),
    listModels: () => ipcRenderer.invoke("llamafile:list-models"),
    downloadModel: (modelId: string) => ipcRenderer.invoke("llamafile:download-model", modelId),
    deleteModel: (modelId: string) => ipcRenderer.invoke("llamafile:delete-model", modelId),
    setActiveModel: (modelId: string) => ipcRenderer.invoke("llamafile:set-active-model", modelId),
    getActiveModel: () => ipcRenderer.invoke("llamafile:get-active-model"),
  },
});
