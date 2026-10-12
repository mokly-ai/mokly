import fs from "node:fs/promises";
import path from "node:path";

export async function fileTree(root: string): Promise<Map<string, Buffer>> {
  const files = new Map<string, Buffer>();
  async function visit(directory: string) {
    for (const entry of await fs.readdir(path.join(root, directory), {
      withFileTypes: true,
    })) {
      const relative = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(relative);
      else if (entry.isFile())
        files.set(relative, await fs.readFile(path.join(root, relative)));
      else throw new Error(`Unexpected fixture file kind: ${relative}`);
    }
  }
  await visit("");
  return files;
}

export async function fixtureSetupTree(root: string) {
  return new Map([
    ["renderer.tsx", await fs.readFile(path.join(root, "renderer.tsx"))],
    ...[...(await fileTree(path.join(root, "mockups")))].map(
      ([relative, bytes]) => [`mockups/${relative}`, bytes] as const,
    ),
  ]);
}
