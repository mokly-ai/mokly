/** Compile the frame adapters and the frame probe package entries. */
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

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
