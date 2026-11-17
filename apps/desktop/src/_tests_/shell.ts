import { createRequire } from "node:module";
import { resolve } from "node:path";

import { _electron, expect } from "@playwright/test";
import type { ElectronApplication, Page } from "@playwright/test";

import type * as Scratch from "../../../_tests_/scratch.mjs";
import { catalogueOrigin } from "../../../app/src/_tests_/origins";

// The app harness loads this shared MJS helper through CommonJS. Use the same
// loader so Playwright never tries to register it as both CJS and ESM.
const { scratchDirectory } = createRequire(import.meta.url)(
  "../../../_tests_/scratch.mjs",
) as typeof Scratch;

export function profileDirectory(label: string): string {
  return scratchDirectory(resolve("../../.context/m5", label + "-"));
}

export async function launch(
  profile: string,
  address?: string,
): Promise<ElectronApplication> {
  const electron = await _electron.launch({
    args: [".", `--user-data-dir=${profile}`, ...(address ? [address] : [])],
    cwd: process.cwd(),
    env: {
      ...process.env,
      MKC_DESKTOP_CATALOGUE_SOURCE: `http://*.localhost:${new URL(catalogueOrigin).port}`,
    },
  });
  const page = await electron.firstWindow();
  await page.waitForURL((url) => url.protocol === "mokly-app:");
  if (!address)
    await expect(page.locator("[data-mkc-screen]").first()).toBeVisible();
  await electron.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0].setBounds({
      x: 20,
      y: 20,
      width: 1440,
      height: 900,
    });
  });
  return electron;
}

/** Capture the real opener boundary without launching a browser outside the test. */
export async function captureOpener(
  electron: ElectronApplication,
): Promise<void> {
  await electron.evaluate(({ shell }) => {
    const state = globalThis as typeof globalThis & { opened: string[] };
    state.opened = [];
    shell.openExternal = async (url) => {
      state.opened.push(url);
    };
  });
}

export function opened(electron: ElectronApplication): Promise<string[]> {
  return electron.evaluate(
    () => (globalThis as typeof globalThis & { opened: string[] }).opened,
  );
}

export async function follow(
  page: Page,
  url: string,
  popup = false,
): Promise<void> {
  await page.evaluate(
    ({ url, popup }) => {
      const link = document.createElement("a");
      link.href = url;
      if (popup) link.target = "_blank";
      document.body.append(link);
      link.click();
      link.remove();
    },
    { url, popup },
  );
}

export async function screenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: resolve("../../.context/m5", name + ".png") });
}

export async function signedInEmail(page: Page, api: string): Promise<string> {
  return page.evaluate(async (origin) => {
    const response = await fetch(origin + "/v1/session", {
      credentials: "include",
    });
    if (!response.ok)
      throw new Error(`session read failed: ${response.status}`);
    return ((await response.json()) as { user: { email: string } }).user.email;
  }, api);
}

/** Deliver an operating-system handoff to the running application's real listener. */
export async function deliverHandoff(
  electron: ElectronApplication,
  address: string,
): Promise<void> {
  await electron.evaluate(({ app }, url) => {
    app.emit("open-url", { preventDefault: () => {} }, url);
  }, address);
}

export async function expectShellSettings(
  electron: ElectronApplication,
): Promise<void> {
  const preferences = await electron.evaluate(({ BrowserWindow, Menu }) => {
    const contents = BrowserWindow.getAllWindows()[0].webContents;
    const settings = (
      contents as unknown as {
        getLastWebPreferences(): Electron.WebPreferences;
      }
    ).getLastWebPreferences();
    return {
      settings,
      menu: Menu.getApplicationMenu()?.items.flatMap((item) => [
        item.label,
        ...(item.submenu?.items.map((child) => child.label) ?? []),
      ]),
    };
  });
  for (const key of ["contextIsolation", "sandbox", "webSecurity"] as const)
    expect(preferences.settings[key]).toBe(true);
  for (const key of [
    "nodeIntegration",
    "webviewTag",
    "allowRunningInsecureContent",
  ] as const)
    expect(preferences.settings[key]).toBe(false);
  expect(preferences.settings.preload).toBeUndefined();
  expect(preferences.menu).toContain("Check for updates");
}

/** Capture the production logger at its real console boundary. */
export async function expectSafeNavigationDiagnostic(
  electron: ElectronApplication,
): Promise<void> {
  const observed = await electron.evaluate(async ({ app, BrowserWindow }) => {
    const secret = "f".repeat(64);
    const window = BrowserWindow.getAllWindows()[0];
    const originalLoad = window.loadURL;
    const originalWarn = console.warn;
    const warnings: unknown[][] = [];
    console.warn = (...arguments_: unknown[]) => {
      warnings.push(arguments_);
    };
    window.loadURL = async (url) => {
      if (url === "about:blank") return;
      throw Object.assign(new Error(`load failed ${url}`, { cause: { url } }), {
        code: "ERR_ABORTED",
        url,
        stack: `Error in ${url}`,
      });
    };
    try {
      app.emit(
        "open-url",
        { preventDefault: () => {} },
        `mokly://auth/email/callback#token=${secret}`,
      );
      await new Promise<void>((done) => setImmediate(done));
      return {
        count: warnings.length,
        leaked: JSON.stringify(warnings).includes(secret),
        stringsOnly: warnings.every((values) =>
          values.every((value) => typeof value === "string"),
        ),
      };
    } finally {
      window.loadURL = originalLoad;
      console.warn = originalWarn;
    }
  });
  expect(observed).toEqual({ count: 1, leaked: false, stringsOnly: true });
}
