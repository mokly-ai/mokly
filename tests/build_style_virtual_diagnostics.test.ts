import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("CSS-pass diagnostics never expose synthetic stylesheet module names", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.entriesDir, "theme.txt"),
    ".x{color:red}",
  );
  await fs.symlink("theme.txt", path.join(fixture.entriesDir, "theme.css"));
  await fs.appendFile(fixture.entryPath, '\nimport "./theme.css";');
  await assert.rejects(
    compileCatalogue(await loadConfig(fixture.root)),
    (error: Error) => {
      assert.match(error.message, /entries\/fixture\.mockup\.tsx/);
      assert.doesNotMatch(error.message, /mokly:styles:/);
      assert.doesNotMatch(error.message, /\.\.\/\.\.\//);
      return true;
    },
  );
});
