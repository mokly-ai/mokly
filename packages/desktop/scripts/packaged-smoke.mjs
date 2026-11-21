import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { resolve } from "node:path";

import { _electron, expect } from "@playwright/test";

import { scratchDirectory } from "../../../apps/_tests_/scratch.mjs";

import { packageArtifact } from "./package.mjs";

const desktop = resolve(import.meta.dirname, "..");
const evidence = resolve(desktop, "../../.context/desktop-app-shell");

/**
 * Capture the native buttons, which a page screenshot cannot include.
 * @param {import("@playwright/test").ElectronApplication} electron
 * @param {import("@playwright/test").Page} page
 */
async function captureMacWindow(electron, page) {
  const path = resolve(evidence, "packaged-smoke-darwin-window.png");
  let mediaSourceId;
  try {
    await rm(path, { force: true });
    const window = await electron.browserWindow(page);
    try {
      mediaSourceId = await window.evaluate((active) =>
        active.getMediaSourceId(),
      );
    } finally {
      await window.dispose();
    }
    const match = /^window:(\d+):0$/.exec(mediaSourceId);
    assert.ok(match, `Invalid window media source ID: ${mediaSourceId}`);
    const capture = spawnSync(
      "/usr/sbin/screencapture",
      ["-x", "-l", match[1], path],
      { encoding: "utf8" },
    );
    if (capture.error) throw capture.error;
    assert.equal(capture.status, 0, capture.stderr || "screencapture failed");
    assert.ok((await stat(path)).size > 0, "The window capture is empty");
    return { status: "captured", path, mediaSourceId };
  } catch (error) {
    const failure = error instanceof Error ? error.message : String(error);
    console.warn(`[desktop smoke] Native window capture failed: ${failure}`);
    return { status: "failed", path, mediaSourceId, error: failure };
  }
}

/** @param {import("@playwright/test").Page} page */
function windowControlsOverlay(page) {
  return page.evaluate(() => {
    const { document, navigator } = globalThis;
    const controls = navigator.windowControlsOverlay;
    return {
      visible: controls?.visible ?? false,
      startInset: globalThis
        .getComputedStyle(document.documentElement)
        .getPropertyValue("--fo-window-inset")
        .trim(),
      titlebarAreaRect: controls?.getTitlebarAreaRect().toJSON() ?? null,
    };
  });
}

const scratch = scratchDirectory(resolve(evidence, "packaged-launch-"));
const unpack = resolve(scratch, "unpack");
await mkdir(unpack);
const mac = process.platform === "darwin";
const artifactName = packageArtifact(
  await readdir(resolve(desktop, "release")),
  process.platform,
);
assert.ok(artifactName, "The packaged launch artifact is missing");
const artifact = resolve(desktop, "release", artifactName);
const extracted = spawnSync(
  mac ? "ditto" : artifact,
  mac ? ["-x", "-k", artifact, unpack] : ["--appimage-extract"],
  { cwd: unpack, encoding: "utf8" },
);
assert.equal(extracted.status, 0, extracted.stderr);
const executablePath = resolve(
  unpack,
  mac ? "Mokly.app/Contents/MacOS/Mokly" : "squashfs-root/mokly",
);
// A local proxy closes every connection before the renderer can reach any API.
const proxy = createServer((socket) => socket.destroy());
await new Promise((done) => proxy.listen(0, "127.0.0.1", done));
const address = proxy.address();
assert.ok(address && typeof address !== "string");
let electron;
try {
  electron = await _electron.launch({
    executablePath,
    args: [
      `--user-data-dir=${resolve(scratch, "profile")}`,
      `--proxy-server=http://127.0.0.1:${address.port}`,
      "--proxy-bypass-list=<-loopback>",
    ],
    timeout: 60_000,
  });
  const packaged = await electron.evaluate(({ app }) => ({
    packaged: app.isPackaged,
    path: app.getAppPath(),
    arch: process.arch,
  }));
  assert.equal(packaged.packaged, true);
  assert.ok(packaged.path.endsWith("/app.asar"), packaged.path);
  if (mac) assert.equal(packaged.arch, "arm64");
  const page = await electron.firstWindow();
  const session = page.locator('[data-mkc-screen="app-session"]');
  await expect(
    session.getByRole("button", { name: "Try again", exact: true }),
  ).toBeVisible({ timeout: 30_000 });
  assert.equal(page.url(), "mokly-app://desktop/dashboard");
  await page.screenshot({
    path: resolve(evidence, `packaged-smoke-${process.platform}.png`),
  });
  const overlay = await windowControlsOverlay(page);
  const proof = {
    artifact,
    ...packaged,
    url: page.url(),
    recovery: "Try again",
    network: "unreachable proxy",
    windowControlsOverlay: overlay,
    ...(mac ? { windowCapture: await captureMacWindow(electron, page) } : {}),
  };
  if (mac) {
    const zoom = await electron.evaluate(({ BrowserWindow, Menu }) => {
      const active = BrowserWindow.getAllWindows()[0];
      active.focus();
      const increase = Menu.getApplicationMenu()
        ?.items.flatMap((item) => item.submenu?.items ?? [])
        .find((item) => item.label === "Zoom In");
      if (!increase) throw new Error("The View menu has no Zoom In command");
      increase.click();
      increase.click();
      return {
        zoomLevel: active.webContents.getZoomLevel(),
        zoomFactor: active.webContents.getZoomFactor(),
        buttonPosition: active.getWindowButtonPosition(),
      };
    });
    await page.waitForFunction((initialX) => {
      const { navigator } = globalThis;
      const controls = navigator.windowControlsOverlay;
      return controls?.visible && controls.getTitlebarAreaRect().x < initialX;
    }, overlay.titlebarAreaRect?.x);
    proof.pageZoom = {
      ...zoom,
      windowControlsOverlay: await windowControlsOverlay(page),
    };
  }
  await writeFile(
    resolve(evidence, `packaged-smoke-${process.platform}.json`),
    JSON.stringify(proof, null, 2) + "\n",
  );
  console.log(JSON.stringify(proof));
  assert.equal(overlay.visible, mac);
  assert.equal(
    overlay.startInset,
    mac ? `${overlay.titlebarAreaRect?.x}px` : "0px",
  );
  assert.equal((overlay.titlebarAreaRect?.x ?? 0) > 0, mac);
  if (mac) {
    assert.equal(proof.pageZoom.zoomLevel, 1);
    assert.equal(proof.pageZoom.zoomFactor, 1.2);
    assert.deepEqual(proof.pageZoom.buttonPosition, { x: 16, y: 22 });
  }
} finally {
  await electron?.close();
  await new Promise((done) => proxy.close(done));
  await rm(scratch, { recursive: true, force: true });
}
