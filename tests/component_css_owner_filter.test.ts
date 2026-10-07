import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import {
  parseHistoricalManifest,
  parseManifest,
} from "../dist/registry/manifest.js";
import { generatedViews } from "../packages/viewer/dist/data.js";

import {
  declared,
  fixtureWithSheets,
} from "./helpers/component_stylesheet_fixture.js";
import { removeFixture, validEntrySource } from "./helpers/fixture.js";

test("declared links retain provenance without CSS resource owners", async (t) => {
  const fixture = await fixtureWithSheets();
  t.after(() => removeFixture(fixture));
  const compilation = await compileCatalogue(await loadConfig(fixture.root));
  const views = compilation.manifest.entries.flatMap(generatedViews);
  assert.ok(views.length);
  for (const view of views) {
    assert.deepEqual(view.usage!.resources, []);
    assert.ok(view.usage!.insertedStylesheets!.length);
    assert.ok(
      view.usage!.insertedStylesheets!.every(
        (link) => link.componentPaths.length,
      ),
    );
  }
});

test("baseline and current v9 both reject CSS owners and missing roots", async (t) => {
  const fixture = await fixtureWithSheets();
  t.after(() => removeFixture(fixture));
  const { manifest } = await compileCatalogue(await loadConfig(fixture.root));
  const old = structuredClone(manifest);
  for (const entry of old.entries)
    for (const view of generatedViews(entry)) {
      if (!view.usage) continue;
      Object.assign(view.usage, {
        resources: [{ path: "old.CSS", componentIds: ["invalid owner"] }],
      });
      if (entry.path === "action/default")
        Object.assign(view.usage, { ranges: [] });
    }
  assert.throws(() => parseHistoricalManifest(old), /stylesheet|root|owner/);
  assert.throws(() => parseManifest(old), /stylesheet|root|owner/);
});

for (const registered of [true, false])
  test(`all safe CSS owners are ignored before owner validation, registered=${registered}`, async (t) => {
    const fixture = await fixtureWithSheets(
      registered ? declared() : validEntrySource(),
      'renderer: "renderer.tsx",',
    );
    t.after(() => removeFixture(fixture));
    await fs.writeFile(
      path.join(fixture.mockupsDir, "unlinked.CSS"),
      ".unused { color: red }",
    );
    await fs.symlink(
      "unlinked.CSS",
      path.join(fixture.mockupsDir, "alias.bin"),
    );
    const rendererPath = path.join(fixture.root, "renderer.tsx");
    const renderer = `import { renderToStaticMarkup } from "react-dom/server";
export default (input) => ({ html: '<html><head></head><body>' + renderToStaticMarkup(input.node) + '</body></html>', resources: [
{path: 'unlinked.CSS', componentIds: ['invalid owner']}, {path: 'unlinked.CSS', componentIds: null}, {path: 'base.css', componentIds: []}
] });`;
    await fs.writeFile(rendererPath, renderer);
    const result = await compileCatalogue(await loadConfig(fixture.root));
    const warnings = result.diagnostics!.filter(
      (warning) => warning.code === "ignored-stylesheet-resource-owner",
    );
    const home = warnings.filter(
      (warning) => warning.route === "home/index.mobile.html",
    );
    assert.equal(home.length, 2);
    assert.equal(
      home.find((warning) => warning.message.includes("unlinked.CSS"))!.message,
      'Stylesheet ownership for "unlinked.CSS" is ignored. Changes follow the elements that each changed rule matches.',
    );
    assert.ok(
      !result.diagnostics!.some(
        (warning) => String(warning.code) === "ignored-declared-resource-owner",
      ),
    );
    await fs.writeFile(
      rendererPath,
      renderer.replace(
        "resources: [",
        'resources: input.entry.path === "home" ? [{path: "alias.bin", componentIds: null}] : [',
      ),
    );
    await assert.rejects(
      compileCatalogue(await loadConfig(fixture.root)),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal((error as { code?: string }).code, "build-invalid");
        assert.equal(
          error.message,
          "[mokly/build-invalid] renderer failed for home (mobile, light): [mokly/components] home/index.mobile.html: component resource is not a public file: alias.bin (is a symlink or non-regular file)",
        );
        return true;
      },
    );
  });
