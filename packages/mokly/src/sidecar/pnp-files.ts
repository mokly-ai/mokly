import fs from "node:fs";
import path from "node:path";

const names = [".pnp.data.json", ".pnp.cjs", ".pnp.js"];

/** Native PnP discovery stops at the first regular state file, including absent higher priorities. */
export function* pnpFiles(
  directory: string,
): Generator<{ file: string; present: boolean }> {
  for (;;) {
    for (const name of names) {
      const file = path.join(directory, name);
      const present =
        fs.statSync(file, { throwIfNoEntry: false })?.isFile() ?? false;
      yield { file, present };
      if (present) return;
    }
    const parent = path.dirname(directory);
    if (parent === directory) return;
    directory = parent;
  }
}
