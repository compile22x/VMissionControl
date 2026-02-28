import { BrowserWindow, shell } from "electron";
import path from "path";

/** Create and configure the main application window. */
export function createMainWindow(port: number): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: "#0A0A0F",
    show: false,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: process.platform === "darwin" ? { x: 16, y: 16 } : undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // Required for WebSerial and WebUSB
      webSecurity: true,
    },
  });

  // Show window when ready to avoid white flash
  win.once("ready-to-show", () => {
    win.show();
  });

  // Load the Next.js app
  win.loadURL(`http://localhost:${port}`);

  // Open external links in the default browser, not in Electron
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://localhost")) {
      return { action: "allow" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Also handle navigation to external URLs
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(`http://localhost:${port}`)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  return win;
}
