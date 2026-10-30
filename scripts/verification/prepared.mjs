import fs from "node:fs/promises";
import path from "node:path";

/** List the outputs of the build under test that are missing. */
export async function missingPreparedOutputs(
  repositoryRoot,
  { browser = false } = {},
) {
  const missing = [];
  const files = [
    "packages/viewer/dist/index.js",
    "packages/viewer/dist/browser/inspector.js",
  ];
  if (browser) {
    const { platformPackage } =
      await import("../../packages/mokly/src/platform.mjs");
    files.push(
      "packages/mokly/dist/shim.mjs",
      "packages/mokly/dist/sidecar.js",
      "packages/viewer/dist/browser/shell.js",
      `packages/${platformPackage(process.platform, process.arch, true).replace("@mokly/", "")}/bin/${process.platform === "win32" ? "mokly.exe" : "mokly"}`,
    );
  }
  for (const name of files) {
    try {
      if (!(await fs.stat(path.join(repositoryRoot, name))).isFile())
        missing.push(name);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      missing.push(name);
    }
  }
  return missing;
}

/** Require the build under test without preparing or modifying it. */
export async function requirePrepared(repositoryRoot, options) {
  const missing = await missingPreparedOutputs(repositoryRoot, options);
  if (missing.length)
    throw new Error(
      `prepared verification output is missing: ${missing.join(", ")}; run npm run build first`,
    );
}
