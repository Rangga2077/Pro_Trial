import { app, BrowserWindow, session, screen, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !!process.env.VITE_DEV_SERVER_URL;

// Keep a global reference of the window object
let mainWindow: BrowserWindow | null = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        show: false, // Don't show until ready-to-show fires, prevents black flash
        backgroundColor: '#000000',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            // Allow ws:// connections to localhost backend in dev mode
            webSecurity: !isDev,
        },
    });

    // Grant camera and microphone permissions automatically (needed for webcam feed)
    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
        const allowedPermissions = ['media', 'camera', 'microphone', 'videoCapture', 'audioCapture'];
        if (allowedPermissions.includes(permission)) {
            callback(true);
        } else {
            callback(false);
        }
    });

    // Also handle permission checks (for already-cached permission state)
    session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
        const allowedPermissions = ['media', 'camera', 'microphone', 'videoCapture', 'audioCapture'];
        return allowedPermissions.includes(permission);
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });

    if (isDev) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL!);
        // Uncomment the line below to open DevTools for debugging:
        // mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}

app.whenReady().then(() => {
    createWindow();

    // IPC Handlers for Multiple Displays (Projector Support)
    ipcMain.handle('get-displays', () => {
        return screen.getAllDisplays().map(d => ({
            id: d.id,
            bounds: d.bounds,
            size: d.size,
            isPrimary: d.id === screen.getPrimaryDisplay().id
        }));
    });

    ipcMain.handle('move-to-display', (_event, displayId: number) => {
        if (!mainWindow) return { success: false, error: 'No main window' };
        
        const targetDisplay = screen.getAllDisplays().find(d => d.id === displayId);
        if (targetDisplay) {
            mainWindow.setBounds(targetDisplay.bounds);
            mainWindow.setFullScreen(true);
            return { success: true };
        }
        return { success: false, error: 'Display not found' };
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
