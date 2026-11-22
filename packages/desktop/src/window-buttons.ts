import type { BrowserWindow, Point, WebContents } from "electron";

export interface ButtonWindow extends Pick<
  BrowserWindow,
  "isFullScreen" | "setWindowButtonPosition"
> {
  on(event: "leave-full-screen", listener: () => void): void;
  webContents: Pick<
    WebContents,
    "getZoomFactor" | "getZoomLevel" | "setZoomLevel"
  > & {
    on(event: "zoom-changed", listener: () => void): void;
    on(event: "did-navigate", listener: () => void): void;
  };
}

const topBarHeight = 48;
const buttonHeight = 14;
const zoomCommands = [
  {
    role: "resetzoom",
    label: "Actual Size",
    accelerator: "CommandOrControl+0",
    step: 0,
  },
  {
    role: "zoomin",
    label: "Zoom In",
    accelerator: "CommandOrControl+Plus",
    step: 0.5,
  },
  {
    role: "zoomout",
    label: "Zoom Out",
    accelerator: "CommandOrControl+-",
    step: -0.5,
  },
] as const;

/** Convert the web bar's height to native points; native buttons keep their size. */
export function windowButtonPosition(zoomFactor: number): Point {
  return {
    x: 16,
    y: Math.round((topBarHeight * zoomFactor - buttonHeight) / 2),
  };
}

function updateWindowButtons(window: ButtonWindow): void {
  if (!window.isFullScreen())
    window.setWindowButtonPosition(
      windowButtonPosition(window.webContents.getZoomFactor()),
    );
}

/** Navigation restores host zoom before did-navigate, including on a new window. */
export function installWindowButtons(window: ButtonWindow): void {
  const update = () => updateWindowButtons(window);
  window.webContents.on("zoom-changed", update);
  window.webContents.on("did-navigate", update);
  window.on("leave-full-screen", update);
}

/** Electron's zoom roles emit no zoom event for either menu or keyboard input. */
export function zoomMenuItem(
  role: string | undefined,
  focusedWindow: () => ButtonWindow | null,
) {
  const command = zoomCommands.find(
    (item) => item.role === role?.toLowerCase(),
  );
  if (!command) return;
  return {
    label: command.label,
    accelerator: command.accelerator,
    click: () => {
      const window = focusedWindow();
      if (!window) return;
      // Electron clamps the requested level to Chromium's limits.
      window.webContents.setZoomLevel(
        command.step === 0
          ? 0
          : window.webContents.getZoomLevel() + command.step,
      );
      updateWindowButtons(window);
    },
  };
}
