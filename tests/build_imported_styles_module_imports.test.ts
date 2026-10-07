import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";

import { removeFixture } from "./helpers/fixture.js";
import {
  compileFixture,
  entryStyle,
  styleFixture,
} from "./helpers/imported_styles_fixture.js";

test("CSS Module imports local and remote rules without losing inventory", async (context) => {
  const fixture = await styleFixture(
    '@import "./base.css";\n' +
      '@import url("https://fonts.example.test/theme.css") layer(fonts) screen;\n' +
      '@import "./layered.css" layer(base) supports(display: grid) screen and (min-width: 1px);\n' +
      ".x { color: red; }",
    { module: true },
  );
  context.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.entriesDir, "base.css"),
    ".base { color: blue; }",
  );
  await fs.writeFile(
    path.join(fixture.entriesDir, "layered.css"),
    ".layered { color: green; }",
  );
  const config = await loadConfig(fixture.root);
  const compiled = await compileCatalogue(config);
  const stylesheet = compiled.outputs.get(entryStyle) as string;
  assert.match(stylesheet, /https:\/\/fonts\.example\.test\/theme\.css/);
  assert.match(stylesheet, /\.base\b/);
  assert.match(stylesheet, /\.layered\b/);
  assert.match(stylesheet, /@layer base/);
  assert.match(stylesheet, /@supports\s*\(display:\s*grid\)/);
  assert.match(stylesheet, /@media\s+screen\s+and\s+\(min-width:\s*1px\)/);
  assert.ok(stylesheet.indexOf(".base") < stylesheet.indexOf(".layered"));
  assert.ok(stylesheet.indexOf(".layered") < stylesheet.indexOf("color: red"));
  for (const source of [
    "entries/fixture.module.css",
    "entries/base.css",
    "entries/layered.css",
  ])
    assert.ok(compiled.manifest.sourceFiles.includes(source), source);
  assert.ok(
    !compiled.manifest.sourceFiles.some((source) =>
      source.includes("fonts.example.test"),
    ),
  );
});

test("CSS Module custom-property url() is copied and rewritten", async (context) => {
  const fixture = await styleFixture(
    '.x { --icon: url("./icon.svg"); mask-image: var(--icon) }',
    {
      module: true,
    },
  );
  context.after(() => removeFixture(fixture));
  const bytes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>');
  await fs.writeFile(path.join(fixture.entriesDir, "icon.svg"), bytes);
  const compiled = await compileFixture(fixture);
  assert.deepEqual(
    Buffer.from(compiled.outputs.get("assets/entries/icon.svg") as Uint8Array),
    bytes,
  );
  assert.match(
    compiled.outputs.get(entryStyle) as string,
    /--icon:\s*url\("\.\.\/\.\.\/assets\/entries\/icon\.svg"\)/,
  );
  assert.ok(compiled.manifest.sourceFiles.includes("entries/icon.svg"));
});
