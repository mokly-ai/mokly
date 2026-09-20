import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { checkCompilation } from "../dist/build/check.js";
import { compileCatalogue } from "../dist/build/compile.js";
import { generatedHeader } from "../dist/build/ownership.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("committed check separates orphan and unclaimed generated files", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  await writeCompilation(compilation, config);
  const generated = async (route: string, owner: string) => {
    const target = path.join(fixture.mockupsDir, route);
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    await fs.promises.writeFile(
      target,
      `${generatedHeader(owner)}<html></html>\n`,
    );
  };
  await generated("deleted-entry.html", "entries/deleted.mockup.tsx");
  await generated("unclaimed.html", "docs/old/page.mockup.tsx");
  await fs.promises.writeFile(
    path.join(fixture.mockupsDir, "public.html"),
    "<!doctype html><p>Consumer-authored</p>\n",
  );

  assert.throws(
    () => checkCompilation(compilation, config),
    (error: Error) => {
      assert.match(
        error.message,
        /orphan generated files:[\s\S]*deleted-entry\.html/,
      );
      assert.match(
        error.message,
        /unclaimed generated files:[\s\S]*unclaimed\.html/,
      );
      assert.match(
        error.message,
        /delete them or restore the source under a configured entry glob/i,
      );
      const unclaimed = error.message.split("unclaimed generated files:")[1];
      assert.ok(unclaimed);
      assert.doesNotMatch(unclaimed, /deleted-entry\.html|public\.html/);
      return true;
    },
  );
});
