import fs from "node:fs/promises";
import path from "node:path";
import type { TestContext } from "node:test";

import { compileCatalogue } from "../../dist/build/compile.js";
import { loadConfig } from "../../dist/config/load.js";
import { generateLargeFixture } from "../fixtures/large/generate.js";

export async function styleRouteLargeFixture(context: TestContext) {
  const root = await fs.mkdtemp(path.resolve(".context/m8-rnw-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  await generateLargeFixture(root, {
    areas: 2,
    screens: 2,
    rows: 1,
    stylesheets: 1,
    inlineStyles: true,
  });
  const config = await loadConfig(root);
  const before = await compileCatalogue(config);
  const file = path.join(root, "renderer.tsx");
  await fs.writeFile(
    file,
    (await fs.readFile(file, "utf8")).replace(
      'const AREA_ONE_ACTION_COLOR = "rgba(1,2,3,1.00)";',
      'const AREA_ONE_ACTION_COLOR = "rgba(4,5,6,1.00)";',
    ),
  );
  const after = await compileCatalogue(config);
  const resources = new Map<string, string | Uint8Array>();
  for (const route of await fs.readdir(config.mockupsDir, { recursive: true }))
    if ((await fs.stat(path.join(config.mockupsDir, route))).isFile())
      resources.set(
        route,
        await fs.readFile(path.join(config.mockupsDir, route)),
      );
  return {
    before: before.manifest,
    after: after.manifest,
    beforeFiles: new Map([...before.outputs, ...resources]),
    afterFiles: new Map([...after.outputs, ...resources]),
    config,
    changedPaths: ["renderer.tsx"],
  };
}
