import { spawn } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { executeNative } from "./execution.mjs";

const require = createRequire(import.meta.url);

/** The host runtime, created only by the executable entry. */
export function systemRuntime() {
  return {
    nodeVersion: process.versions.node,
    platform: process.platform,
    architecture: process.arch,
    glibc:
      process.platform === "linux"
        ? Boolean(process.report.getReport().header.glibcVersionRuntime)
        : false,
    cliPackage: () =>
      JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url))),
    nativePackage: (name) => {
      const manifest = require.resolve(`${name}/package.json`);
      const { version } = JSON.parse(fs.readFileSync(manifest, "utf8"));
      return {
        version,
        binary: path.join(
          path.dirname(manifest),
          "bin",
          process.platform === "win32" ? "mokly.exe" : "mokly",
        ),
      };
    },
    execute: (binary, arguments_) =>
      executeNative(binary, arguments_, {
        platform: process.platform,
        spawn: (binary, arguments_, options) =>
          spawn(binary, arguments_, {
            ...options,
            env: {
              ...process.env,
              MOKLY_VIEWER_DIST: path.dirname(
                fileURLToPath(import.meta.resolve("@mokly/viewer/browser")),
              ),
            },
          }),
        subscribe: (signal, handler) => process.on(signal, handler),
        unsubscribe: (signal, handler) =>
          process.removeListener(signal, handler),
      }),
  };
}
