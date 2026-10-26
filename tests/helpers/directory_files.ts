import fs from "node:fs/promises";
import path from "node:path";

/** Read every file below `root`, keyed by its path relative to `root`. */
export async function files(root: string): Promise<Map<string, Buffer>> {
  const result = new Map<string, Buffer>();
  const walk = async (directory: string) => {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(file);
      else result.set(path.relative(root, file), await fs.readFile(file));
    }
  };
  await walk(root);
  return result;
}
