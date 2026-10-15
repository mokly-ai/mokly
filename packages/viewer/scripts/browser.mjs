import fs from "node:fs/promises";

/** Path of the generated inventory adjacent to one browser output directory. */
export function browserManifestPath(target) {
  return `${target}.manifest.json`;
}

/** Record the exact JavaScript outputs after every browser asset is built. */
export async function writeBrowserManifest(target) {
  const entries = await fs.readdir(target, { withFileTypes: true });
  const modules = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
    .map((entry) => entry.name)
    .sort();
  if (modules.length !== entries.length)
    throw new Error(`Unexpected browser build output in ${target}`);
  await fs.writeFile(
    browserManifestPath(target),
    `${JSON.stringify({ schemaVersion: 1, modules }, null, 2)}\n`,
  );
}
