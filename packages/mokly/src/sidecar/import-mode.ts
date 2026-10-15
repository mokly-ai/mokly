import fs from "node:fs/promises";
import path from "node:path";

/** Match esbuild's Node default-import rule for the authored importer. */
export async function nodeImportMode(
  file: string,
  packages: Map<string, Promise<boolean>>,
): Promise<boolean> {
  if (/\.(mjs|mts)$/.test(file)) return true;
  if (/\.(cjs|cts)$/.test(file)) return false;
  const lookup = (directory: string): Promise<boolean> => {
    let result = packages.get(directory);
    if (!result) {
      result = (async () => {
        try {
          const manifest = JSON.parse(
            await fs.readFile(path.join(directory, "package.json"), "utf8"),
          );
          return manifest.type === "module";
        } catch (error) {
          if (!(
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "ENOENT"
          ))
            throw error;
          const parent = path.dirname(directory);
          return parent !== directory ? lookup(parent) : false;
        }
      })();
      packages.set(directory, result);
    }
    return result;
  };
  return lookup(path.dirname(file));
}
