import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { runtimeGraph } from "../dist/build/component_runtime.js";
import { DocumentCompiler } from "../dist/build/document_compiler.js";
import { prepareLiveRuntime } from "../dist/build/live_runtime.js";
import { loadConfig } from "../dist/config/load.js";

import {
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";
import { registerWarningPage } from "./helpers/link_control_warning_fixture.js";

test("demand retains only the requested document's link-control diagnostics", async (t) => {
  const fixture = await createFixture(
    validEntrySource({
      body: '<a href="mock:warning-page#target">Warning page</a>',
    }),
  );
  t.after(() => removeFixture(fixture));
  const source = await registerWarningPage(fixture);
  await fs.writeFile(
    source,
    (await fs.readFile(source, "utf8")).replace(
      "<button><MockLink",
      '<button id="target"><MockLink',
    ),
  );
  const runtime = await prepareLiveRuntime(await loadConfig(fixture.root));
  const compiler = new DocumentCompiler(runtime, runtimeGraph(runtime));
  const document = compiler.render("home/index.mobile.html");
  assert.ok(
    document.watchDocuments?.some(
      ([route]) => route === "warning-page/index.html",
    ),
  );
  assert.deepEqual(document.diagnostics, []);
  assert.deepEqual(compiler.render("warning-page/index.html").diagnostics, [
    {
      code: "link-control-ancestor",
      route: "warning-page/index.html",
      message:
        "MockLink child control is inside <button>; one click or key press has two targets",
    },
  ]);
});

test("demand keeps ignored-input warnings from referenced document validation", async (t) => {
  const fixture = await createFixture(
    validEntrySource({
      body: '<a href="mock:details#details">Details</a>',
    }),
    { extraConfig: 'renderer: "renderer.tsx", colorSchemes: ["light"],' },
  );
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    fixture.entryPath,
    (await fs.readFile(fixture.entryPath, "utf8")).replace(
      'id="details-mobile"',
      'id="details"',
    ),
  );
  await fs.writeFile(`${fixture.mockupsDir}/extra.css`, "main { color: red; }");
  await fs.writeFile(
    `${fixture.root}/renderer.tsx`,
    `import { renderToStaticMarkup } from "react-dom/server";
export default (input) => ({ html: '<html><head></head><body>' + renderToStaticMarkup(input.node) + '</body></html>', ...(input.entry.path === "details" ? {resources:[{path:"extra.css",componentIds:[]}]} : {}) });`,
  );
  const runtime = await prepareLiveRuntime(await loadConfig(fixture.root));
  const document = new DocumentCompiler(runtime, runtimeGraph(runtime)).render(
    "home/index.mobile.html",
  );
  assert.deepEqual(
    document.diagnostics,
    ["desktop", "mobile"].map((viewport) => ({
      code: "ignored-stylesheet-resource-owner",
      route: `details/index.${viewport}.html`,
      message:
        'Stylesheet ownership for "extra.css" is ignored. Changes follow the elements that each changed rule matches.',
    })),
  );
});
