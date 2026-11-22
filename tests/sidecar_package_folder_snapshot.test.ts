import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { ImportKind } from "esbuild";

import { write } from "./helpers/native_resolution.js";
import { folderPackage } from "./helpers/package_folder.js";
import type { FolderCase } from "./helpers/package_folder.js";
import { folderSnapshot } from "./helpers/package_folder_snapshot.js";
import { nestedPnp } from "./helpers/pnp_reachability.js";

test("marked folder snapshots use native file, main-field, and index order", async (context) => {
  const cases: Array<
    FolderCase & { valid: boolean; requestKind?: ImportKind }
  > = [
    {
      name: "source extensions",
      original: "lib/value.js",
      extra: ["lib/value.ts"],
      valid: false,
    },
    {
      name: "installed JavaScript first",
      route: "installed",
      original: "lib/value.js",
      extra: ["lib/value.ts"],
      valid: true,
    },
    {
      name: "main field before index",
      nestedManifest: '{"main":"./main.js"}',
      extra: ["lib/value/main.js"],
      valid: false,
    },
    {
      name: "configured main-field order",
      mainFields: ["module", "main"],
      nestedManifest: '{"main":"./main.js","module":"./module.js"}',
      original: "lib/value/main.js",
      extra: ["lib/value/module.js"],
      valid: false,
    },
    {
      name: "only effective main fields",
      mainFields: ["module"],
      nestedManifest: '{"main":"./main.js","module":"./module.js"}',
      original: "lib/value/module.js",
      extra: ["lib/value/main.js"],
      valid: true,
    },
    {
      name: "first repeated main property",
      nestedManifest: '{"main":"./missing.js","main":"./later.js"}',
      extra: ["lib/value/later.js"],
      valid: true,
    },
    {
      name: "first non-string main property",
      nestedManifest: '{"main":false,"main":"./later.js"}',
      extra: ["lib/value/later.js"],
      valid: true,
    },
    {
      name: "require uses implicit main before module",
      requestKind: "require-call",
      nestedManifest: '{"module":"./module.js"}',
      extra: ["lib/value/module.js"],
      valid: true,
    },
    {
      name: "an empty main field keeps the implicit require main",
      requestKind: "require-call",
      nestedManifest: '{"main":"","module":"./module.js"}',
      extra: ["lib/value/module.js"],
      valid: true,
    },
    {
      name: "main file before its index",
      nestedManifest: '{"main":"./nested"}',
      original: "lib/value/nested/index.js",
      extra: ["lib/value/nested.ts"],
      valid: false,
    },
    {
      name: "file extensions before JavaScript rewrite",
      request: "chosen/sub/value.js",
      original: "lib/value.ts",
      extra: ["lib/value.js.ts"],
      valid: false,
    },
    {
      name: "a dot-only JavaScript basename still rewrites before its index",
      request: "chosen/sub/.js",
      original: "lib/.js/index.js",
      extra: ["lib/.ts"],
      valid: false,
    },
    {
      name: "CSS import filters script extensions",
      requestKind: "import-rule",
      original: "lib/value/index.css",
      extra: ["lib/value/index.ts"],
      valid: true,
    },
    {
      name: "CSS composes filters script extensions",
      requestKind: "composes-from",
      original: "lib/value/index.css",
      extra: ["lib/value/index.ts"],
      valid: true,
    },
    {
      name: "JavaScript import keeps script extensions",
      original: "lib/value/index.css",
      extra: ["lib/value/index.ts"],
      valid: false,
    },
  ];
  for (const row of cases) {
    const fixture = await folderPackage(context, row);
    const snapshot = await folderSnapshot(
      fixture.params,
      fixture.original,
      row.request,
      row.requestKind,
    );
    assert.equal(await snapshot.certify(), row.valid, row.name);
  }
});

test("marked folder extension order follows written node_modules components", async (context) => {
  for (const writtenInstalled of [true, false]) {
    const fixture = await folderPackage(context, {
      name: "written and canonical extension order differ",
      manifest: `{"name":"chosen","exports":{"./sub/":"./${writtenInstalled ? "node_modules/target" : "lib"}/"}}`,
      original: writtenInstalled
        ? "lib/value.js"
        : "node_modules/content/value.ts",
      extra: [
        writtenInstalled ? "lib/value.ts" : "node_modules/content/value.js",
      ],
    });
    const target = path.join(
      fixture.root,
      writtenInstalled ? "lib" : "node_modules/content",
    );
    const link = path.join(
      fixture.root,
      writtenInstalled ? "node_modules/target" : "lib",
    );
    await fs.mkdir(path.dirname(link), { recursive: true });
    await fs.symlink(target, link, "dir");
    const snapshot = await folderSnapshot(fixture.params, fixture.original);
    assert.equal(await snapshot.certify(), true, String(writtenInstalled));
  }
});

