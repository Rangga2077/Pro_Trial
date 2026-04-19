import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    sendMessage: (message: string) => ipcRenderer.send('message', message),
    getDisplays: () => ipcRenderer.invoke('get-displays'),
    moveToDisplay: (displayId: number) => ipcRenderer.invoke('move-to-display', displayId),
});
