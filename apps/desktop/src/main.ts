import { app, BrowserWindow, ipcMain, safeStorage } from "electron";
import * as path from "path";
import * as fs from "fs";
import log from "electron-log";
import { BackendManager } from "./backend-manager";
import { LlamafileManager } from "./llamafile-manager";
import { findFreePort } from "./port-finder";

const isDev = process.argv.includes("--dev");

let mainWindow: BrowserWindow | null = null;
let backendManager: BackendManager | null = null;
let llamafileManager: LlamafileManager | null = null;

async function createWindow(port: number): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "FOLIO Mapper",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    await mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    await mainWindow.loadURL(`http://127.0.0.1:${port}/`);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function registerAuthIPC(): void {
  ipcMain.handle("auth:get-local-token", () => {
    return backendManager?.localToken ?? null;
  });
}

function getKeychainPath(): string {
  return path.join(app.getPath("userData"), "api-keys.json");
}

function readKeychainFile(): Record<string, string> {
  try {
    const raw = fs.readFileSync(getKeychainPath(), "utf-8");
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function writeKeychainFile(data: Record<string, string>): void {
  fs.writeFileSync(getKeychainPath(), JSON.stringify(data, null, 2), "utf-8");
}

function registerKeychainIPC(): void {
  ipcMain.handle("keychain:is-available", () => {
    return safeStorage.isEncryptionAvailable();
  });

  ipcMain.handle("keychain:get-key", (_event, provider: string) => {
    if (!safeStorage.isEncryptionAvailable()) return null;
    const data = readKeychainFile();
    const encrypted = data[provider];
    if (!encrypted) return null;
    try {
      return safeStorage.decryptString(Buffer.from(encrypted, "base64"));
    } catch {
      return null;
    }
  });

  ipcMain.handle("keychain:set-key", (_event, provider: string, apiKey: string) => {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("Encryption not available");
    }
    const data = readKeychainFile();
    data[provider] = safeStorage.encryptString(apiKey).toString("base64");
    writeKeychainFile(data);
  });

  ipcMain.handle("keychain:delete-key", (_event, provider: string) => {
    const data = readKeychainFile();
    delete data[provider];
    writeKeychainFile(data);
  });

  ipcMain.handle("keychain:list-providers", () => {
    if (!safeStorage.isEncryptionAvailable()) return [];
    return Object.keys(readKeychainFile());
  });

  ipcMain.handle("keychain:clear-all", () => {
    try {
      fs.unlinkSync(getKeychainPath());
    } catch {
      // File didn't exist
    }
  });
}

function registerLlamafileIPC(): void {
  ipcMain.handle("llamafile:get-status", () => {
    return llamafileManager?.getStatus() ?? { state: "idle" };
  });

  ipcMain.handle("llamafile:get-port", () => {
    return llamafileManager?.getPort() ?? null;
  });

  ipcMain.handle("llamafile:list-models", () => {
    return llamafileManager?.listModels() ?? [];
  });

  ipcMain.handle("llamafile:download-model", async (_event, modelId: string) => {
    if (!llamafileManager) throw new Error("Llamafile manager not initialized");
    await llamafileManager.downloadModel(modelId);
  });

  ipcMain.handle("llamafile:delete-model", (_event, modelId: string) => {
    if (!llamafileManager) throw new Error("Llamafile manager not initialized");
    llamafileManager.deleteModel(modelId);
  });

  ipcMain.handle("llamafile:set-active-model", async (_event, modelId: string) => {
    if (!llamafileManager) throw new Error("Llamafile manager not initialized");
    llamafileManager.setActiveModel(modelId);
    // Restart llamafile if currently running
    const status = llamafileManager.getStatus();
    if (status.state === "ready") {
      await llamafileManager.restart();
    }
  });

  ipcMain.handle("llamafile:get-active-model", () => {
    return llamafileManager?.getActiveModel() ?? null;
  });
}

async function startApp(): Promise<void> {
  const port = isDev ? 8000 : await findFreePort();

  if (!isDev) {
    backendManager = new BackendManager(port);
    backendManager.start(process.resourcesPath);

    log.info(`Waiting for backend on port ${port}...`);
    await backendManager.waitForReady();
    log.info("Backend is ready");
  }

  // Register IPC handlers before window creation
  registerAuthIPC();
  registerKeychainIPC();
  registerLlamafileIPC();

  await createWindow(port);

  // Start llamafile setup in background (non-blocking)
  const llamafilePort = await findFreePort();
  llamafileManager = new LlamafileManager(app.getPath("userData"), llamafilePort);
  llamafileManager.setup().catch((err) => {
    log.error("[llamafile] Background setup failed:", err);
  });
}

app.whenReady().then(() => {
  startApp().catch((err) => {
    log.error("Failed to start:", err);
    app.quit();
  });
});

app.on("window-all-closed", () => {
  app.quit();
});

let isQuitting = false;
app.on("before-quit", (e) => {
  if (isQuitting) return;
  e.preventDefault();
  isQuitting = true;

  const cleanup = async () => {
    if (llamafileManager) {
      await llamafileManager.stop();
    }
    if (backendManager) {
      await backendManager.stop();
    }
  };

  cleanup()
    .catch((err) => log.error("Cleanup error:", err))
    .finally(() => app.quit());
});
