import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { checkCompilation } from "../dist/build/check.js";
import { compileCatalogue } from "../dist/build/compile.js";
import { validateGeneratedOutputPaths } from "../dist/build/output_paths.js";
import {
  generatedOwnershipDenial,
  pendingGeneratedOrphanRoutes,
  unclaimedGeneratedRoutes,
} from "../dist/build/ownership.js";
import { assetRoute, stylesheetRoute } from "../dist/build/styles/routes.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { isPublicStaticFile } from "../dist/config/public_files.js";
import { startCatalogueServer } from "../dist/server/http.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

const directory = "mokly-generated";
const stylesheet = `${directory}/styles/src/fixture.mockup.tsx.css`;
const asset = `${directory}/assets/node_modules/@fontsource/inter/files/regular.woff2`;

test("generated routes accept only portable stylesheets and supported assets", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  assert.equal(
    stylesheetRoute(
      path.join(fixture.root, "src/fixture.mockup.tsx"),
      fixture.root,
    ),
    stylesheet,
  );
  assert.equal(
    assetRoute(
      path.join(
        fixture.root,
        "node_modules/@fontsource/inter/files/regular.woff2",
      ),
      fixture.root,
    ),
    asset,
  );
  assert.throws(
    () =>
      assetRoute(
        path.join(fixture.root, "node_modules/@bad scope/regular.woff2"),
        fixture.root,
      ),
    /CSS asset route is not portable: node_modules\/@bad scope\/regular.woff2; rename every path segment/,
  );
  assert.throws(
    () =>
      stylesheetRoute(
        path.join(fixture.root, "src/AUX.mockup.tsx"),
        fixture.root,
      ),
    /generated stylesheet route is not portable: mokly-generated\/styles\/src\/AUX.mockup.tsx.css; rename the root module/,
  );
  assert.doesNotThrow(() =>
    validateGeneratedOutputPaths([stylesheet, asset], config),
  );
  for (const route of [
    `${directory}/bad.html`,
    `${directory}/styles/a.txt`,
    `${directory}/assets/x.exe`,
    `${directory}/assets/@fontsource/x.woff2`,
    `${directory}/assets/node_modules/@scope/aux.woff2`,
    `${directory}/styles/a space.tsx.css`,
  ]) {
    assert.throws(
      () => validateGeneratedOutputPaths([route], config),
      /generated route is unsafe:|route is not portable:/,
      route,
    );
  }
});

test("all reserved files are owned, removed as orphans, and empty directories are pruned", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const baseline = await compileCatalogue(config);
  const outputs = new Map(baseline.outputs);
  outputs.set(stylesheet, "body {}\n");
  outputs.set(asset, Buffer.from([0xff, 0x00, 0x80]));
  await fs.mkdir(path.join(fixture.mockupsDir, "other"));
  await fs.mkdir(path.join(fixture.mockupsDir, "other", "empty"));
  await fs.writeFile(
    path.join(fixture.mockupsDir, "other", "public.css"),
    "public",
  );
  const extra = `${directory}/styles/stale/nested.css`;
  await fs.mkdir(path.dirname(path.join(fixture.mockupsDir, extra)), {
    recursive: true,
  });
  await fs.writeFile(path.join(fixture.mockupsDir, extra), "stale");
  assert.equal(
    generatedOwnershipDenial(path.join(fixture.mockupsDir, extra), config),
    undefined,
  );
  assert.deepEqual(pendingGeneratedOrphanRoutes(config, outputs.keys()), [
    extra,
  ]);
  assert.deepEqual(unclaimedGeneratedRoutes(config), []);
  await writeCompilation({ ...baseline, outputs }, config);
  assert.equal(
    await fs.readFile(path.join(fixture.mockupsDir, asset), "hex"),
    "ff0080",
  );
  assert.equal(
    isPublicStaticFile(path.join(fixture.mockupsDir, asset), config),
    true,
  );
  const server = await startCatalogueServer(config, { base: "main", port: 0 });
  fixture.beforeRemove(() => server.close());
  const response = await fetch(
    `${server.url}/static/${asset.replace("@fontsource", "%40fontsource")}`,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(
    Buffer.from(await response.arrayBuffer()),
    Buffer.from([0xff, 0x00, 0x80]),
  );
  assert.deepEqual(
    await fs
      .stat(path.join(fixture.mockupsDir, directory, "styles", "stale"))
      .catch(() => undefined),
    undefined,
  );
  await fs
    .writeFile(path.join(fixture.mockupsDir, extra), "orphan")
    .catch(async () => {
      await fs.mkdir(path.dirname(path.join(fixture.mockupsDir, extra)), {
        recursive: true,
      });
      await fs.writeFile(path.join(fixture.mockupsDir, extra), "orphan");
    });
  assert.throws(
    () => checkCompilation({ ...baseline, outputs }, config),
    /orphan generated files:[\s\S]*mokly-generated\/styles\/stale\/nested.css/,
  );
  await writeCompilation(baseline, config);
  assert.equal(
    await fs
      .stat(path.join(fixture.mockupsDir, directory))
      .catch(() => undefined),
    undefined,
  );
  assert.equal(
    await fs.readFile(
      path.join(fixture.mockupsDir, "other", "public.css"),
      "utf8",
    ),
    "public",
  );
  assert.equal(
    (
      await fs.stat(path.join(fixture.mockupsDir, "other", "empty"))
    ).isDirectory(),
    true,
  );
});

