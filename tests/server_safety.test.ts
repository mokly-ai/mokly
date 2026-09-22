import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { startCatalogueServer } from "../dist/server/http.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("Browse frames sandbox generated scripts away from the shell", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  const server = await startCatalogueServer(config, {
    base: "origin/main",
    port: 0,
  });
  fixture.beforeRemove(() => server.close());

  const html = await (
    await fetch(`${server.url}/view/screens/home.html`)
  ).text();

  assert.match(html, /<iframe[^>]+sandbox="allow-same-origin"/);
  for (const capability of [
    "allow-downloads",
    "allow-forms",
    "allow-popups",
    "allow-scripts",
    "allow-top-navigation",
    "allow-top-navigation-by-user-activation",
  ]) {
    assert.doesNotMatch(html, new RegExp(capability));
  }
});

test("static serving rejects symlinks into nested authored source roots", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const nestedEntries = path.join(fixture.mockupsDir, "src", "entries");
  await fs.promises.mkdir(nestedEntries, { recursive: true });
  const nestedEntry = path.join(nestedEntries, "fixture.mockup.tsx");
  await fs.promises.rename(fixture.entryPath, nestedEntry);
  await fs.promises.writeFile(
    fixture.configPath,
    'export default { entriesDir: "mockups/src/entries", mockupsDir: "mockups", repoRoot: "." };\n',
  );
  const exposed = path.join(fixture.mockupsDir, "exposed.tsx");
  await fs.promises.symlink("src/entries/fixture.mockup.tsx", exposed);
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  const server = await startCatalogueServer(config, {
    base: "origin/main",
    port: 0,
  });
  fixture.beforeRemove(() => server.close());

  const response = await fetch(`${server.url}/static/exposed.tsx`);

  assert.equal(response.status, 404);
});
