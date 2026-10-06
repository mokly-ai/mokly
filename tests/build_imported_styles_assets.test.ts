import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { acceptStyleOutput } from "../dist/build/styles/outputs.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { startCatalogueServer } from "../dist/server/http.js";

import { removeFixture } from "./helpers/fixture.js";
import {
  compileFixture,
  entryStyle,
  styleFixture,
} from "./helpers/imported_styles_fixture.js";

test("binary assets preserve bytes, URL suffixes and shared routes", async (t) => {
  const fixture = await styleFixture(
    '@import "./nested.css"; .hero { background: url("./photo.webp?size=1#part") }',
  );
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.entriesDir, "nested.css"),
    '@font-face { src: url("./type.woff2") }',
  );
  await fs.writeFile(
    path.join(fixture.entriesDir, "photo.webp"),
    Buffer.from([0xff, 0, 0x80]),
  );
  await fs.writeFile(
    path.join(fixture.entriesDir, "type.woff2"),
    Buffer.from([0x90, 0x10]),
  );
  const compiled = await compileFixture(fixture);
  assert.deepEqual(
    Buffer.from(
      compiled.outputs.get(
        "mokly-generated/assets/entries/photo.webp",
      ) as Uint8Array,
    ),
    Buffer.from([0xff, 0, 0x80]),
  );
  assert.deepEqual(
    Buffer.from(
      compiled.outputs.get(
        "mokly-generated/assets/entries/type.woff2",
      ) as Uint8Array,
    ),
    Buffer.from([0x90, 0x10]),
  );
  assert.match(
    compiled.outputs.get(entryStyle) as string,
    /url\("\.\.\/\.\.\/assets\/entries\/photo.webp\?size=1#part"\)/,
  );
  for (const relative of [
    "entries/fixture.css",
    "entries/nested.css",
    "entries/type.woff2",
    "entries/photo.webp",
  ])
    assert.ok(compiled.manifest.sourceFiles.includes(relative), relative);
});

test("a shared asset route with differing bytes fails with exact guidance", () => {
  const outputs = new Map<string, string | Uint8Array>();
  const route = "mokly-generated/assets/icons/a.png";
  acceptStyleOutput(outputs, route, Buffer.from([0x0a]));
  acceptStyleOutput(outputs, route, Buffer.from([0x0a]));
  assert.equal(outputs.size, 1);
  assert.throws(
    () => acceptStyleOutput(outputs, route, Buffer.from([0x0b])),
    (error: Error) => {
      assert.equal(
        error.message,
        `[mokly/build-invalid] CSS asset bytes disagree at ${route}; keep shared asset inputs stable during the build`,
      );
      return true;
    },
  );
});

test("remote imports hoist; external URL classes and fragment URLs stay unchanged", async (t) => {
  const fixture = await styleFixture(
    '.a{background:url(#icon)} @import "https://fonts.example/a.css"; .b{background:url(https://example.org/a.png);mask:url(//cdn.example/b.svg);content:url(data:image/svg+xml,abc)}',
  );
  t.after(() => removeFixture(fixture));
  const output = (await compileFixture(fixture)).outputs.get(
    entryStyle,
  ) as string;
  for (const url of [
    "#icon",
    "https://example.org/a.png",
    "//cdn.example/b.svg",
    "data:image/svg+xml,abc",
  ])
    assert.ok(output.includes(url), url);
  assert.ok(output.includes("https://fonts.example/a.css"), output);
});

test("valid remote @import is hoisted before local CSS and never inventoried", async (t) => {
  const fixture = await styleFixture(
    '@import "./local.css"; @import url("https://example.org/theme.css") layer(theme) screen; .entry{color:red}',
  );
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.entriesDir, "local.css"),
    ".local{color:blue}",
  );
  const compiled = await compileFixture(fixture);
  const output = compiled.outputs.get(entryStyle) as string;
  assert.ok(
    output.indexOf("https://example.org/theme.css") < output.indexOf(".local"),
    output,
  );
  assert.ok(
    !compiled.manifest.sourceFiles.some((file) => file.includes("example.org")),
  );
});

