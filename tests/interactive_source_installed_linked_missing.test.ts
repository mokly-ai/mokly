import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { build } from "esbuild";

import { interactiveSourceResolver } from "../dist/interactive/source_resolution.js";

import { installedLinkedFixture } from "./helpers/installed_linked.js";
import {
  acceptedStyles,
  compileLiveStyles,
} from "./helpers/interactive_styles.js";

test("an unrecorded repository relative request fails even when its source blob is saved", async (t) => {
  const fixture = await installedLinkedFixture();
  t.after(() => fixture.remove());
  await fs.writeFile(
    path.join(fixture.entriesDir, "local.ts"),
    'console.log("saved-local");',
  );
  await fs.appendFile(fixture.entryPath, '\nimport "./local.ts";');
  const accepted = await acceptedStyles(fixture.root);
  const sources = accepted.interactiveSources!;
  await assert.rejects(
    compileLiveStyles({
      ...accepted,
      interactiveSources: {
        ...sources,
        resolutions: sources.resolutions.filter(
          ({ specifier }) => specifier !== "./local.ts",
        ),
      },
    }),
    {
      code: "interactive-bundle",
      reason: "source-not-captured",
      module: "entries/local.ts",
      importer: "entries/fixture.mockup.tsx",
    },
  );
});

for (const request of ["package name", "relative", "absolute"] as const) {
  test(`an unrecorded installed ${request} request for saved repository source fails with its typed diagnostic`, async (t) => {
    const fixture = await installedLinkedFixture();
    t.after(() => fixture.remove());
    const accepted = await acceptedStyles(fixture.root);
    const specifier =
      request === "package name"
        ? "linked-package"
        : request === "relative"
          ? "../../packages/linked-package/index.ts"
          : path.join(fixture.linked, "index.ts");
    await fs.writeFile(
      path.join(fixture.installed, "index.js"),
      `export { marker } from ${JSON.stringify(specifier)};`,
    );
    await fs.writeFile(
      path.join(fixture.linked, "index.ts"),
      "invalid repository syntax!",
    );
    const sources = accepted.interactiveSources!;
    await assert.rejects(
      compileLiveStyles({
        ...accepted,
        interactiveSources: {
          ...sources,
          resolutions: sources.resolutions.filter(
            ({ importer }) => importer.type !== "installed",
          ),
        },
      }),
      {
        code: "interactive-bundle",
        reason: "source-not-captured",
        module:
          request === "package name"
            ? "node_modules/linked-package/index.ts"
            : "packages/linked-package/index.ts",
        importer: "node_modules/outer-package/index.js",
      },
    );
  });
}

for (const selector of ["browser condition", "browser field"] as const) {
  for (const target of ["captured", "uncaptured"] as const) {
    test(`${selector} selects an unrecorded installed importer of ${target} repository source`, async (t) => {
      const fixture = await installedLinkedFixture();
      t.after(() => fixture.remove());
      const metadata =
        selector === "browser condition"
          ? { exports: { browser: "./browser.js", node: "./index.js" } }
          : { main: "./index.js", browser: "./browser.js" };
      await fs.writeFile(
        path.join(fixture.installed, "package.json"),
        JSON.stringify({ name: "outer-package", type: "module", ...metadata }),
      );
      await fs.writeFile(
        path.join(fixture.installed, "browser.js"),
        `export { marker } from "linked-package${target === "uncaptured" ? "/browser" : ""}";`,
      );
      await fs.writeFile(
        path.join(fixture.linked, "package.json"),
        JSON.stringify({
          name: "linked-package",
          type: "module",
          exports: { ".": "./index.ts", "./browser": "./browser.ts" },
        }),
      );
      await fs.writeFile(
        path.join(fixture.linked, "browser.ts"),
        "invalid browser-only repository syntax!",
      );
      const accepted = await acceptedStyles(fixture.root);
      assert.ok(
        !accepted.interactiveSources!.resolutions.some(
          ({ importer }) =>
            importer.type !== "entry" && importer.path.endsWith("browser.js"),
        ),
      );
      await assert.rejects(compileLiveStyles(accepted), {
        code: "interactive-bundle",
        reason: "source-not-captured",
        module: `node_modules/linked-package/${target === "captured" ? "index" : "browser"}.ts`,
        importer: "node_modules/outer-package/browser.js",
      });
    });
  }
}

