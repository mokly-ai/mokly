import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { resolve } from "node:path";

import { _electron, expect } from "@playwright/test";

import { scratchDirectory } from "../../../apps/_tests_/scratch.mjs";

import { packageArtifact } from "./package.mjs";

const desktop = resolve(import.meta.dirname, "..");
const evidence = resolve(desktop, "../../.context/desktop-app-shell");
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
  const proof = {
    artifact,
    ...packaged,
    url: page.url(),
    recovery: "Try again",
    network: "unreachable proxy",
  };
  await writeFile(
    resolve(evidence, `packaged-smoke-${process.platform}.json`),
    JSON.stringify(proof, null, 2) + "\n",
  );
  console.log(JSON.stringify(proof));
} finally {
  await electron?.close();
  await new Promise((done) => proxy.close(done));
  await rm(scratch, { recursive: true, force: true });
}