test("every folder target and reachable overlapping PnP root must certify the selection", async (context) => {
  const fixture = await folderPackage(context, {
    name: "one target passes and one target has an earlier file",
    manifest:
      '{"name":"chosen","exports":{"./sub/":{"import":"./a/","require":"./b/"}}}',
    original: "b/value/index.js",
    extra: ["a/value.ts"],
  });
  await fs.symlink(
    path.dirname(fixture.original),
    path.join(fixture.root, "a/value"),
    "dir",
  );
  const snapshot = await folderSnapshot(fixture.params, fixture.original);
  assert.equal(
    await snapshot.certify(),
    false,
    "a passing target cannot hide a failing target",
  );
  const pnp = await nestedPnp(context);
  await pnp.owner("inner", true);
  await write(
    path.join(pnp.outer, "package.json"),
    '{"name":"chosen","exports":{"./sub/":"./a/"}}',
  );
  await write(
    path.join(pnp.inner, "package.json"),
    '{"name":"chosen","exports":{"./sub/":"./lib/"}}',
  );
  await write(
    path.join(pnp.outer, "a/value.ts"),
    'export const value="preferred-file";',
  );
  await fs.symlink(
    path.join(pnp.inner, "lib/value"),
    path.join(pnp.outer, "a/value"),
    "dir",
  );
  const overlap = await folderSnapshot(
    pnp.params,
    path.join(pnp.inner, "lib/value/index.js"),
  );
  assert.equal(
    await overlap.certify(),
    false,
    "a passing PnP root cannot hide a failing reachable root",
  );
  const contained = await folderPackage(context, {
    name: "containment has no candidate position",
    original: "lib/value/nested/unknown.js",
  });
  assert.equal(
    await (
      await folderSnapshot(contained.params, contained.original)
    ).certify(),
    false,
  );
});

test("marked folder snapshots fold each name code point with native lowercase", async (context) => {
  for (const row of [
    { request: "chosen/sub/i", folder: "i", listed: "İ.ts", valid: false },
    { request: "chosen/sub/οσ", folder: "οσ", listed: "ΟΣ", valid: false },
    { request: "chosen/sub/ος", folder: "ος", listed: "ΟΣ", valid: true },
  ]) {
    const fixture = await folderPackage(context, {
      name: row.listed,
      request: row.request,
      original: `lib/${row.folder}/index.js`,
      extra: [`lib/${row.listed}`],
    });
    const snapshot = await folderSnapshot(
      fixture.params,
      fixture.original,
      row.request,
    );
    assert.equal(await snapshot.certify(), row.valid, row.request);
  }
});

test("marked folder proof uses final recorded listings and fails without a needed listing", async (context) => {
  const fixture = await folderPackage(context, {
    name: "recorded snapshot remains authoritative",
  });
  const snapshot = await folderSnapshot(fixture.params, fixture.original);
  assert.equal(await snapshot.certify(), true);
  await fixture.addPreferred();
  assert.equal(
    await snapshot.certify(),
    true,
    "later disk state cannot replace the recorded names",
  );
  snapshot.listings[path.join(fixture.pkg, "lib")]!.push("value.ts");
  assert.equal(
    await snapshot.certify(),
    false,
    "the final recorded candidate defeats the old selection",
  );
  delete snapshot.listings[path.join(fixture.pkg, "lib")];
  assert.equal(
    await snapshot.certify(),
    false,
    "a missing listing cannot prove candidate absence",
  );
  const linked = await folderPackage(context, {
    name: "recorded nonempty directory exempts a pinned link",
  });
  await fs.symlink(path.dirname(linked.original), linked.preferred, "dir");
  const linkedSnapshot = await folderSnapshot(linked.params, linked.original);
  assert.equal(
    await linkedSnapshot.certify(),
    true,
    "the pinned target has a nonempty recorded directory listing",
  );
  linkedSnapshot.listings[path.dirname(linked.original)] = [];
  assert.equal(
    await linkedSnapshot.certify(),
    false,
    "an empty target listing proves no directory kind",
  );
  const mapped = await folderPackage(context, {
    name: "a source-side directory cannot prove the pinned physical target kind",
  });
  const external = path.join(path.dirname(mapped.root), "external");
  const target = path.join(external, "lib/value");
  await write(target, "a physical file");
  mapped.params.repositoryRoots.push(external);
  await fs.symlink(target, mapped.preferred, "file");
  const mappedSnapshot = await folderSnapshot(mapped.params, mapped.original);
  assert.equal(
    await mappedSnapshot.certify(),
    false,
    "a different nonempty mapped listing cannot exempt a pinned file",
  );
});
