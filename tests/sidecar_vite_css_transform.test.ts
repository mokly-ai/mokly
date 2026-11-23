import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { ViteCssResult } from "../packages/mokly/src/generated/sidecar/ViteCssResult.js";

import { viteFixture } from "./fixtures/vite/support.js";
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
