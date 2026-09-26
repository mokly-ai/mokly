import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { loadConfig } from "../dist/config/load.js";
import { PlainServeReporter } from "../dist/server/reporter.js";
import { serve } from "../dist/server/serve.js";

import {
  declared,
  fixtureWithSheets,
} from "./helpers/component_stylesheet_fixture.js";
import { removeFixture } from "./helpers/fixture.js";

test(
  "a failing watched compilation reports earlier render warnings before its failure",
  { timeout: 30_000 },
  async (context) => {
    const source = `${declared()}
import { definePage } from "@mokly/mokly";
mockups.push(definePage({ id: "broken", title: "Broken", description: "Broken", route: "broken.html", relatedDocs: [], render: () => { throw new Error("broken page after warned render"); } }));`;
    const fixture = await fixtureWithSheets(
      source,
      'renderer: "renderer.tsx", stylesheets: [],',
    );
    context.after(() => removeFixture(fixture));
    await fs.writeFile(
      path.join(fixture.root, "renderer.tsx"),
      `import { renderToStaticMarkup } from "react-dom/server";
export default (input) => { const html = '<html><head></head><body>' + renderToStaticMarkup(input.node) + '</body></html>'; return input.entry.id === "home" ? { html, resources: [{ path: "action.css", componentIds: ["action"] }] } : { html }; };`,
    );
    const events: string[] = [];
    const running = await serve(
      await loadConfig(fixture.root),
      { port: 0, watch: true },
      { reporter: new PlainServeReporter((value) => events.push(value)) },
    );
    fixture.beforeRemove(() => running.close());
    for (let attempt = 0; attempt < 800; attempt += 1) {
      if (
        events.some((line) => line.includes("broken page after warned render"))
      )
        break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    const warningIndex = events.findIndex((line) =>
      line.includes("ignored; Mokly derives owners"),
    );
    const failureIndex = events.findIndex((line) =>
      line.includes("broken page after warned render"),
    );
    assert.ok(warningIndex >= 0, events.join(""));
    assert.ok(failureIndex > warningIndex, events.join(""));
  },
);
