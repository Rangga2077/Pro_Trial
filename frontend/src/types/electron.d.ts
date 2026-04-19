export interface IElectronAPI {
    sendMessage: (message: string) => void;
    getDisplays: () => Promise<any[]>;
    moveToDisplay: (displayId: number) => Promise<{success: boolean, error?: string}>;
}

declare global {
    interface Window {
        electronAPI: IElectronAPI;
    }
}
