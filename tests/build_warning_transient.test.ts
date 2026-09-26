import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { componentRuntime } from "../dist/build/component_runtime.js";
import { loadConfig } from "../dist/config/load.js";
import { ComponentRenderService } from "../dist/server/controls/service.js";

import {
  declared,
  fixtureWithSheets,
} from "./helpers/component_stylesheet_fixture.js";
import { removeFixture } from "./helpers/fixture.js";

test("temporary component renders forward ignored-owner warnings without exposing them to clients", async (context) => {
  const fixture = await fixtureWithSheets(
    declared(),
    'renderer: "renderer.tsx", stylesheets: [],',
  );
  context.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    `import { renderToStaticMarkup } from "react-dom/server";
export default (input) => { const html = '<html><head></head><body>' + renderToStaticMarkup(input.node) + '</body></html>'; return input.entry.id === "action" ? { html, resources: [{ path: "action.css", componentIds: ["action"] }] } : { html }; };`,
  );
  const compilation = await compileCatalogue(await loadConfig(fixture.root));
  const runtime = componentRuntime(compilation);
  const warnings: string[] = [];
  const service = new ComponentRenderService(runtime, (warning) =>
    warnings.push(warning.message),
  );
  fixture.beforeRemove(() => service.close());
  const result = await service.render(
    {
      componentId: "action",
      variantId: "default",
      generation: runtime.generation,
      viewport: "mobile",
      colorScheme: "light",
      pageId: "a".repeat(32),
      overrides: { label: { kind: "set", value: ["string", "Edited"] } },
    },
    new AbortController().signal,
  );
  assert.ok(warnings.some((warning) => warning.includes("action.css")));
  assert.equal(Object.hasOwn(result, "warnings"), false);
});
