import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { isInside } from "../dist/config/paths.js";
import { buildPreview } from "../scripts/preview/catalogue.mjs";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("publication hashes outside links without reading or traversing their targets", async (context) => {
  const fixture = await createFixture();
  const outside = await createFixture();
  context.after(() => removeFixture(fixture));
  context.after(() => removeFixture(outside));
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  const alias = path.join(fixture.root, "outside.txt");
  const directory = path.join(fixture.mockupsDir, "outside");
  await fs.promises.symlink(path.join(outside.root, "notes.md"), alias);
  await fs.promises.symlink(outside.root, directory);
  const exists = fs.existsSync;
  context.mock.method(fs, "existsSync", (file: fs.PathLike) => {
    assert.equal(
      isInside(directory, String(file)),
      false,
      "outside directory must not be probed for artifact markers",
    );
    return exists(file);
  });
  const original = fs.promises.readFile;
  context.mock.method(
    fs.promises,
    "readFile",
    async (...args: Parameters<typeof original>) => {
      const file = String(args[0]);
      assert.equal(
        file === alias ||
          isInside(outside.root, file) ||
          isInside(directory, file),
        false,
        "outside target must not be read",
      );
      return original.apply(fs.promises, args);
    },
  );
  const output = path.join(fixture.root, ".context/published");
  await buildPreview(config, output);
  assert.equal(fs.existsSync(path.join(output, "index.html")), true);
  assert.equal(fs.existsSync(path.join(output, "static/outside")), false);
});

test("unrelated dangling and cyclic links do not prevent publication", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  await fs.promises.symlink(
    "missing.txt",
    path.join(fixture.root, "dangling.txt"),
  );
  await fs.promises.symlink("cycle", path.join(fixture.root, "cycle"));
  await buildPreview(config, path.join(fixture.root, ".context/published"));
});

test("publication rejects an escaping generated manifest route before reading its bytes", async (context) => {
  const fixture = await createFixture();
  const outside = await createFixture();
  context.after(() => removeFixture(fixture));
  context.after(() => removeFixture(outside));
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  const manifest = path.join(config.generatedDir, "mokly-manifest.json");
  const target = path.join(outside.root, "metadata.json");
  await fs.promises.copyFile(manifest, target);
  await fs.promises.unlink(manifest);
  await fs.promises.symlink(target, manifest);
  const original = fs.promises.readFile;
  let reads = 0;
  context.mock.method(
    fs.promises,
    "readFile",
    async (...args: Parameters<typeof original>) => {
      if (String(args[0]) === target || String(args[0]) === manifest) reads++;
      return original.apply(fs.promises, args);
    },
  );
  await assert.rejects(
    buildPreview(config, path.join(fixture.root, ".context/published")),
    /inside|confined|publication input|generated route escapes/,
  );
  assert.equal(reads, 0);
});

test("retargeting an unread outside link invalidates the publication fingerprint", async (context) => {
  const fixture = await createFixture();
  const outside = await createFixture();
  context.after(() => removeFixture(fixture));
  context.after(() => removeFixture(outside));
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  const alias = path.join(fixture.root, "outside.txt");
  await fs.promises.symlink(path.join(outside.root, "notes.md"), alias);
  const output = path.join(fixture.root, ".context/published");
  await buildPreview(config, output);
  const before = await fs.promises.readFile(path.join(output, "index.html"));
  const original = globalThis.fetch;
  let retargeted = false;
  context.mock.method(
    globalThis,
    "fetch",
    async (...args: Parameters<typeof original>) => {
      const response = await original(...args);
      if (!retargeted && String(args[0]).includes("/view/")) {
        retargeted = true;
        await fs.promises.unlink(alias);
        await fs.promises.symlink(
          path.join(outside.root, "another.txt"),
          alias,
        );
      }
      return response;
    },
  );
  await assert.rejects(
    buildPreview(config, output),
    /inputs changed during publication/,
  );
  assert.equal(retargeted, true);
  assert.deepEqual(
    await fs.promises.readFile(path.join(output, "index.html")),
    before,
  );
});
