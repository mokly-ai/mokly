import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

/** Generated record of a package's complete runtime outputs. */
export const RUNTIME_INVENTORY = ".runtime-inventory.json";

/**
 * Write the inventory only after every package build step succeeds.
 * @param {string} directory
 */
export async function writeRuntimeInventory(directory) {
  const files = [];
  for (const file of await runtimeFiles(directory)) {
    files.push({
      path: file,
      sha256: await digest(path.join(directory, file)),
    });
  }
  await fs.writeFile(
    path.join(directory, RUNTIME_INVENTORY),
    `${JSON.stringify({ schemaVersion: 1, files }, null, 2)}\n`,
  );
}

/**
 * Check the complete generated tree, including each file's content digest.
 * @param {string} directory
 * @returns {Promise<boolean>}
 */
export async function runtimeInventoryComplete(directory) {
  try {
    /** @type {unknown} */
    const inventory = JSON.parse(
      await fs.readFile(path.join(directory, RUNTIME_INVENTORY), "utf8"),
    );
    if (!isRuntimeInventory(inventory)) return false;
    const files = await runtimeFiles(directory);
    if (files.length !== inventory.files.length || files.length === 0)
      return false;
    for (const [index, file] of files.entries()) {
      const recorded = inventory.files[index];
      if (
        recorded.path !== file ||
        recorded.sha256 !== (await digest(path.join(directory, file)))
      )
        return false;
    }
    return true;
  } catch (error) {
    if (
      error instanceof SyntaxError ||
      ["ENOENT", "ENOTDIR", "EISDIR"].includes(error.code)
    )
      return false;
    throw error;
  }
}

/**
 * @param {unknown} value
 * @returns {value is {schemaVersion: 1, files: {path: string, sha256: string}[]}}
 */
function isRuntimeInventory(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    "schemaVersion" in value &&
    value.schemaVersion === 1 &&
    "files" in value &&
    Array.isArray(value.files) &&
    value.files.every(
      (file) =>
        file !== null &&
        typeof file === "object" &&
        typeof file.path === "string" &&
        typeof file.sha256 === "string" &&
        /^[a-f0-9]{64}$/u.test(file.sha256),
    )
  );
}

/**
 * All generated files except the inventory itself, in portable path order.
 * @param {string} directory
 * @returns {Promise<string[]>}
 */
async function runtimeFiles(directory) {
  const entries = await fs.readdir(directory, {
    recursive: true,
    withFileTypes: true,
  });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path
        .relative(directory, path.join(entry.parentPath, entry.name))
        .split(path.sep)
        .join("/"),
    )
    .filter((file) => file !== RUNTIME_INVENTORY)
    .sort();
}

/** @param {string} file */
async function digest(file) {
  return createHash("sha256")
    .update(await fs.readFile(file))
    .digest("hex");
}
