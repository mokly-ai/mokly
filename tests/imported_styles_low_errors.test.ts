import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import {
  isValidGeneratedRoute,
  stylesheetRoute,
} from "../dist/build/styles/routes.js";
import { loadConfig } from "../dist/config/load.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";
import {
  compileFixture,
  styleFixture,
} from "./helpers/imported_styles_fixture.js";

test("dangling PostCSS and reserved output symlinks keep their catalogued diagnostics", async (context) => {
  const postcss = await createFixture(undefined, {
    extraConfig: 'postcss: "postcss.config.cjs",',
  });
  context.after(() => removeFixture(postcss));
  await fs.symlink("absent.cjs", path.join(postcss.root, "postcss.config.cjs"));
  await assert.rejects(loadConfig(postcss.root), (error: Error) => {
    assert.equal(
      error.message,
      "[mokly/config-invalid] postcss module must be an existing regular .ts, .mts, .js, .mjs or .cjs file inside repoRoot: postcss.config.cjs",
    );
    return true;
  });

  const output = await createFixture();
  context.after(() => removeFixture(output));
  await fs.symlink(
    "missing-directory",
    path.join(output.mockupsDir, "mokly-generated"),
  );
  await assert.rejects(
    async () => compileCatalogue(await loadConfig(output.root)),
    (error: Error) => {
      assert.equal(
        error.message,
        "[mokly/build-invalid] mokly-generated/ contains a symlink or non-regular entry: mockups/mokly-generated; delete it before building or checking",
      );
      return true;
    },
  );
});

test("plugin-less syntax failures retain the CSS transform message and relative file", async (context) => {
  const fixture = await styleFixture("}", {
    extraConfig: 'postcss: "postcss.config.mjs",',
  });
  context.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.root, "postcss.config.mjs"),
    'export default { plugins: [{ postcssPlugin: "noop", Once() {} }] }',
  );
  await assert.rejects(compileFixture(fixture), (error: Error) => {
    assert.match(
      error.message,
      /^\[mokly\/build-invalid\] could not transform CSS entries\/fixture\.css: /,
    );
    assert.match(error.message, /; fix the stylesheet and rebuild$/);
    assert.doesNotMatch(
      error.message,
      new RegExp(fixture.root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
    return true;
  });
});

test("a consumer CSS loader is rejected for every extension", async (context) => {
  const fixture = await createFixture(undefined, {
    extraConfig: 'moduleResolution: { loaders: { ".pcss": "css" } },',
  });
  context.after(() => removeFixture(fixture));
  await assert.rejects(
    loadConfig(fixture.root),
    /\[mokly\/config-invalid\] moduleResolution\.loaders\[\.pcss\] cannot use "css"; rename the stylesheet to \.css or use a JavaScript-safe loader/,
  );
});

test("stylesheet roots inside scoped packages use portable output routes", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const route = stylesheetRoute(
    path.join(fixture.root, "node_modules/@acme/renderer/index.tsx"),
    fixture.root,
  );
  assert.equal(
    route,
    "mokly-generated/styles/node_modules/@acme/renderer/index.tsx.css",
  );
  assert.equal(isValidGeneratedRoute(route), true);
});

test("a direct external CSS import identifies the importing entry", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const outside = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-outside-css-"),
  );
  context.after(() => fs.rm(outside, { recursive: true, force: true }));
  const external = path.join(outside, "external.css");
  await fs.writeFile(external, ".outside{color:red}");
  const specifier = path.relative(fixture.entriesDir, external);
  await fs.appendFile(
    fixture.entryPath,
    `\nimport ${JSON.stringify(specifier)};`,
  );
  await assert.rejects(
    compileCatalogue(await loadConfig(fixture.root)),
    new RegExp(
      `CSS import is outside repoRoot in entries/fixture.mockup.tsx: ${specifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}; move the stylesheet inside repoRoot or remove the import`,
    ),
  );
});

test("a late @import names its author and the first source-order URL error wins", async (context) => {
  const fixture = await styleFixture(
    '.early{color:red}\n@import "./late.css";',
  );
  context.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.entriesDir, "late.css"),
    ".late{color:blue}",
  );
  await assert.rejects(
    compileFixture(fixture),
    /CSS @import must come before style rules in entries\/fixture\.css: \.\/late\.css; move the import before other rules/,
  );
  await fs.writeFile(
    path.join(fixture.entriesDir, "fixture.css"),
    '.a{background:url("./first.png");mask:url("./second.png")}',
  );
  await assert.rejects(compileFixture(fixture), (error: Error) => {
    assert.match(
      error.message,
      /CSS asset is not a regular file inside repoRoot in entries\/fixture\.css: \.\/first\.png;/,
    );
    return true;
  });
});

test("image-set string URLs fail before an unresolved asset can reach a browser", async (context) => {
  const fixture = await styleFixture(
    '.a{background:image-set("./missing.png" 1x)}',
  );
  context.after(() => removeFixture(fixture));
  await assert.rejects(
    compileFixture(fixture),
    /image-set\(\) string URL is unsupported in entries\/fixture\.css: \.\/missing\.png; wrap the URL in url\(\) so Mokly can validate and deliver the asset/,
  );
});
