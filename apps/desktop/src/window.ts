import type {
  BrowserWindow,
  BrowserWindowConstructorOptions,
  Rectangle,
} from "electron";

export interface WindowDependencies {
  create(options: BrowserWindowConstructorOptions): BrowserWindow;
  readState(): string;
  saveState(value: string): void;
  visible(bounds: Rectangle): boolean;
  warn(error: unknown): void;
}

/** Restore an on-screen rectangle; damaged or disconnected-display state uses the default. */
export function windowBounds(
  dependencies: Pick<WindowDependencies, "readState" | "visible">,
): Rectangle | { width: number; height: number } {
  try {
    const bounds: Rectangle = JSON.parse(dependencies.readState());
    if (
      [bounds.x, bounds.y, bounds.width, bounds.height].every(
        Number.isSafeInteger,
      ) &&
      bounds.width >= 640 &&
      bounds.height >= 480 &&
      dependencies.visible(bounds)
    )
      return bounds;
  } catch {
    /* A first launch has no saved state. */
  }
  return { width: 1280, height: 840 };
}

/** One isolated renderer; no preload or privileged renderer bridge exists. */
export function createWindow(dependencies: WindowDependencies): BrowserWindow {
  const window = dependencies.create({
    ...windowBounds(dependencies),
    minWidth: 640,
    minHeight: 480,
    title: "Mokly",
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      webviewTag: false,
      allowRunningInsecureContent: false,
    },
  });
  window.on("close", () => {
    try {
      dependencies.saveState(JSON.stringify(window.getNormalBounds()));
    } catch (error) {
      dependencies.warn(error);
    }
  });
  return window;
}
