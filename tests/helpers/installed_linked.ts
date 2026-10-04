import fs from "node:fs/promises";
import path from "node:path";

import { createFixture, validEntrySource } from "./fixture.js";

/** A physical package that imports a repository workspace through node_modules. */
export async function installedLinkedFixture() {
  const fixture = await createFixture(
    `import { marker } from "outer-package";\n${validEntrySource({ body: "<span>{marker}</span>" })}`,
    { extraConfig: 'interactive: "serve",' },
  );
  const installed = path.join(fixture.root, "node_modules/outer-package");
  const linked = path.join(fixture.root, "packages/linked-package");
  for (const directory of [installed, linked])
    await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(
    path.join(installed, "package.json"),
    JSON.stringify({
      name: "outer-package",
      type: "module",
      exports: "./index.js",
    }),
  );
  await fs.writeFile(
    path.join(installed, "index.js"),
    'export { marker } from "linked-package";\n',
  );
  await fs.writeFile(
    path.join(linked, "package.json"),
    JSON.stringify({
      name: "linked-package",
      type: "module",
      exports: "./index.ts",
    }),
  );
  await fs.writeFile(
    path.join(linked, "index.ts"),
    'export const marker = "accepted-linked-source";\n',
  );
  await fs.symlink(
    "../packages/linked-package",
    path.join(fixture.root, "node_modules/linked-package"),
  );
  return { ...fixture, installed, linked };
}
