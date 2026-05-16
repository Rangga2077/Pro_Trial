import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('electronAPI', {
    sendMessage: (message) => ipcRenderer.send('message', message),
    getDisplays: () => ipcRenderer.invoke('get-displays'),
    moveToDisplay: (displayId) => ipcRenderer.invoke('move-to-display', displayId),
});
//# sourceMappingURL=preload.js.map