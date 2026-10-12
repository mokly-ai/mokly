import assert from "node:assert/strict";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";
import { textOutput } from "./helpers/generated_text.js";

test("component HTML resources accept pending stylesheets before they exist on disk", async (t) => {
  const fixture = await createFixture(componentEntrySource(), {
    extraConfig: 'renderer: "renderer.tsx",',
  });
  t.after(() => removeFixture(fixture));
  const styleRoute = "mokly-generated/styles/entries/fixture.mockup.tsx.css";
  await fs.writeFile(
    path.join(fixture.entriesDir, "card.css"),
    ".card{color:red}",
  );
  await fs.appendFile(fixture.entryPath, '\nimport "./card.css";');
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    `import { renderToStaticMarkup } from "react-dom/server"; export default (input) => '<!doctype html><html><head>' + input.stylesheets.map(href => '<link rel="stylesheet" href="' + href + '">').join('') + '</head><body>' + renderToStaticMarkup(input.node) + '</body></html>';`,
  );
  const compiled = await compileCatalogue(await loadConfig(fixture.root));
  assert.ok(compiled.outputs.has(styleRoute.slice("mokly-generated/".length)));
  const html = textOutput(compiled.outputs, "home/index.mobile.html")!;
  assert.match(html, /styles\/entries\/fixture\.mockup\.tsx\.css/);
  assert.ok(!fsSync.existsSync(path.join(fixture.mockupsDir, styleRoute)));
});

test("component links reject stale reserved disk files absent from pending output", async (t) => {
  const fixture = await createFixture(componentEntrySource(), {
    extraConfig: 'renderer: "renderer.tsx",',
  });
  t.after(() => removeFixture(fixture));
  const missing = "mokly-generated/styles/stale.css";
  const stale = path.join(fixture.mockupsDir, missing);
  await fs.mkdir(path.dirname(stale), { recursive: true });
  await fs.writeFile(stale, ".stale{color:red}");
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    `import { renderToStaticMarkup } from "react-dom/server"; export default (input) => '<!doctype html><html><head><link rel="stylesheet" href="' + '../'.repeat(input.entry.path.split('/').length) + '${missing.slice("mokly-generated/".length)}"></head><body>' + renderToStaticMarkup(input.node) + '</body></html>';`,
  );
  await assert.rejects(
    compileCatalogue(await loadConfig(fixture.root)),
    (error: Error) => {
      assert.match(
        error.message,
        /missing target (?:\.\.\/)+styles\/stale\.css/,
      );
      assert.doesNotMatch(error.message, /escapes mockupsDir/);
      return true;
    },
  );
});