test("assets in scoped npm packages retain literal @ in CSS paths", async (t) => {
  const fixture = await styleFixture(
    '.a { src: url("../node_modules/@fontsource/inter/files/a.woff2") }',
  );
  t.after(() => removeFixture(fixture));
  const font = path.join(
    fixture.root,
    "node_modules/@fontsource/inter/files/a.woff2",
  );
  await fs.mkdir(path.dirname(font), { recursive: true });
  await fs.writeFile(font, Buffer.from([0, 0x91]));
  const compiled = await compileFixture(fixture);
  const route =
    "mokly-generated/assets/node_modules/@fontsource/inter/files/a.woff2";
  assert.deepEqual(
    Buffer.from(compiled.outputs.get(route) as Uint8Array),
    Buffer.from([0, 0x91]),
  );
  assert.match(
    compiled.outputs.get(entryStyle) as string,
    /node_modules\/@fontsource\/inter\/files\/a.woff2/,
  );
  assert.ok(
    !compiled.manifest.sourceFiles.includes(
      "node_modules/@fontsource/inter/files/a.woff2",
    ),
  );
  const config = await loadConfig(fixture.root);
  await writeCompilation(compiled, config);
  const server = await startCatalogueServer(config, { base: "main", port: 0 });
  fixture.beforeRemove(() => server.close());
  const response = await fetch(
    `${server.url}/static/${route.replace("@fontsource", "%40fontsource")}`,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(
    Buffer.from(await response.arrayBuffer()),
    Buffer.from([0, 0x91]),
  );
});

const invalidAssets = [
  [
    "/bad.svg",
    "root-absolute CSS url() is not portable in entries/fixture.css: /bad.svg; use a path relative to the stylesheet",
  ],
  [
    "./missing.png",
    "CSS asset is not a regular file inside repoRoot in entries/fixture.css: ./missing.png; move it inside the repository or fix the relative path",
  ],
  [
    "./bad.exe",
    "unsupported CSS asset extension in entries/fixture.css: ./bad.exe; use .avif, .bmp, .gif, .ico, .jpeg, .jpg, .png, .svg, .webp, .eot, .otf, .ttf, .woff or .woff2",
  ],
  [
    "./a space.svg",
    "CSS asset route is not portable: entries/a space.svg; rename every path segment to be URL-safe (letters, digits, dot, underscore, tilde or hyphen; @scope only after node_modules; no spaces or device names)",
  ],
] as const;

for (const [url, message] of invalidAssets)
  test(`CSS URL ${url} fails with its exact guidance`, async (t) => {
    const fixture = await styleFixture(`.a { background: url("${url}") }`);
    t.after(() => removeFixture(fixture));
    if (url.endsWith(".exe") || url.includes("space"))
      await fs.writeFile(path.join(fixture.entriesDir, url.slice(2)), "asset");
    await assert.rejects(
      () => compileFixture(fixture),
      (error: Error) => {
        assert.equal(error.message, `[mokly/build-invalid] ${message}`);
        return true;
      },
    );
  });

test("CSS assets already public under mockupsDir fail instead of hiding public files", async (t) => {
  const fixture = await styleFixture(
    '.a { background: url("../mockups/public.png") }',
  );
  t.after(() => removeFixture(fixture));
  await fs.writeFile(path.join(fixture.mockupsDir, "public.png"), "public");
  await assert.rejects(
    () => compileFixture(fixture),
    (error: Error) => {
      assert.equal(
        error.message,
        "[mokly/build-invalid] CSS asset is already public in entries/fixture.css: mockups/public.png; move the imported asset outside mockupsDir or keep it as a separately linked public file",
      );
      return true;
    },
  );
});

test("unresolvable local @import fails with exact guidance", async (t) => {
  const fixture = await styleFixture('@import "./missing.css"; .a{color:red}');
  t.after(() => removeFixture(fixture));
  await assert.rejects(
    () => compileFixture(fixture),
    (error: Error) => {
      assert.equal(
        error.message,
        "[mokly/build-invalid] could not resolve CSS @import in entries/fixture.css: ./missing.css; use an existing stylesheet inside repoRoot",
      );
      return true;
    },
  );
});

test("generated CSS routes matching public exclusion are rejected", async (t) => {
  const fixture = await styleFixture(".a{color:red}", {
    extraConfig: 'publicExclude: ["**/*.css"],',
  });
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  assert.ok(config.publicExclude.includes("**/*.css"));
  await assert.rejects(
    () => compileFixture(fixture),
    /generated route matches public exclusion \*\*\/\*\.css: mokly-generated\/styles\/entries\/fixture.mockup.tsx.css; narrow the exclusion/,
  );
});
