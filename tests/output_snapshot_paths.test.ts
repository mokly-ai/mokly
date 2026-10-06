import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { projectRealPath } from "../packages/mokly/dist/config/paths.js";
import { isInternalCatalogueFile } from "../packages/mokly/dist/config/public_files.js";

import { pathFixture, pageSource } from "./helpers/path_fixture.js";

test("path projection retries an ordinary directory removed after lstat", async (t) => {
  const fixture = await pathFixture({ "specs/page.mockup.ts": pageSource() });
  t.after(fixture.remove);
  const directory = path.join(fixture.root, "generated/old"),
    file = path.join(directory, "index.html");
  await fs.promises.mkdir(directory);
  const real = fs.realpathSync.native;
  let removed = false;
  t.mock.method(
    fs.realpathSync,
    "native",
    (...args: Parameters<typeof real>) => {
      if (String(args[0]) === directory && !removed) {
        removed = true;
        fs.rmdirSync(directory);
      }
      return Reflect.apply(real, fs.realpathSync, args);
    },
  );
  assert.equal(projectRealPath(file), file);
  assert.ok(removed);
});

test("a disappearing internal manifest does not fail a public target check", async (t) => {
  const fixture = await pathFixture({
    "specs/page.mockup.ts": pageSource(),
    "generated/mokly-manifest.json": "{}",
    "generated/public.txt": "public",
  });
  t.after(fixture.remove);
  const config = await fixture.config(),
    manifest = path.join(config.mockupsDir, "mokly-manifest.json");
  const real = fs.realpathSync;
  let removed = false;
  t.mock.method(fs, "realpathSync", (...args: Parameters<typeof real>) => {
    if (String(args[0]) === manifest && !removed) {
      removed = true;
      fs.unlinkSync(manifest);
    }
    return Reflect.apply(real, fs, args);
  });
  fs.realpathSync.native = real.native;
  assert.equal(
    isInternalCatalogueFile(path.join(config.mockupsDir, "public.txt"), config),
    false,
  );
});

test("missing-path tolerance still rejects a dangling directory symlink", async (t) => {
  const fixture = await pathFixture({ "specs/page.mockup.ts": pageSource() });
  t.after(fixture.remove);
  await fs.promises.symlink(
    "missing",
    path.join(fixture.root, "generated/alias"),
    "dir",
  );
  assert.throws(
    () =>
      projectRealPath(path.join(fixture.root, "generated/alias/index.html")),
    { code: "ENOENT" },
  );
});