test("an outside-root installed importer of repository source has no record and fails with its typed diagnostic", async (t) => {
  const fixture = await installedLinkedFixture();
  t.after(() => fixture.remove());
  const outside = `${fixture.root}-outside`;
  const installed = path.join(outside, "node_modules/outer-package/index.js");
  await fs.mkdir(path.dirname(installed), { recursive: true });
  t.after(() => fs.rm(outside, { recursive: true, force: true }));
  const importer = path.join(fixture.installed, "index.js");
  await fs.rename(importer, installed);
  await fs.symlink(installed, importer);
  const accepted = await acceptedStyles(fixture.root);
  assert.ok(
    !accepted.interactiveSources!.resolutions.some(
      ({ importer }) => importer.type === "installed",
    ),
  );
  await assert.rejects(compileLiveStyles(accepted), {
    code: "interactive-bundle",
    reason: "source-not-captured",
    module: "node_modules/linked-package/index.ts",
    importer: "node_modules/outer-package/index.js",
  });
});

test("physical-only paths under a symlinked root keep logical diagnostic identities", async (t) => {
  const fixture = await installedLinkedFixture();
  t.after(() => fixture.remove());
  const root = `${fixture.root}-alias`;
  await fs.symlink(fixture.root, root);
  t.after(() => fs.rm(root));
  await fs.writeFile(
    path.join(fixture.installed, "package.json"),
    JSON.stringify({
      type: "module",
      main: "./index.js",
      browser: "./browser.js",
    }),
  );
  await fs.writeFile(
    path.join(fixture.installed, "browser.js"),
    'export { marker } from "linked-package";',
  );
  const accepted = await acceptedStyles(root);
  const resolver = interactiveSourceResolver(
    accepted.config,
    accepted.interactiveSources!,
  );
  await assert.rejects(
    build({
      absWorkingDir: root,
      bundle: true,
      entryPoints: [path.join(fixture.installed, "browser.js")],
      logLevel: "silent",
      platform: "browser",
      preserveSymlinks: true,
      plugins: [resolver.plugin],
      write: false,
    }),
  );
  const failure = resolver.failure();
  assert.ok(failure);
  assert.equal(failure.reason, "source-not-captured");
  assert.equal(failure.module, "node_modules/linked-package/index.ts");
  assert.equal(failure.importer, "node_modules/outer-package/browser.js");
});

test("a browser-only installed import of an uncaptured repository file link fails before loading its bytes", async (t) => {
  const fixture = await installedLinkedFixture();
  t.after(() => fixture.remove());
  await fs.writeFile(
    path.join(fixture.installed, "package.json"),
    JSON.stringify({
      type: "module",
      exports: { node: "./index.js", browser: "./browser.js" },
    }),
  );
  await fs.writeFile(
    path.join(fixture.installed, "browser.js"),
    'export { marker } from "./browser-only.js";',
  );
  await fs.writeFile(
    path.join(fixture.linked, "browser.ts"),
    "invalid repository syntax!",
  );
  const accepted = await acceptedStyles(fixture.root);
  await fs.symlink(
    path.join(fixture.linked, "browser.ts"),
    path.join(fixture.installed, "browser-only.js"),
  );
  await assert.rejects(compileLiveStyles(accepted), {
    code: "interactive-bundle",
    reason: "source-not-captured",
    module: "node_modules/outer-package/browser-only.js",
    importer: "node_modules/outer-package/browser.js",
  });
});
