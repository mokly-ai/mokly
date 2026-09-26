import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const EXPORT_MARKER = ".mokly-export-artifact";

type OwnershipContent = string | Uint8Array;

export interface TestOwnershipEntry {
  path: string;
  sha256: string;
  size: number;
}

export interface TestOwnershipMarker {
  schemaVersion: 2;
  files: TestOwnershipEntry[];
}

/** Build a schema 2 ownership marker from exact in-memory file bytes. */
export function ownershipMarkerFromFiles(
  files: ReadonlyMap<string, OwnershipContent>,
): TestOwnershipMarker {
  const names = [...files.keys()]
    .filter((name) => name !== EXPORT_MARKER)
    .sort();
  return {
    schemaVersion: 2,
    files: names.map((name) => {
      const content = files.get(name);
      if (content === undefined) throw new Error(`Missing test file: ${name}`);
      const bytes =
        typeof content === "string"
          ? Buffer.from(content)
          : Buffer.from(content);
      return {
        path: name,
        sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
        size: bytes.length,
      };
    }),
  };
}

/** Build a schema 2 ownership marker from every regular file below a directory. */
export async function ownershipMarkerFromDirectory(
  directory: string,
): Promise<TestOwnershipMarker> {
  return ownershipMarkerFromFiles(await directoryFileMap(directory));
}

/** Write a schema 2 marker for the regular files already present in a directory. */
export async function writeOwnershipMarker(directory: string): Promise<void> {
  const marker = await ownershipMarkerFromDirectory(directory);
  await fs.promises.writeFile(
    path.join(directory, EXPORT_MARKER),
    `${JSON.stringify(marker, null, 2)}\n`,
  );
}

async function directoryFileMap(
  directory: string,
  prefix = "",
): Promise<Map<string, Buffer>> {
  const files = new Map<string, Buffer>();
  for (const entry of await fs.promises.readdir(directory, {
    withFileTypes: true,
  })) {
    const name = `${prefix}${entry.name}`;
    if (name === EXPORT_MARKER) continue;
    if (entry.isDirectory()) {
      const nested = await directoryFileMap(
        path.join(directory, entry.name),
        `${name}/`,
      );
      for (const file of nested) files.set(...file);
    } else if (entry.isFile()) {
      files.set(
        name,
        await fs.promises.readFile(path.join(directory, entry.name)),
      );
    } else throw new Error(`Unsupported test ownership entry: ${name}`);
  }
  return files;
}
