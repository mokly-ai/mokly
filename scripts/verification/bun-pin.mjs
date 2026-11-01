import { readFile } from "node:fs/promises";
import path from "node:path";

import { valid } from "semver";

/**
 * Read the repository's exact Bun version through an injected file boundary.
 * @param {string} root
 * @param {import("./bun-pin.mjs").BunPinOptions} options
 * @returns {Promise<import("./bun-pin.mjs").BunPin>}
 */
export async function readBunPin(root, options = {}) {
  const read = options.readFile ?? ((file) => readFile(file, "utf8"));
  let text;
  try {
    text = await read(path.join(root, ".bun-version"));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { status: "invalid", reason: `Cannot read .bun-version: ${reason}` };
  }
  const version = text.trim();
  if (valid(version) !== version)
    return {
      status: "invalid",
      reason: ".bun-version must contain one exact Bun version.",
    };
  return { status: "valid", version };
}
