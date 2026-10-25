import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const root = new URL("../", import.meta.url);
for (const directory of ["dist/", "docs/"]) {
  await fs.rm(new URL(directory, root), { recursive: true, force: true });
}
await fs.mkdir(new URL("dist/", root), { recursive: true });
const typescript = spawnSync(
  process.execPath,
  [
    fileURLToPath(
      new URL("../../../node_modules/typescript/bin/tsc", import.meta.url),
    ),
    "--project",
    fileURLToPath(new URL("tsconfig.json", root)),
  ],
  { stdio: "inherit" },
);
if (typescript.status !== 0) process.exit(typescript.status ?? 1);
// Node 22 cannot synchronously require ESM while an async loader is active.
await build({
  entryPoints: [fileURLToPath(new URL("src/sidecar/postcss-preload.ts", root))],
  outfile: fileURLToPath(new URL("dist/sidecar/postcss-preload.cjs", root)),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22.15",
  define: { "import.meta.url": "__moklyPreloadUrl" },
  banner: {
    js: "const __moklyPreloadUrl = require('node:url').pathToFileURL(__filename).href;",
  },
});
await build({
  entryPoints: [
    fileURLToPath(new URL("src/sidecar/postcss-async-loader.ts", root)),
  ],
  outfile: fileURLToPath(
    new URL("dist/sidecar/postcss-async-loader.mjs", root),
  ),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22.15",
});
for (const directory of ["guides", "protocol"]) {
  await fs.cp(
    new URL(`../../../docs/${directory}`, import.meta.url),
    new URL(`docs/${directory}`, root),
    { recursive: true },
  );
}
for (const file of [
  "version.mjs",
  "platform.mjs",
  "shim.mjs",
  "runtime.mjs",
  "execution.mjs",
]) {
  await fs.copyFile(
    new URL(`src/${file}`, root),
    new URL(`dist/${file}`, root),
  );
}

await fs.copyFile(
  new URL("../../../CHANGELOG.md", import.meta.url),
  new URL("CHANGELOG.md", root),
);
