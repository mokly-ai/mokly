import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";

import { documentText } from "./helpers/html.js";
import { createPreviewComparisonFixture } from "./helpers/preview_comparison_fixture.js";

test("a published renamed screen keeps one derived route without an id redirect", async (context) => {
  const fixture = await createPreviewComparisonFixture();
  context.after(() => fixture.close());
  const source = await fs.promises.readFile(fixture.entryPath, "utf8");
  await fs.promises.writeFile(
    fixture.entryPath,
    source.replace('title: "Home"', 'title: "Renamed home"'),
  );
  await writeCompilation(
    await compileCatalogue(fixture.config),
    fixture.config,
  );
  await fixture.build();
  const redirects = await fs.promises.readFile(
    path.join(fixture.output, "_redirects"),
    "utf8",
  );
  assert.doesNotMatch(redirects, /^\/id\//m);
  const current = await fs.promises.readFile(
    path.join(fixture.output, "view/screens/home.html"),
    "utf8",
  );
  assert.match(documentText(current), /Renamed home/);
  assert.doesNotMatch(documentText(current), /Showing previous version/);
});
