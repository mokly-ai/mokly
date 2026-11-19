import fs from "node:fs/promises";

import type { ConsumerRequire } from "./paths.js";

/** Capture every public React subpath while consumer peer resolution is available. */
export async function captureReactPeers(
  require: ConsumerRequire,
): Promise<void> {
  for (const name of ["react", "react-dom"]) {
    const file = await optionalPeer(require, `${name}/package.json`);
    if (!file) continue;
    const manifest: unknown = JSON.parse(await fs.readFile(file, "utf8"));
    const exports =
      manifest && typeof manifest === "object" && "exports" in manifest
        ? manifest.exports
        : undefined;
    if (!exports || typeof exports !== "object" || Array.isArray(exports))
      continue;
    for (const key of Object.keys(exports)) {
      if (key === ".") await optionalPeer(require, name);
      else if (key.startsWith("./"))
        await optionalPeer(require, name + key.slice(1));
    }
  }
}

async function optionalPeer(
  require: ConsumerRequire,
  name: string,
): Promise<string | undefined> {
  try {
    return await require.resolvePeer(name);
  } catch (error) {
    if (!(
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "MODULE_NOT_FOUND"
    ))
      throw error;
    return undefined;
  }
}
