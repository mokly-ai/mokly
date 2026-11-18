import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { TestContext } from "node:test";

import { bundleParams } from "./sidecar.js";

export async function editSource(context: TestContext) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-edit-"));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const root = await fs.realpath(directory);
  const write = async (name: string, text: string) => {
    const file = path.join(root, name);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, text);
  };
  await write("entry.ts", "export const value='original';");
  await write("package.json", '{"name":"edit-fixture"}');
  const params = bundleParams({
    sourceRoot: root,
    entryFiles: ["entry.ts"],
    storiesFiles: [],
    renderer: null,
    moduleResolution: { ...bundleParams().moduleResolution, packageRoots: [] },
  });
  return { root, write, params };
}
