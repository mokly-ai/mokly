import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { loadConsumerGraph } from "../dist/build/load_graph.js";
import { loadConfig } from "../dist/config/load.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";
import {
  compileFixture,
  entryStyle,
  styleFixture,
} from "./helpers/imported_styles_fixture.js";

test("plain imported CSS emits and links its root stylesheet", async (t) => {
  const fixture = await styleFixture(".button { color: red; }\n");
  t.after(() => removeFixture(fixture));
  const compiled = await compileFixture(fixture);
  assert.match(compiled.outputs.get(entryStyle) as string, /\.button\s*\{/);
  assert.ok(compiled.manifest.sourceFiles.includes("entries/fixture.css"));
  assert.match(
    compiled.outputs.get("screens/home.mobile.html") as string,
    /href="\.\.\/mokly-generated\/styles\/entries\/fixture\.mockup\.tsx\.css"/,
  );
  assert.deepEqual(
    (await loadConsumerGraph(await loadConfig(fixture.root), false))
      .sourceFiles,
    compiled.manifest.sourceFiles,
  );
});

test("first-reachability order and repeated CSS imports follow CSS last-wins", async (t) => {
  const fixture = await styleFixture(
    '@import "./base.css"; .button{color:red}',
  );
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.entriesDir, "base.css"),
    ".base{color:blue}",
  );
  await fs.appendFile(fixture.entryPath, '\nimport "./base.css";');
  const output = (await compileFixture(fixture)).outputs.get(
    entryStyle,
  ) as string;
  assert.ok(output.indexOf(".button") < output.indexOf(".base"), output);
});

test("renderer closure is excluded from entry CSS even via nested imports", async (t) => {
  const fixture = await styleFixture(
    '@import "./mid.css"; .entry{color:green}',
    {
      extraConfig: 'renderer: "renderer.tsx",',
    },
  );
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    'import "./theme.css"; import { renderToStaticMarkup } from "react-dom/server"; export default ({node}) => `<!doctype html><html><head></head><body>${renderToStaticMarkup(node)}</body></html>`;',
  );
  await fs.writeFile(
    path.join(fixture.root, "theme.css"),
    '@import "./entries/token.css"; .theme{color:red}',
  );
  await fs.writeFile(
    path.join(fixture.entriesDir, "token.css"),
    ".token{color:blue}",
  );
  await fs.writeFile(
    path.join(fixture.entriesDir, "mid.css"),
    '@import "./token.css"; .mid{color:orange}',
  );
  const compiled = await compileFixture(fixture);
  const renderer = compiled.outputs.get(
    "mokly-generated/styles/renderer.tsx.css",
  ) as string;
  const entry = compiled.outputs.get(entryStyle) as string;
  assert.match(renderer, /\.token/);
  assert.match(renderer, /\.theme/);
  assert.match(entry, /\.mid/);
  assert.doesNotMatch(entry, /\.token/);
  assert.ok(compiled.manifest.sourceFiles.includes("entries/token.css"));
});

test("CSS Modules scope animations and counter styles but preserve custom properties", async (t) => {
  const fixture = await createFixture(undefined, { extraConfig: "" });
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.entriesDir, "card.module.css"),
    "@keyframes pulse{to{opacity:1}} @counter-style dot{system:cyclic;symbols:'•'} .card{animation:pulse 1s;animation-name:pulse;color:var(--token);grid-area:slot;container-name:box;list-style:dot;view-transition-name:swap}",
  );
  await fs.appendFile(
    fixture.entryPath,
    '\nimport styles, { pulse, dot, swap } from "./card.module.css"; export const moduleNames = { styles, pulse, dot, swap };',
  );
  const compiled = await compileFixture(fixture);
  const output = compiled.outputs.get(entryStyle) as string;
  const scoped = output.match(/@keyframes (mokly_[\w-]+_pulse)/)?.[1];
  assert.ok(scoped, output);
  assert.match(output, new RegExp(`animation(?:-name)?:[^;]*${scoped}`));
  assert.match(output, /var\(--token\)/);
  assert.match(output, /grid-area: slot/);
  assert.match(output, /container-name: box/);
  assert.match(output, /@counter-style mokly_[\w-]+_dot/);
  assert.match(output, /list-style: mokly_[\w-]+_dot/);
  assert.match(output, /view-transition-name: mokly_[\w-]+_swap/);
});

