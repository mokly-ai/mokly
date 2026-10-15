import fs from "node:fs/promises";
import path from "node:path";

/** Require the viewer's build without invoking the absent backend. */
export async function requirePrepared(repositoryRoot) {
  const missing = [];
  for (const name of [
    "packages/viewer/dist/index.js",
    "packages/viewer/dist/browser/inspector.js",
  ]) {
    try {
      if (!(await fs.stat(path.join(repositoryRoot, name))).isFile())
        missing.push(name);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      missing.push(name);
    }
  }
  if (missing.length)
    throw new Error(
      `prepared verification output is missing: ${missing.join(", ")}; run npm run build first`,
    );
}
