const { app, BrowserWindow, ipcMain, screen } = require("electron");
const path = require("path");

// ライブラリの読み込み（ログの結果に基づき、.uIOhook を抽出）
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
      // --- ここを書き換えます ---
      // path.join(__dirname, "preload.js") よりも安全な指定方法です
      preload: path.join(app.getAppPath(), "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // -----------------------
    },
  });

  mainWindow.loadFile("index.html");
  mainWindow.setIgnoreMouseEvents(true, { forward: true });
}

// 描画モードの切り替え
function toggleDrawingMode() {
  isDrawingMode = !isDrawingMode;

  if (isDrawingMode) {
    mainWindow.setIgnoreMouseEvents(false); // マウスを捕まえる
    mainWindow.focus(); // ★これを追加：OSに対してウィンドウを「アクティブ」にする
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

    // キー入力監視（Ctrl 2回）
    uiohook.on("keydown", (e) => {
      if (e.keycode === 29 || e.keycode === 3613) {
        const now = Date.now();
        if (now - lastCtrlTime < 300) {
          toggleDrawingMode();
        }
        lastCtrlTime = now;
      }
    });

    // マウスクリック監視（ここを追加！）
    uiohook.on("mousedown", (e) => {
      if (!isDrawingMode && mainWindow) {
        // e.x や e.y を使う代わりに、Electron標準の「スケーリングを考慮した座標」を取得します
        const { screen } = require("electron");
        const point = screen.getCursorScreenPoint();

        // ウィンドウが全画面（0,0から開始）であることを前提に、そのまま座標を送信
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
