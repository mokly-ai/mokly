import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";

import { generateLargeFixture } from "./fixtures/large/generate.js";
import { designLibraryFixture } from "./helpers/design_library_fixture.js";
import { repositoryRoot } from "./helpers/fixture.js";
import { inlineChangesFixture } from "./helpers/inline_changes.js";
import { pageFixtureInput } from "./helpers/page_fixture_inputs.js";
import { assertPageMaterialEquivalence } from "./helpers/page_material_oracle.js";

for (const mode of ["committed", "derived"] as const) {
  test(`design catalogue strings, resource seeds and closures equal the M6 oracle in ${mode}`, async (context) => {
    const fixture = await designLibraryFixture(context, mode);
    const files = new Map([...fixture.before.outputs, ...fixture.resources]);
    await assertPageMaterialEquivalence({
      before: fixture.before.manifest,
      after: fixture.before.manifest,
      beforeFiles: files,
      afterFiles: files,
      config: fixture.config,
      changedPaths: [],
    });
    await fixture.edit("examples/basic/theme.ts", (source) =>
      source.replace('accent: "#7fae95"', 'accent: "#7755aa"'),
    );
    const after = await compileCatalogue(fixture.config);
    await assertPageMaterialEquivalence({
      before: fixture.before.manifest,
      after: after.manifest,
      beforeFiles: files,
      afterFiles: new Map([...after.outputs, ...fixture.resources]),
      config: fixture.config,
      changedPaths: ["examples/basic/theme.ts"],
    });
  });
  for (const inlineStyles of [false, true])
    test(`small real scale renderer materials and closures equal M6, ${mode}, cumulative=${inlineStyles}`, async (context) => {
      const root = await fs.mkdtemp(
        path.join(repositoryRoot, ".context/page-scale-test-"),
      );
      context.after(() => fs.rm(root, { force: true, recursive: true }));
      await generateLargeFixture(
        root,
        { areas: 2, screens: 2, rows: 1, stylesheets: 1, inlineStyles },
        mode,
      );
      const config = await loadConfig(root);
      const before = await compileCatalogue(config);
      const file = path.join(root, "renderer.tsx");
      await fs.writeFile(
        file,
        (await fs.readFile(file, "utf8")).replace(
          '"rgba(1,2,3,1.00)"',
          '"rgba(4,5,6,1.00)"',
        ),
      );
      const after = await compileCatalogue(config);
      const resources = new Map<string, string | Uint8Array>();
      for (const file of await fs.readdir(config.mockupsDir, {
        recursive: true,
      }))
        if ((await fs.stat(path.join(config.mockupsDir, file))).isFile())
          resources.set(
            file,
            await fs.readFile(path.join(config.mockupsDir, file)),
          );
      await assertPageMaterialEquivalence({
        before: before.manifest,
        after: after.manifest,
        beforeFiles: new Map([...before.outputs, ...resources]),
        afterFiles: new Map([...after.outputs, ...resources]),
        config,
        changedPaths: ["renderer.tsx"],
      });
    });
  test(`inline ownership, references, copies and exclusions retain M6 material bytes in ${mode}`, async (context) => {
    const fixture = await inlineChangesFixture(
      context,
      '<style>.actual-only{background:url("../owned.svg")}.entry{background:url("../entry.svg")}.missing{color:red}</style>',
      '<style>.actual-only{background:url("../owned.svg")}.entry{background:url("../entry.svg")}.missing{color:blue}</style>',
      {
        colorSchemes: false,
        files: {
          before: { "owned.svg": "owned", "entry.svg": "entry" },
          after: { "owned.svg": "owned", "entry.svg": "entry" },
        },
      },
    );
    await assertPageMaterialEquivalence(await pageFixtureInput(fixture, mode));
  });
}
