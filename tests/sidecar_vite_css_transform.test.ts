import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { ViteCssResult } from "../packages/mokly/src/generated/sidecar/ViteCssResult.js";

import { viteFixture } from "./fixtures/vite/support.js";
import { reviewFixture } from "./fixtures/vite_review.js";
import { startSidecar } from "./helpers/sidecar.js";
import { write } from "./helpers/static_changes.js";

test("Vite's default CSS Module map uses the core's scoped names", async (context) => {
  const fixture = await viteFixture(context);
  const stylesheet = "src/card.module.css";
  await write(fixture.root, stylesheet, ".card { color: teal }");
  const sidecar = startSidecar(context, fixture.root);
  await sidecar.call("hello");
  const result = await sidecar.call<ViteCssResult>("transformViteCss", {
    setup: { ...fixture.params, entryFiles: [], renderer: null },
    stylesheet,
    file: path.join(fixture.root, stylesheet),
  });
  assert.ok(result, "Vite must return the inline stylesheet and class map");
  const hash = createHash("sha256")
    .update(stylesheet)
    .digest("hex")
    .slice(0, 12);
  const scoped = `mokly_${hash}_card`;
  assert.deepEqual(result.classMap, { card: scoped });
  assert.match(result.text, new RegExp(`^\\.${scoped}\\s*\\{`));
  await sidecar.call("shutdown");
});

test("Vite keeps inline CSS when an ordered load reports a directory and an absent file", async (context) => {
  const fixture = await reviewFixture(context);
  const stylesheet = "styles/site.css";
  await fixture.write(stylesheet, ".site { color: teal }");
  await fixture.write("styles/tokens/palette.txt", "teal");
  await fixture.write(
    "vite.config.ts",
    `import { resolve } from "node:path";
     export default { plugins: [{ name: "watch-directory", load: { order: "pre", handler(id) {
       if (!id.endsWith("/styles/site.css?inline")) return;
       this.addWatchFile(resolve(import.meta.dirname, "styles/tokens"));
       this.addWatchFile(resolve(import.meta.dirname, "styles/optional.txt"));
     } } }] };`,
  );
  const transform = () =>
    fixture.sidecar.call<ViteCssResult>("transformViteCss", {
      setup: { ...fixture.params, entryFiles: [] },
      stylesheet,
      file: path.join(fixture.root, stylesheet),
    });
  const result = await transform();
  assert.match(result.text, /\.site\s*\{[^}]*color:\s*teal/);
  assert.deepEqual(result.dependencies, { "styles/optional.txt": null });
  assert.equal(fixture.sidecar.diagnostics.length, 1);
  assert.match(
    fixture.sidecar.diagnostics[0]!,
    /plugin input styles\/tokens .*Serve does not watch.*watch\.rules.*rebuild/,
  );
  await fs.mkdir(path.join(fixture.root, "styles/optional.txt"));
  assert.deepEqual((await transform()).dependencies, {});
  assert.match(
    fixture.sidecar.diagnostics.at(-1)!,
    /plugin input styles\/optional\.txt /,
  );
  await fixture.sidecar.call("shutdown");
});

test("Vite delivers file changes to an installed stylesheet plugin before reloading its server", async (context) => {
  const fixture = await reviewFixture(context);
  const stylesheet = "styles/site.css";
  const token = "data/color.txt";
  const nested = "data/nested.txt";
  const entry = "src/review.mockup.ts";
  const log = ".context/events";
  const plugin = "installed/node_modules/fixture-css-cache";
  fixture.params.moduleResolution.packageRoots.unshift(
    path.join(fixture.root, "installed"),
  );
  await fixture.write(`${plugin}/package.json`, '{"exports":"./index.mjs"}');
  await fixture.write(
    `${plugin}/index.mjs`,
    `import { appendFileSync, readFileSync } from "node:fs";
     import { resolve } from "node:path";
     let color;
     let instances = 0;
     const files = ${JSON.stringify([entry, stylesheet, token, nested])};
     export default function cachedCss(root) {
       const instance = ++instances;
       const tokenFile = resolve(root, ${JSON.stringify(token)});
       const helper = resolve(root, "data/watch-helper.js");
       return { name: "cache-tokens", enforce: "pre",
         load(id) {
           if (id.endsWith("/data/watch-helper.js"))
             this.addWatchFile(resolve(root, ${JSON.stringify(nested)}));
         },
         async transform(code, id) {
           if (!id.endsWith("/styles/site.css?inline")) return;
           this.addWatchFile(tokenFile);
           await this.load({ id: helper });
           return code.replace("__COLOR__", color ??= readFileSync(tokenFile, "utf8"));
         },
         watchChange(id, { event }) {
           const file = files.find(file => id.endsWith("/" + file));
           if (!file) return;
           if (file === ${JSON.stringify(token)}) color = undefined;
           appendFileSync(resolve(root, ${JSON.stringify(log)}),
             instance + ":" + event + ":" + file + "\\n");
         },
       };
     }`,
  );
  await fixture.write(
    "vite.config.ts",
    `import cachedCss from "fixture-css-cache";
     export default { plugins: [cachedCss(import.meta.dirname)] };`,
  );
  await fixture.write(log, "");
  await fixture.write(entry, 'export const label = "before";');
  await fixture.write(stylesheet, ".site { color: __COLOR__ }");
  await fixture.write(token, "teal");
  await fixture.write("data/watch-helper.js", "export {};");
  await fixture.write(nested, "before");
  await fixture.compile();
  const transform = () =>
    fixture.sidecar.call<ViteCssResult>("transformViteCss", {
      setup: { ...fixture.params, entryFiles: [] },
      stylesheet,
      file: path.join(fixture.root, stylesheet),
    });
  assert.match((await transform()).text, /color:\s*teal/);

  await fixture.write(entry, 'export const label = "after";');
  await fixture.write(stylesheet, ".site { color: __COLOR__; display: block }");
  await fixture.write(token, "maroon");
  await fixture.write(nested, "after");
  assert.match((await transform()).text, /color:\s*maroon/);
  const events = await fs.readFile(path.join(fixture.root, log), "utf8");
  assert.deepEqual(events.trim().split("\n").sort(), [
    "1:update:data/color.txt",
    "1:update:data/nested.txt",
    "1:update:src/review.mockup.ts",
    "1:update:styles/site.css",
  ]);
  await fixture.sidecar.call("shutdown");
});