test("Build and committed Check reject every non-regular reserved entry without following it", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const baseline = await compileCatalogue(config);
  const root = path.join(fixture.mockupsDir, directory);
  const outside = path.join(fixture.mockupsDir, "consumer.css");
  await fs.writeFile(outside, "consumer");
  const cases = [
    { route: directory, create: () => fs.writeFile(root, "not a directory") },
    { route: directory, create: () => fs.symlink("../", root) },
    {
      route: `${directory}/styles`,
      create: async () => {
        await fs.mkdir(root);
        await fs.symlink("../../", path.join(root, "styles"));
      },
    },
    {
      route: `${directory}/styles/dangling`,
      create: async () => {
        await fs.mkdir(path.join(root, "styles"), { recursive: true });
        await fs.symlink("missing", path.join(root, "styles", "dangling"));
      },
    },
    {
      route: `${directory}/styles/pipe`,
      create: async () => {
        await fs.mkdir(path.join(root, "styles"), { recursive: true });
        execFileSync("mkfifo", [path.join(root, "styles", "pipe")]);
      },
    },
  ];
  for (const { route, create } of cases) {
    await create();
    const message = `mokly-generated/ contains a symlink or non-regular entry: mockups/${route}; delete it before building or checking`;
    for (const run of [
      () => checkCompilation(baseline, config),
      () => writeCompilation(baseline, config),
    ]) {
      await assert.rejects(
        async () => run(),
        (error: Error & { code?: string }) =>
          error.code === "build-invalid" &&
          error.message === `[mokly/build-invalid] ${message}`,
        route,
      );
    }
    await fs.rm(root, { recursive: true, force: true });
  }
  await fs.mkdir(root);
  for (const name of ["z", "a"])
    await fs.symlink("missing", path.join(root, name));
  assert.throws(
    () => checkCompilation(baseline, config),
    /mokly-generated\/ contains a symlink or non-regular entry: mockups\/mokly-generated\/a; delete it/,
  );
  await fs.rm(root, { recursive: true, force: true });
  await fs.mkdir(path.join(root, "a"), { recursive: true });
  await fs.symlink("missing", path.join(root, "a", "z"));
  await fs.symlink("missing", path.join(root, "a.css"));
  assert.throws(
    () => checkCompilation(baseline, config),
    (error: Error & { code?: string }) =>
      error.code === "build-invalid" &&
      error.message ===
        "[mokly/build-invalid] mokly-generated/ contains a symlink or non-regular entry: mockups/mokly-generated/a.css; delete it before building or checking",
  );
  await fs.rm(root, { recursive: true, force: true });
  assert.equal(await fs.readFile(outside, "utf8"), "consumer");
});

test("generated routes collide with consumer exclusions including defaults", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  for (const [glob, route] of [
    ["**/*.css", stylesheet],
    ["**/README.*", `${directory}/styles/README.tsx.css`],
  ] as const) {
    const config = await loadConfig(fixture.root);
    const excluded =
      glob === "**/README.*" ? config : { ...config, publicExclude: [glob] };
    const message = `generated route matches public exclusion ${glob}: ${route}; narrow the exclusion so Mokly-generated files stay public`;
    assert.throws(
      () => validateGeneratedOutputPaths([route], excluded),
      (error: Error & { code?: string }) =>
        error.code === "build-invalid" &&
        error.message === `[mokly/build-invalid] ${message}`,
    );
    const baseline = await compileCatalogue(config);
    const outputs = new Map(baseline.outputs);
    outputs.set(route, "/* synthetic output */");
    await assert.rejects(
      writeCompilation({ ...baseline, outputs }, excluded),
      (error: Error & { code?: string }) =>
        error.code === "build-invalid" &&
        error.message === `[mokly/build-invalid] ${message}`,
    );
    if (glob === "**/*.css")
      assert.throws(
        () =>
          validateGeneratedOutputPaths(
            [route, `${directory}/styles/aaa.tsx.css`],
            excluded,
          ),
        /generated route matches public exclusion \*\*\/\*\.css: mokly-generated\/styles\/aaa.tsx.css/,
      );
    if (glob === "**/*.css")
      assert.throws(
        () =>
          validateGeneratedOutputPaths([`${directory}/invalid.css`], excluded),
        /generated route is unsafe: mokly-generated\/invalid.css; use mokly-generated\/styles/,
      );
  }
});
