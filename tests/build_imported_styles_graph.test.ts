import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { checkCompilation } from "../dist/build/check.js";
import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";

import { removeFixture } from "./helpers/fixture.js";
import {
  compileFixture,
  entryStyle,
  styleFixture,
} from "./helpers/imported_styles_fixture.js";

test("two entries share a stylesheet without deduplicating across roots", async (t) => {
  const fixture = await styleFixture(".shared{color:red}");
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.entriesDir, "other.mockup.ts"),
    'import "./fixture.css"; export const mockups = [];',
  );
  const compiled = await compileFixture(fixture);
  const other = "mokly-generated/styles/entries/other.mockup.ts.css";
  assert.equal(
    compiled.outputs.get(entryStyle),
    compiled.outputs.get(other.slice("mokly-generated/".length)),
  );
  assert.equal(
    compiled.manifest.sourceFiles.filter(
      (file) => file === "entries/fixture.css",
    ).length,
    1,
  );
});

test("different entries emit independent stylesheets in one compilation", async (t) => {
  const fixture = await styleFixture(".first{color:red}");
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.entriesDir, "second.css"),
    ".second{color:blue}",
  );
  await fs.writeFile(
    path.join(fixture.entriesDir, "second.mockup.ts"),
    'import "./second.css"; export const mockups = [];',
  );
  const compiled = await compileFixture(fixture);
  const first = compiled.outputs.get(entryStyle) as string;
  const second = compiled.outputs.get(
    "styles/entries/second.mockup.ts.css",
  ) as string;
  assert.match(first, /\.first/);
  assert.doesNotMatch(first, /\.second/);
  assert.match(second, /\.second/);
  assert.doesNotMatch(second, /\.first/);
});

test("a shared asset is emitted once even when two root stylesheets use it", async (t) => {
  const fixture = await styleFixture('.shared{background:url("./image.png")}');
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.entriesDir, "image.png"),
    Buffer.from([0xff]),
  );
  await fs.writeFile(
    path.join(fixture.entriesDir, "other.mockup.ts"),
    'import "./fixture.css"; export const mockups = [];',
  );
  const compiled = await compileFixture(fixture);
  assert.deepEqual(
    [...compiled.outputs.keys()].filter((route) => route.endsWith("image.png")),
    ["assets/entries/image.png"],
  );
});

test("JavaScript re-exports and dynamic imports join first-reachability DFS", async (t) => {
  const fixture = await styleFixture(".first{color:red}");
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.entriesDir, "second.css"),
    ".second{color:blue}",
  );
  await fs.writeFile(
    path.join(fixture.entriesDir, "third.css"),
    ".third{color:green}",
  );
  await fs.writeFile(
    path.join(fixture.entriesDir, "helper.ts"),
    'import "./second.css"; export const value = 1;',
  );
  await fs.writeFile(
    path.join(fixture.entriesDir, "dynamic.ts"),
    'import "./third.css"; export const dynamic = 1;',
  );
  await fs.appendFile(
    fixture.entryPath,
    '\nexport { value } from "./helper"; void import("./dynamic");',
  );
  const output = (await compileFixture(fixture)).outputs.get(
    entryStyle,
  ) as string;
  assert.ok(output.indexOf(".first") < output.indexOf(".second"), output);
  assert.ok(output.indexOf(".second") < output.indexOf(".third"), output);
});

test("stylesheet output and inventory repeat byte-identically", async (t) => {
  const fixture = await styleFixture(".a { color: red }");
  t.after(() => removeFixture(fixture));
  const first = await compileFixture(fixture);
  const second = await compileFixture(fixture);
  assert.equal(first.outputs.get(entryStyle), second.outputs.get(entryStyle));
  assert.deepEqual(first.manifest.sourceFiles, second.manifest.sourceFiles);
  const child =
    'import { loadConfig } from "./dist/config/load.js"; import { compileCatalogue } from "./dist/build/compile.js"; const result = await compileCatalogue(await loadConfig(process.argv[1])); process.stdout.write(result.outputs.get("styles/entries/fixture.mockup.tsx.css"));';
  const run = () =>
    execFileSync(
      process.execPath,
      ["--input-type=module", "--eval", child, fixture.root],
      { cwd: process.cwd(), encoding: "utf8" },
    );
  assert.equal(run(), first.outputs.get(entryStyle));
  assert.equal(run(), first.outputs.get(entryStyle));
});

test("Build writes CSS and binary assets and committed Check compares their exact bytes", async (t) => {
  const fixture = await styleFixture('.a{background:url("./image.png")}');
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.entriesDir, "image.png"),
    Buffer.from([0xff, 0, 0x80]),
  );
  const config = await loadConfig(fixture.root);
  const compiled = await compileCatalogue(config);
  await writeCompilation(compiled, config);
  assert.doesNotThrow(() => checkCompilation(compiled, config));
  await fs.writeFile(
    path.join(fixture.mockupsDir, "mokly-generated/assets/entries/image.png"),
    Buffer.from([0xef, 0xbf, 0xbd]),
  );
  assert.throws(
    () => checkCompilation(compiled, config),
    /stale generated files:[\s\S]*mokly-generated\/assets\/entries\/image.png/,
  );
});

test("module CSS empty opt-out takes precedence over default local-css loader", async (t) => {
  const fixture = await styleFixture(".card{color:red}", {
    module: true,
    extraConfig: 'moduleResolution: { loaders: { ".css": "empty" } },',
  });
  t.after(() => removeFixture(fixture));
  const compiled = await compileFixture(fixture);
  assert.equal(compiled.outputs.get(entryStyle), undefined);
  assert.ok(
    compiled.manifest.sourceFiles.includes("entries/fixture.module.css"),
  );
});
