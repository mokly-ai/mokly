import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { FileSystemGeneratedOutputStore } from "../dist/build/output_store.js";
import { loadConfig } from "../dist/config/load.js";

import { derivedFixture } from "./helpers/derived_fixture.js";

for (const tracking of ["partial", "complete"] as const) {
  test(`Check names the actual indexed generated path for a catalogue alias (${tracking})`, async (t) => {
    const fixture = await derivedFixture(t);
    const actual = path.join(fixture.root, "actual");
    await fs.rename(fixture.mockupsDir, actual);
    await fs.symlink(actual, fixture.mockupsDir, "junction");
    const config = await loadConfig(fixture.root);
    const compilation = await compileCatalogue(config);
    const store = new FileSystemGeneratedOutputStore();
    await store.write(compilation, config);
    const relative = "actual/mokly-generated";
    await fixture.git(
      "add",
      "-f",
      "--",
      tracking === "partial" ? `${relative}/home/index.mobile.html` : relative,
    );
    if (tracking === "complete")
      await fs.appendFile(
        path.join(actual, "mokly-generated/home/index.mobile.html"),
        "stale",
      );
    await assert.rejects(store.check(compilation, config), (error: Error) => {
      assert.match(
        error.message,
        /git rm -r --cached -- actual\/mokly-generated\//,
      );
      assert.match(
        error.message,
        /add \/actual\/mokly-generated\/ to \.gitignore/,
      );
      assert.doesNotMatch(
        error.message,
        /git rm -r --cached -- mockups\/mokly-generated\//,
      );
      return true;
    });
  });
}
