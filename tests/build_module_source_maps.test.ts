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

const scopedCard = /\.mokly_[a-f0-9]{12}_card\b/;

function inlineMap(map: object): string {
  const encoded = Buffer.from(JSON.stringify(map)).toString("base64");
  return `data:application/json;base64,${encoded}`;
}

for (const [name, url] of [
  ["a broken inline map", "data:application/json;base64,bm90IGpzb24="],
  [
    "an unsupported inline map encoding",
    "data:application/json;charset=latin1,{}",
  ],
  [
    "an indexed map offset above 10,000,000 lines",
    inlineMap({
      version: 3,
      sections: [
        {
          offset: { line: 10_000_001, column: 0 },
          map: { version: 3, sources: [], names: [], mappings: "" },
        },
      ],
    }),
  ],
] as const)
  test(`Build ignores ${name} in a CSS Module`, async (context) => {
    const fixture = await styleFixture(
      `.card{color:red}\n/*# sourceMappingURL=${url} */`,
      { module: true },
    );
    context.after(() => removeFixture(fixture));
    const stylesheet = (await compileFixture(fixture)).outputs.get(entryStyle);
    assert.ok(typeof stylesheet === "string");
    assert.match(stylesheet, scopedCard);
  });

test("Build does not read a CSS Module's sibling map from the working directory", async (context) => {
  const fixture = await styleFixture(
    ".card{color:red}\n/*# sourceMappingURL=fixture.map */",
    { module: true },
  );
  context.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.entriesDir, "fixture.map"),
    '{"version":2,"sources":[],"names":[],"mappings":""}',
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
  const map = inlineMap({
    version: 3,
    file: "fixture.module.css",
    sources: ["card.scss"],
    names: [],
    mappings: "AAuCA,KACE",
  });
  const fixture = await styleFixture(
    `.a { composes: b }\n.b{}\n/*# sourceMappingURL=${map} */`,
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
