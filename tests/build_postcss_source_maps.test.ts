import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import postcss, { CssSyntaxError, type Plugin } from "postcss";

import { scopeModule } from "../dist/build/styles/modules.js";
import {
  parseStylesheet,
  processStylesheet,
} from "../dist/build/styles/postcss_boundary.js";

import {
  brokenInlineSourceMaps,
  inlineSourceMap,
  remappingSourceMap,
  unsupportedSourceMap,
} from "./helpers/css_source_maps.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";
import {
  compileFixture,
  entryStyle,
} from "./helpers/imported_styles_fixture.js";

const noop: Plugin = { postcssPlugin: "noop", Once() {} };
const unclosedAtLineFive = `.a{color:red}\n\n\n\n.card{color:red\n${inlineSourceMap(remappingSourceMap)}`;

function syntaxErrorPosition(parse: () => unknown): [number, number] {
  try {
    parse();
  } catch (error) {
    if (error instanceof CssSyntaxError)
      return [error.line ?? 0, error.column ?? 0];
    throw error;
  }
  return assert.fail("expected a CSS syntax error");
}

for (const { name, comment, failure } of brokenInlineSourceMaps)
  test(`PostCSS boundary ignores an inline source map with ${name}`, () => {
    const css = `.card{color:red}\n${comment}`;
    assert.throws(() => postcss.parse(css, { from: "card.css" }), failure);
    assert.equal(parseStylesheet(css, "card.css").source?.input.map, undefined);
    const processed = processStylesheet([noop], css, "card.css");
    assert.equal(processed.css, ".card{color:red}");
    assert.equal(processed.map, undefined);
  });

test("PostCSS boundary never reads a sibling source map file", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-maps-"));
  t.after(() => fs.rm(directory, { force: true, recursive: true }));
  await fs.writeFile(
    path.join(directory, "card.css.map"),
    unsupportedSourceMap,
  );
  const from = path.join(directory, "card.css");
  const css = ".card{color:red}\n/*# sourceMappingURL=card.css.map */";
  assert.throws(() => postcss.parse(css, { from }), /Unsupported version: 2/);
  assert.equal(parseStylesheet(css, from).source?.input.map, undefined);
  const processed = processStylesheet([noop], css, from);
  assert.equal(processed.css, ".card{color:red}");
  assert.equal(processed.map, undefined);
});

test("PostCSS boundary reports syntax errors at stylesheet positions", () => {
  const from = "card.css";
  assert.deepEqual(
    syntaxErrorPosition(() => postcss.parse(unclosedAtLineFive, { from })),
    [21, 1],
  );
  assert.deepEqual(
    syntaxErrorPosition(() => parseStylesheet(unclosedAtLineFive, from)),
    [5, 1],
  );
});

for (const { name, comment } of brokenInlineSourceMaps)
  test(`CSS Modules ignore an inline source map with ${name}`, () => {
    const css = `.card{color:red}\n${comment}`;
    const scoped = scopeModule(css, "entries/card.module.css");
    assert.deepEqual(Object.keys(scoped.exports), ["card"]);
    assert.equal(scoped.css, css.replace(".card", `.${scoped.exports.card}`));
  });

test("CSS Modules report syntax errors at stylesheet positions despite a source map", () => {
  assert.throws(
    () => scopeModule(unclosedAtLineFive, "entries/card.module.css"),
    {
      message:
        "[mokly/build-invalid] could not transform CSS entries/card.module.css:5:1: Unclosed block; fix the stylesheet and rebuild",
    },
  );
});

test("Build with consumer PostCSS ignores sibling and inline source maps", async (t) => {
  const fixture = await createFixture(undefined, {
    extraConfig: 'postcss: "postcss.config.mjs",',
  });
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.root, "postcss.config.mjs"),
    'export default { plugins: [{ postcssPlugin: "noop", Once() {} }] };',
  );
  const sheets = new Map<string, string>();
  for (const [name, rule] of [
    ["sibling.css", ".sibling{color:red}"],
    ["sibling.module.css", ".local{color:blue}"],
  ] as const) {
    sheets.set(name, `${rule}\n/*# sourceMappingURL=${name}.map */`);
    await fs.writeFile(
      path.join(fixture.entriesDir, `${name}.map`),
      unsupportedSourceMap,
    );
  }
  const inlineNames = brokenInlineSourceMaps.map(
    (_, index) => `inline${index}`,
  );
  for (const [index, { comment }] of brokenInlineSourceMaps.entries())
    sheets.set(
      `${inlineNames[index]}.module.css`,
      `.${inlineNames[index]}{color:green}\n${comment}`,
    );
  for (const [name, css] of sheets) {
    await fs.writeFile(path.join(fixture.entriesDir, name), css);
    await fs.appendFile(fixture.entryPath, `\nimport "./${name}";\n`);
  }
  const compiled = await compileFixture(fixture);
  const stylesheet = compiled.outputs.get(entryStyle);
  assert.ok(typeof stylesheet === "string");
  assert.match(stylesheet, /\.sibling \{/);
  assert.doesNotMatch(stylesheet, /sourceMappingURL/);
  for (const name of ["local", ...inlineNames])
    assert.match(stylesheet, new RegExp(`\\.mokly_[a-f0-9]{12}_${name} \\{`));
  assert.deepEqual(
    compiled.manifest.sourceFiles.filter((file) => file.endsWith(".map")),
    [],
  );
});
