import fs from "node:fs/promises";
import path from "node:path";
import type { TestContext } from "node:test";

import { write } from "./native_resolution.js";
import { folderPackage } from "./package_folder.js";

export type FolderLink = "manifest" | "selected" | "both";

export async function linkedFolder(
  context: TestContext,
  kind: FolderLink,
  folder: boolean,
  internal: boolean,
): ReturnType<typeof folderPackage> {
  const field = internal ? "imports" : "exports";
  const prefix = internal ? "#sub/" : "./sub/";
  const fixture = await folderPackage(context, {
    name: `${kind} ${field} ${folder}`,
    route: "installed",
    manifest: JSON.stringify({
      name: "chosen",
      [field]: folder
        ? { [prefix]: "./lib/" }
        : { [prefix + "value"]: "./lib/value/index.js" },
    }),
  });
  if (internal) {
    await write(
      path.join(fixture.pkg, "entry.mjs"),
      'export {value} from "#sub/value";',
    );
    await write(
      path.join(fixture.root, "entry.mjs"),
      'export {value} from "./node_modules/chosen/entry.mjs";',
    );
  }
  if (kind === "selected" || kind === "both") {
    const target = path.join(fixture.root, "shared/index.js");
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.rename(fixture.original, target);
    await fs.symlink(target, fixture.original, "file");
  }
  if (kind === "manifest" || kind === "both") {
    const file = path.join(fixture.pkg, "package.json");
    const target = path.join(
      path.dirname(fixture.root),
      "metadata/chosen/package.json",
    );
    await write(target, await fs.readFile(file, "utf8"));
    await fs.unlink(file);
    await fs.symlink(target, file, "file");
  }
  return fixture;
}
