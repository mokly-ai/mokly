import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { componentRuntime } from "../dist/build/component_runtime.js";
import { loadConfig } from "../dist/config/load.js";
import { handleControls } from "../dist/server/controls/http.js";
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
export default (input) => { const html = '<html><head></head><body>' + renderToStaticMarkup(input.node) + '</body></html>'; return input.entry.path === "action/default" ? { html, resources: [{ path: "action.css", componentIds: ["action"] }] } : { html }; };`,
  );
  const compilation = await compileCatalogue(await loadConfig(fixture.root));
  const runtime = {
    ...componentRuntime(compilation),
    warningGeneration: "a".repeat(32),
  };
  const warnings: string[] = [];
  const service = new ComponentRenderService(runtime, undefined, (event) => {
    assert.equal(event.generation, runtime.warningGeneration);
    warnings.push(event.warning.message);
  });
  fixture.beforeRemove(() => service.close());
  const server = http.createServer((request, response) => {
    void handleControls(request, response, service);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  fixture.beforeRemove(
    () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  );
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  const response = await fetch(`${origin}/__mokly/components/render`, {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      "x-mokly-render-token": service.token,
    },
    body: JSON.stringify({
      componentId: "action",
      variantPath: "action/default",
      generation: runtime.generation,
      viewport: "mobile",
      colorScheme: "light",
      pageId: "a".repeat(32),
      overrides: { label: { kind: "set", value: ["string", "Edited"] } },
    }),
  });
  assert.equal(response.status, 200);
  const body = await response.text();
  const result = JSON.parse(body) as { previewUrl: string };
  const preview = await fetch(new URL(result.previewUrl, origin));
  assert.equal(preview.status, 200);
  const html = await preview.text();
  assert.match(html, /Edited/);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0]!, /action\.css/);
  for (const bytes of [body, html]) {
    assert.doesNotMatch(
      bytes,
      /warnings|ignored-stylesheet-resource-owner|Stylesheet ownership/,
    );
    assert.ok(!bytes.includes(warnings[0]!));
  }
});
