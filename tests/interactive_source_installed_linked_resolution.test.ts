import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { installedLinkedFixture } from "./helpers/installed_linked.js";
import {
  acceptedStyles,
  compileLiveStyles,
} from "./helpers/interactive_styles.js";

for (const layout of [
  "logical",
  "pnpm alias",
  "pnpm physical",
  "symlinked root",
  "importer symlink",
  "repository file symlink",
] as const) {
  test(`installed-to-repository requests replay with ${layout}`, async (t) => {
    const fixture = await installedLinkedFixture();
    t.after(() => fixture.remove());
    let root = fixture.root;
    let importer = "node_modules/outer-package/index.js";
    let specifier = "linked-package";
    let target = "node_modules/linked-package/index.ts";
    if (layout.startsWith("pnpm")) {
      const physical = path.join(
        root,
        "node_modules/.pnpm/outer-package@1.0.0/node_modules/outer-package",
      );
      await fs.mkdir(path.dirname(physical), { recursive: true });
      await fs.rename(fixture.installed, physical);
      await fs.symlink(
        path.relative(path.dirname(fixture.installed), physical),
        fixture.installed,
      );
      if (layout === "pnpm physical") {
        const front = path.join(root, "node_modules/front-package");
        await fs.mkdir(front);
        await fs.writeFile(
          path.join(front, "package.json"),
          '{"type":"module","exports":"./index.js"}',
        );
        await fs.writeFile(
          path.join(front, "index.js"),
          'export { marker } from "../.pnpm/outer-package@1.0.0/node_modules/outer-package/index.js";',
        );
        await fs.writeFile(
          fixture.entryPath,
          (await fs.readFile(fixture.entryPath, "utf8")).replace(
            '"outer-package"',
            '"front-package"',
          ),
        );
        importer =
          "node_modules/.pnpm/outer-package@1.0.0/node_modules/outer-package/index.js";
      }
    } else if (layout === "symlinked root") {
      root = `${fixture.root}-alias`;
      await fs.symlink(fixture.root, root);
      t.after(() => fs.rm(root));
    } else if (layout === "importer symlink") {
      await fs.rename(
        path.join(fixture.installed, "index.js"),
        path.join(fixture.installed, "implementation.js"),
      );
      await fs.symlink(
        "implementation.js",
        path.join(fixture.installed, "index.js"),
      );
    } else if (layout === "repository file symlink") {
      specifier = "./linked.js";
      target = "node_modules/outer-package/linked.js";
      await fs.symlink(
        path.join(fixture.linked, "index.ts"),
        path.join(fixture.installed, "linked.js"),
      );
      await fs.writeFile(
        path.join(fixture.installed, "index.js"),
        'export { marker } from "./linked.js";',
      );
    }
    const accepted = await acceptedStyles(root);
    assert.deepEqual(
      accepted.interactiveSources!.resolutions.filter(
        ({ importer }) => importer.type === "installed",
      ),
      [
        {
          attributes: [],
          importer: { path: importer, type: "installed" },
          kind: "import-statement",
          specifier,
          target,
        },
      ],
    );
    await fs.rm(path.join(fixture.linked, "index.ts"));
    assert.match(await compileLiveStyles(accepted), /accepted-linked-source/);
  });
}

test("installed importer replay keeps accepted repository export conditions and metadata", async (t) => {
  const fixture = await installedLinkedFixture();
  t.after(() => fixture.remove());
  const metadata = path.join(fixture.linked, "package.json");
  await fs.writeFile(
    metadata,
    JSON.stringify({
      type: "module",
      exports: { node: "./index.ts", browser: "./browser.ts" },
    }),
  );
  await fs.writeFile(
    path.join(fixture.linked, "browser.ts"),
    'export const marker = "browser-repository-source";',
  );
  const accepted = await acceptedStyles(fixture.root);
  const before = await compileLiveStyles(accepted);
  assert.match(before, /accepted-linked-source/);
  assert.doesNotMatch(before, /browser-repository-source/);
  await fs.writeFile(metadata, '{"type":"module","exports":"./browser.ts"}');
  await fs.rm(path.join(fixture.linked, "index.ts"));
  assert.equal(await compileLiveStyles(accepted), before);
  assert.match(
    await compileLiveStyles(await acceptedStyles(fixture.root)),
    /browser-repository-source/,
  );
});

test("physical installed JavaScript remains unpinned beside its pinned repository request", async (t) => {
  const fixture = await installedLinkedFixture();
  t.after(() => fixture.remove());
  const index = path.join(fixture.installed, "index.js");
  const helper = path.join(fixture.installed, "helper.js");
  await fs.appendFile(
    index,
    'import { installed } from "./helper.js"; console.log(installed);',
  );
  await fs.writeFile(helper, 'export const installed = "installed-before";');
  const accepted = await acceptedStyles(fixture.root);
  assert.ok(
    !accepted.interactiveSources!.files.some(({ paths }) =>
      paths.includes("node_modules/outer-package/helper.js"),
    ),
  );
  assert.deepEqual(
    accepted
      .interactiveSources!.resolutions.filter(
        ({ importer }) => importer.type === "installed",
      )
      .map(({ target }) => target),
    ["node_modules/linked-package/index.ts"],
  );
  await fs.writeFile(helper, 'export const installed = "installed-after";');
  await fs.appendFile(index, 'console.log("outer-after");');
  await fs.writeFile(
    path.join(fixture.linked, "index.ts"),
    "invalid repository syntax!",
  );
  const code = await compileLiveStyles(accepted);
  for (const marker of [
    "installed-after",
    "outer-after",
    "accepted-linked-source",
  ])
    assert.ok(code.includes(marker));
  assert.doesNotMatch(code, /installed-before/);
});
