export interface ElectronDisplay {
    id: number;
    bounds: Electron.Rectangle;
    size: Electron.Size;
    isPrimary: boolean;
}

export interface IElectronAPI {
    sendMessage: (message: string) => void;
    getDisplays: () => Promise<ElectronDisplay[]>;
    moveToDisplay: (displayId: number) => Promise<{success: boolean, error?: string}>;
}

declare global {
    interface Window {
        electronAPI: IElectronAPI;
    }
}