test("Vite resolves a base stylesheet import through the selected package roots", async (context) => {
  const fixture = await viteFixture(context);
  const base = path.join(fixture.parent, "base");
  const selected = path.join(fixture.parent, "installation");
  const stylesheet = "src/theme.css";
  await write(base, stylesheet, '@import "design-colors";');
  await write(
    selected,
    "node_modules/design-colors/package.json",
    JSON.stringify({
      name: "design-colors",
      exports: { ".": { style: "./color.css" } },
    }),
  );
  await write(
    selected,
    "node_modules/design-colors/color.css",
    ".brand { color: teal }",
  );
  assert.deepEqual(await fs.readdir(base), ["src"]);
  const setup = {
    ...fixture.params,
    sourceRoot: base,
    entryFiles: [],
    renderer: null,
    repositoryRoots: [base, fixture.root],
    moduleResolution: {
      ...fixture.params.moduleResolution,
      dependencyRoot: fixture.root,
      packageRoots: [fixture.root, selected],
    },
  };
  const sidecar = startSidecar(context, base);
  await sidecar.call("hello");
  const result = await sidecar.call<ViteCssResult>("transformViteCss", {
    setup,
    stylesheet,
    file: path.join(base, stylesheet),
  });
  assert.ok(result, "Vite must return the stylesheet from the base side");
  assert.match(result.text, /\.brand\s*\{\s*color:\s*teal/);
  assert.ok(
    Object.keys(result.dependencies).some((file) =>
      file.endsWith("/design-colors/color.css"),
    ),
  );
  await sidecar.call("shutdown");
});

test("Vite reports a late local import dropped by its default transformer", async (context) => {
  const fixture = await viteFixture(context);
  const stylesheet = "src/card.css";
  await write(fixture.root, stylesheet, '.card {}\n@import "./late.css";');
  await write(fixture.root, "src/late.css", ".late { color: teal }");
  const sidecar = startSidecar(context, fixture.root);
  await sidecar.call("hello");
  await assert.rejects(
    sidecar.call("transformViteCss", {
      setup: { ...fixture.params, entryFiles: [], renderer: null },
      stylesheet,
      file: path.join(fixture.root, stylesheet),
    }),
    {
      message:
        /Vite plugin vite:css failed for src\/card\.css: @import statements must precede all other statements.*; fix the Vite setup or the stylesheet/,
    },
  );
  await sidecar.call("shutdown");
});

test("Vite reports the authored position of a Sass syntax error in a partial", async (context) => {
  const fixture = await viteFixture(context);
  const stylesheet = "src/site.scss";
  await write(fixture.root, stylesheet, '@use "./colors";');
  await write(fixture.root, "src/_colors.scss", "\n$ink: ;");
  const sidecar = startSidecar(context, fixture.root);
  await sidecar.call("hello");
  await assert.rejects(
    sidecar.call("transformViteCss", {
      setup: { ...fixture.params, entryFiles: [], renderer: null },
      stylesheet,
      file: path.join(fixture.root, stylesheet),
    }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(
        error.message,
        /^Vite plugin vite:css failed for src\/_colors\.scss:2:7: \[sass\] Expected expression\.[\s\S]*; fix the Vite setup or the stylesheet$/,
      );
      assert.ok(!error.message.includes(fixture.parent), error.message);
      assert.doesNotMatch(error.message, /file:\/\/|virtual:|\/@id\/|\0/);
      return true;
    },
  );
  await sidecar.call("shutdown");
});
