import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { discoverEntryModules } from "../dist/config/entry_discovery.js";
import { loadConfig } from "../dist/config/load.js";

import {
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";

for (const operation of ["read", "projection"] as const) {
  for (const code of ["EACCES", "EIO", "EMFILE", "EPERM", undefined]) {
    test(`discovery reports ${operation} failures (${code ?? "unknown"}) with directory context`, async (context) => {
      const { config, root } = await discoveryFixture(context);
      const candidate = path.join(root, "nested");
      const failure = Object.assign(new Error("filesystem failure"), { code });
      const method = operation === "read" ? "readdirSync" : "lstatSync";
      const original = fs[method];
      context.mock.method(fs, method, (...args: unknown[]) => {
        if (args[0] === candidate) throw failure;
        return Reflect.apply(original, fs, args);
      });
      assert.throws(() => discoverEntryModules(config), {
        code: "config-invalid",
        message: new RegExp(`src/nested.*${code ?? "unknown"}`),
        cause: failure,
      });
    });
  }
}

for (const code of ["ENOENT", "ENOTDIR"]) {
  test(`discovery lists a vanished directory projection (${code})`, async (context) => {
    const { config, root } = await discoveryFixture(context);
    await fs.promises.rm(path.join(root, "visible.mockup.tsx"));
    const candidate = path.join(root, "nested");
    const realpath = fs.realpathSync.native;
    context.mock.method(fs.realpathSync, "native", (...args: unknown[]) => {
      if (args[0] === candidate)
        throw Object.assign(new Error("vanished"), { code });
      return Reflect.apply(realpath, fs.realpathSync, args);
    });
    assert.throws(() => discoverEntryModules(config), {
      code: "config-invalid",
      message:
        /entries glob matches no module: src\/\*\*\/\*\.mockup\.tsx; not searched: src\/nested$/,
    });
  });
}

test("discovery drops a matched module that vanishes before validation", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const remaining = ["alpha.mockup.tsx", "omega.mockup.tsx"].map((name) =>
    path.join(fixture.entriesDir, name),
  );
  for (const candidate of remaining)
    await fs.promises.writeFile(candidate, validEntrySource());
  failModuleProjection(context, fixture.entryPath, "ENOENT");

  assert.deepEqual((await loadConfig(fixture.root)).entryModules, remaining);
});

test("discovery lists a vanished only match under not searched", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  failModuleProjection(context, fixture.entryPath, "ENOENT");

  await assert.rejects(loadConfig(fixture.root), {
    code: "config-invalid",
    message:
      /entries glob matches no module: entries\/\*\*\/\*\.mockup\.\{ts,tsx\}; not searched: entries\/fixture\.mockup\.tsx$/,
  });
});

test("discovery reports a matched module projection with ENOTDIR", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const failure = failModuleProjection(context, fixture.entryPath, "ENOTDIR");

  await assert.rejects(loadConfig(fixture.root), {
    code: "config-invalid",
    message:
      /cannot discover entry path entries\/fixture\.mockup\.tsx: ENOTDIR$/,
    cause: failure,
  });
});

test("discovery uses lexical review output when its projection fails", async (context) => {
  const { config, root } = await discoveryFixture(context);
  const outDir = path.join(root, "review");
  await fs.promises.mkdir(outDir);
  await fs.promises.writeFile(
    path.join(outDir, "review.mockup.tsx"),
    validEntrySource(),
  );
  const lstat = fs.lstatSync;
  context.mock.method(fs, "lstatSync", (...args: unknown[]) => {
    if (args[0] === outDir)
      throw Object.assign(new Error("unavailable review"), { code: "EACCES" });
    return Reflect.apply(lstat, fs, args);
  });
  const modules = discoverEntryModules({
    ...config,
    review: { ...config.review, outDir },
  });
  assert.deepEqual(modules, [
    path.join(root, "nested/hidden.mockup.tsx"),
    path.join(root, "visible.mockup.tsx"),
  ]);
});

test("discovery resolves repository and glob identities once for all modules", async (context) => {
  const { config, root } = await discoveryFixture(context);
  const realpath = fs.realpathSync;
  const native = fs.realpathSync.native;
  let repositoryReads = 0;
  let globReads = 0;
  const repeated = () => {
    throw Object.assign(new Error("repeated root projection"), { code: "EIO" });
  };
  context.mock.method(fs, "realpathSync", (...args: unknown[]) => {
    if (args[0] === config.repoRoot && ++repositoryReads > 1) repeated();
    return Reflect.apply(realpath, fs, args);
  });
  Object.assign(fs.realpathSync, { native });
  context.mock.method(fs.realpathSync, "native", (...args: unknown[]) => {
    if (args[0] === root && ++globReads > 1) repeated();
    return Reflect.apply(native, realpath, args);
  });
  assert.equal(discoverEntryModules(config).length, 2);
  assert.equal(repositoryReads, 1);
  assert.equal(globReads, 1);
});

/** Fail after the walk has found a module but before its real path is validated. */
function failModuleProjection(
  context: TestContext,
  candidate: string,
  code: string,
): Error {
  const failure = Object.assign(new Error("module projection failed"), {
    code,
  });
  const realpath = fs.realpathSync.native;
  context.mock.method(fs.realpathSync, "native", (...args: unknown[]) => {
    if (args[0] === candidate) throw failure;
    return Reflect.apply(realpath, fs.realpathSync, args);
  });
  return failure;
}

/** Keep a visible entry so swallowed errors would silently shrink the catalogue. */
async function discoveryFixture(context: TestContext) {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const root = path.join(fixture.root, "src");
  await fs.promises.mkdir(path.join(root, "nested"), { recursive: true });
  await fs.promises.writeFile(
    path.join(root, "visible.mockup.tsx"),
    validEntrySource(),
  );
  await fs.promises.writeFile(
    path.join(root, "nested/hidden.mockup.tsx"),
    validEntrySource(),
  );
  return { config: { ...config, entryGlobs: ["src/**/*.mockup.tsx"] }, root };
}
