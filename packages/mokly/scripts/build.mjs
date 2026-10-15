import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
for (const directory of ["guides", "protocol"]) {
  await fs.cp(
    new URL(`../../../docs/${directory}`, import.meta.url),
    new URL(`docs/${directory}`, root),
    {
      recursive: true,
      filter: (source) => path.basename(source) !== "fixtures",
    },
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
