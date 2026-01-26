const { app, BrowserWindow, ipcMain, screen } = require("electron");
const path = require("path");
const ioHookModule = require("uiohook-napi");
const uiohook = ioHookModule.uIOhook;

let mainWindow;
let isDrawingMode = false;

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;

  mainWindow = new BrowserWindow({
    width: width,
    height: height,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile("index.html");
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  // DevTools for debugging (can be removed later)
  // mainWindow.webContents.openDevTools({ mode: "detach" });
}

// 描画モードの切り替え
function toggleDrawingMode() {
  isDrawingMode = !isDrawingMode;

  if (isDrawingMode) {
    mainWindow.setIgnoreMouseEvents(false);
    mainWindow.focus();
    mainWindow.webContents.send("mode-change", "drawing");
  } else {
    mainWindow.setIgnoreMouseEvents(true, { forward: true });
    mainWindow.webContents.send("mode-change", "pointer");
  }
}

app.whenReady().then(() => {
  createWindow();

  if (uiohook) {
    let lastCtrlTime = 0;

    // Global Keydown Hook
    uiohook.on("keydown", (e) => {
      // Toggle Mode: Ctrl (29 or 3613) double tap
      if (e.keycode === 29 || e.keycode === 3613) {
        const now = Date.now();
        if (now - lastCtrlTime < 300) {
          toggleDrawingMode();
        }
        lastCtrlTime = now;
      }

      // Send key to renderer for Text Input effect
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("global-keydown", { keycode: e.keycode });
      }
    });

    // Global Mouse Click Hook (Rainbow Sparkles)
    uiohook.on("mousedown", (e) => {
      if (!isDrawingMode && mainWindow && !mainWindow.isDestroyed()) {
        const { screen } = require("electron");
        const point = screen.getCursorScreenPoint();
        mainWindow.webContents.send("spawn-spark", { x: point.x, y: point.y });
      }
    });

    uiohook.start();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
