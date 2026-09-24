import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { FileSystemGeneratedOutputStore } from "../dist/build/output_store.js";

import { derivedFixture } from "./helpers/derived_fixture.js";

test("derived Check rejects indexed strays under reserved directory with directory ignore rule", async (t) => {
  const fixture = await derivedFixture(t);
  const route = "mockups/mokly-generated/assets/stray.woff2";
  const candidate = path.join(fixture.root, route);
  await fs.mkdir(path.dirname(candidate), { recursive: true });
  await fs.writeFile(candidate, Buffer.from([255, 0]));
  await fixture.git("add", "-f", route);
  await fs.rm(candidate);
  await assert.rejects(
    async () =>
      new FileSystemGeneratedOutputStore().check(
        fixture.baseline,
        fixture.config,
      ),
    (error: Error & { code?: string }) => {
      assert.equal(error.code, "build-invalid");
      assert.match(
        error.message,
        /mockups\/mokly-generated\/assets\/stray.woff2/,
      );
      assert.match(error.message, /\/mockups\/mokly-generated\//);
      return true;
    },
  );
});
