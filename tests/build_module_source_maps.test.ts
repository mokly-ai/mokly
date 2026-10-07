import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { removeFixture, repositoryRoot } from "./helpers/fixture.js";
import {
  compileFixture,
  entryStyle,
  styleFixture,
} from "./helpers/imported_styles_fixture.js";
import {
  brokenInlineMap,
  inlineSourceMap,
  oversizedIndexedMap,
  unsupportedEncodingMap,
  unsupportedSiblingMap,
  withSourceMap,
} from "./helpers/source_map_comments.js";

const scopedCard = /\.mokly_[a-f0-9]{12}_card\b/;

for (const [name, url] of [
  ["a broken inline map", brokenInlineMap],
  ["an unsupported inline map encoding", unsupportedEncodingMap],
  ["an indexed map offset above 10,000,000 lines", oversizedIndexedMap],
] as const)
  test(`Build ignores ${name} in a CSS Module`, async (context) => {
    const fixture = await styleFixture(withSourceMap(".card{color:red}", url), {
      module: true,
    });
    context.after(() => removeFixture(fixture));
    const stylesheet = (await compileFixture(fixture)).outputs.get(entryStyle);
    assert.ok(typeof stylesheet === "string");
    assert.match(stylesheet, scopedCard);
  });

test("Build does not read a CSS Module's sibling map from the working directory", async (context) => {
  const fixture = await styleFixture(
    withSourceMap(".card{color:red}", "fixture.map"),
    { module: true },
  );
  context.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.entriesDir, "fixture.map"),
    unsupportedSiblingMap,
  );
  const module = (file: string) =>
    JSON.stringify(pathToFileURL(path.join(repositoryRoot, "dist", file)).href);
  const child = `import { loadConfig } from ${module("config/load.js")}; import { compileCatalogue } from ${module("build/compile.js")}; const result = await compileCatalogue(await loadConfig(process.argv[1])); process.stdout.write(result.outputs.get(${JSON.stringify(entryStyle)}));`;
  const stylesheet = execFileSync(
    process.execPath,
    ["--input-type=module", "--eval", child, fixture.root],
    { cwd: fixture.root, encoding: "utf8" },
  );
  assert.match(stylesheet, scopedCard);
});

test("CSS Module diagnostics keep module positions despite a valid inline map", async (context) => {
  const map = inlineSourceMap({
    version: 3,
    file: "fixture.module.css",
    sources: ["card.scss"],
    names: [],
    mappings: "AAuCA,KACE",
  });
  const fixture = await styleFixture(
    withSourceMap(".a { composes: b }\n.b{}", map),
    { module: true },
  );
  context.after(() => removeFixture(fixture));
  await assert.rejects(
    () => compileFixture(fixture),
    (error: Error) => {
      assert.equal(
        error.message,
        "[mokly/build-invalid] CSS Modules composition refers to a class not yet defined in entries/fixture.module.css:1:6: b; define the composed class before this rule",
      );
      return true;
    },
  );
});
