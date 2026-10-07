import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { isCancellation } from "../dist/errors.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("an I/O failure during an acquired write remains a failure after cancellation", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  await writeCompilation(compilation, config);
  const file = path.join(config.generatedDir, "mokly-manifest.json");
  const before = await fs.readFile(file);
  const controller = new AbortController();
  const original = fs.writeFile;
  context.mock.method(
    fs,
    "writeFile",
    async (...args: Parameters<typeof original>) => {
      if (String(args[0]).includes(`${path.sep}stage${path.sep}`)) {
        controller.abort();
        throw new Error("Injected generated-output write failure");
      }
      return original.apply(fs, args);
    },
  );
  await assert.rejects(
    writeCompilation(compilation, config, controller.signal),
    (error: unknown) => {
      assert.equal((error as { code?: string }).code, "build-invalid");
      assert.match(String(error), /Injected generated-output write failure/);
      assert.equal(isCancellation(error), false);
      return true;
    },
  );
  assert.deepEqual(await fs.readFile(file), before);
});
