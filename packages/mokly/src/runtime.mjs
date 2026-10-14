import { spawn } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

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
      new Promise((resolve, reject) => {
        const child = spawn(binary, arguments_, { stdio: "inherit" });
        const signals = ["SIGINT", "SIGTERM", "SIGHUP"];
        const handlers = signals.map((signal) => () => child.kill(signal));
        const cleanup = () => {
          signals.forEach((signal, index) => {
            process.removeListener(signal, handlers[index]);
          });
        };
        signals.forEach((signal, index) => {
          process.on(signal, handlers[index]);
        });
        child.once("error", (error) => {
          cleanup();
          reject(error);
        });
        child.once("exit", (status) => {
          cleanup();
          resolve(status === 0 ? 0 : 1);
        });
      }),
  };
}
