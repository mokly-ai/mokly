import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../packages/mokly/dist/build/compile.js";
import { writeCompilation } from "../packages/mokly/dist/build/transaction.js";

import { pathFixture, pageSource } from "./helpers/path_fixture.js";

for (const declared of [false, true])
  test(`moving an exporting module and its helper preserves ownership: declared path ${declared}`, async (t) => {
    const fixture = await pathFixture({
      "specs/account/page.ts": pageSource(declared ? 'path:"account",' : ""),
      "specs/account/index.mockup.ts": "export {default} from './page';",
    });
    t.after(fixture.remove);
    const before = await fixture.config();
    await writeCompilation(await compileCatalogue(before), before);
    await fs.rename(
      path.join(fixture.root, "specs/account"),
      path.join(fixture.root, "specs/billing"),
    );
    const after = await fixture.config();
    await writeCompilation(await compileCatalogue(after), after);
    const entryPath = declared ? "account" : "billing";
    assert.match(
      await fs.readFile(
        path.join(fixture.root, `generated/${entryPath}/index.html`),
        "utf8",
      ),
      /Page/,
    );
    if (!declared)
      await assert.rejects(
        fs.stat(path.join(fixture.root, "generated/account/index.html")),
        { code: "ENOENT" },
      );
  });

test("prior manifest proof is exact, config-scoped and invalidated when metadata changes", async (t) => {
  const fixture = await pathFixture({
    "specs/account/page.ts": pageSource(),
    "specs/account/index.mockup.ts": "export {default} from './page';",
  });
  t.after(fixture.remove);
  const before = await fixture.config();
  await writeCompilation(await compileCatalogue(before), before);
  const manifestPath = path.join(fixture.root, "generated/mokly-manifest.json");
  const original = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  await fs.rename(
    path.join(fixture.root, "specs/account"),
    path.join(fixture.root, "specs/billing"),
  );
  const after = await fixture.config();
  const { isOwned, generatedHeader } =
    await import("../packages/mokly/dist/build/ownership.js");
  const owned = path.join(fixture.root, "generated/account/index.html");
  assert.equal(isOwned(owned, after), true);
  await fixture.write(
    "generated/unrelated/index.html",
    generatedHeader("specs/account/page.ts") + "<html>Unrelated</html>",
  );
  assert.equal(
    isOwned(path.join(fixture.root, "generated/unrelated/index.html"), after),
    false,
  );
  assert.equal(
    isOwned(owned, {
      ...after,
      configPath: path.join(fixture.root, "other.config.ts"),
    }),
    false,
  );
  for (const value of [
    { ...original, schemaVersion: 7 },
    { ...original, unexpected: true },
    {
      ...original,
      sourceFiles: original.sourceFiles.filter(
        (file: string) => file !== "mokly.config.ts",
      ),
    },
  ]) {
    await fs.writeFile(manifestPath, JSON.stringify(value));
    assert.equal(isOwned(owned, after), false);
  }
  await fs.writeFile(manifestPath, JSON.stringify(original));
  assert.equal(isOwned(owned, after), true);
});
