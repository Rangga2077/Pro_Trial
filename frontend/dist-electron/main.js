import { app, BrowserWindow, session } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = !!process.env.VITE_DEV_SERVER_URL;
function createWindow() {
    const win = new BrowserWindow({
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
        }
        else {
            callback(false);
        }
    });
    // Also handle permission checks (for already-cached permission state)
    session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
        const allowedPermissions = ['media', 'camera', 'microphone', 'videoCapture', 'audioCapture'];
        return allowedPermissions.includes(permission);
    });
    win.once('ready-to-show', () => {
        win.show();
    });
    if (isDev) {
        win.loadURL(process.env.VITE_DEV_SERVER_URL);
        // Uncomment the line below to open DevTools for debugging:
        // win.webContents.openDevTools();
    }
    else {
        win.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}
app.whenReady().then(() => {
    createWindow();
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
//# sourceMappingURL=main.js.map