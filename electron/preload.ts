import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  platform: process.platform,

  // App info
  getVersion: () => ipcRenderer.invoke("app:version"),

  // Window controls (for custom title bar if needed)
  minimize: () => ipcRenderer.invoke("window:minimize"),
  maximize: () => ipcRenderer.invoke("window:maximize"),
  close: () => ipcRenderer.invoke("window:close"),

  // Auto-update
  onUpdateAvailable: (callback: (info: { version: string }) => void) => {
    ipcRenderer.on("update-available", (_event, info) => callback(info));
  },
  onUpdateDownloaded: (callback: (info: { version: string }) => void) => {
    ipcRenderer.on("update-downloaded", (_event, info) => callback(info));
  },
  installUpdate: () => ipcRenderer.invoke("update:install"),
});