test("opted-out CSS and JavaScript file-loader output are rejected as specified", async (t) => {
  const fixture = await styleFixture(".absent{color:red}", {
    extraConfig: 'moduleResolution: { loaders: { ".css": "empty" } },',
  });
  t.after(() => removeFixture(fixture));
  assert.equal(
    (await compileFixture(fixture)).outputs.get(entryStyle),
    undefined,
  );
  await fs.writeFile(
    path.join(fixture.entriesDir, "picture.png"),
    Buffer.from([0, 255]),
  );
  await fs.appendFile(
    fixture.entryPath,
    '\nimport picture from "./picture.png"; console.log(picture);',
  );
  await fs.writeFile(
    fixture.configPath,
    (await fs.readFile(fixture.configPath, "utf8")).replace(
      '".css": "empty"',
      '".png": "file"',
    ),
  );
  await assert.rejects(
    () => compileFixture(fixture),
    /consumer graph emitted an undelivered file: .*; use a dataurl or binary loader for JavaScript assets instead of file/,
  );
});

test("consumer CSS loaders other than empty fail config validation verbatim", async (t) => {
  for (const extension of [".css", ".module.css"]) {
    for (const loader of ["css", "invalid-loader"]) {
      const fixture = await createFixture(undefined, {
        extraConfig: `moduleResolution: { loaders: { "${extension}": "${loader}" } },`,
      });
      t.after(() => removeFixture(fixture));
      await assert.rejects(
        () => loadConfig(fixture.root),
        (error: Error) => {
          assert.equal(
            error.message,
            `[mokly/config-invalid] moduleResolution.loaders[${extension}] is package-owned; only "empty" is allowed to opt out of imported CSS delivery`,
          );
          return true;
        },
      );
    }
  }
});

test("a renderer also configured as an entry collides at its stylesheet route", async (t) => {
  const fixture = await styleFixture(".a{color:red}", {
    extraConfig: 'renderer: "entries/fixture.mockup.tsx",',
  });
  t.after(() => removeFixture(fixture));
  await assert.rejects(
    () => compileFixture(fixture),
    (error: Error) => {
      assert.equal(
        error.message,
        `[mokly/build-invalid] generated route collision: ${entryStyle}; give each entry root a distinct repository path`,
      );
      return true;
    },
  );
});

test("a non-portable root name fails before emitting its generated stylesheet", async (t) => {
  const fixture = await styleFixture(".a{color:red}");
  t.after(() => removeFixture(fixture));
  const bad = path.join(fixture.entriesDir, "AUX.mockup.tsx");
  await fs.rename(fixture.entryPath, bad);
  await assert.rejects(
    () => compileFixture(fixture),
    (error: Error) => {
      assert.equal(
        error.message,
        "[mokly/build-invalid] generated stylesheet route is not portable: mokly-generated/styles/entries/AUX.mockup.tsx.css; rename the root module so every path segment is URL-safe",
      );
      return true;
    },
  );
});

test("invalid CSS Module transforms use the catalogued guidance", async (t) => {
  const fixture = await styleFixture("@keyframes {", { module: true });
  t.after(() => removeFixture(fixture));
  await assert.rejects(
    () => compileFixture(fixture),
    (error: Error) => {
      assert.equal(
        error.message,
        "[mokly/build-invalid] could not transform CSS entries/fixture.module.css: Unexpected end of input; fix the stylesheet and rebuild",
      );
      return true;
    },
  );
});
