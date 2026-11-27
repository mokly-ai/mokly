/** Compile the frame package and build its browser scripts. */
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

import { build } from "esbuild";

import { bundleProbe } from "./probe-bundle.mjs";

const root = path.resolve(import.meta.dirname, "..");
await fs.rm(path.join(root, "dist"), { force: true, recursive: true });
execFileSync(
  process.execPath,
  [
    createRequire(import.meta.url).resolve("typescript/bin/tsc"),
    "--project",
    path.join(root, "tsconfig.build.json"),
  ],
  { stdio: "inherit" },
);
const browser = path.join(root, "dist/browser");
await fs.mkdir(browser, { recursive: true });
await bundleProbe(
  path.join(root, "src/probe/index.ts"),
  path.join(browser, "frame-probe.js"),
);
const access = await build({
  bundle: true,
  entryPoints: {
    "access-start": path.join(root, "src/access/start.ts"),
    "access-worker": path.join(root, "src/access/worker.ts"),
  },
  format: "iife",
  minify: true,
  outdir: browser,
  platform: "browser",
  target: "es2023",
  write: false,
});
for (const file of access.outputFiles) {
  if (path.basename(file.path) === "access-start.js") {
    await fs.writeFile(
      path.join(browser, "access-start.html"),
      `<!doctype html><html><head><meta charset="utf-8"></head><body><script>${file.text}</script></body></html>\n`,
    );
  } else {
    await fs.writeFile(file.path, file.contents);
  }
}
