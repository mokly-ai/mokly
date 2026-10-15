import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { TestContext } from "node:test";

export async function sidecarSources(context: TestContext) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-side-sources-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const head = path.join(root, "head");
  const base = path.join(root, "base");
  await fs.mkdir(head);
  await fs.mkdir(base);
  return { root, head, base };
}

export async function dependency(
  directory: string,
  name: string,
  source: string,
  extension = "mjs",
) {
  const target = path.join(directory, "node_modules", name);
  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(
    path.join(target, "package.json"),
    JSON.stringify({ name, main: `index.${extension}` }),
  );
  await fs.writeFile(path.join(target, `index.${extension}`), source);
  return target;
}
