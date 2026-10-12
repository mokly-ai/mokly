import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { serve } from "../dist/server/serve.js";

import {
  configuredLinks,
  linkRenderer,
  linkSource,
  prepareLinkFixture,
} from "./helpers/component_link_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

for (const configured of [false, true])
  for (const mode of ["build", "serve"] as const)
    test(`${mode} places declared CSS with generated imports (configured=${configured})`, async (t) => {
      const fixture = await createFixture(
        'import "./entry.css";\n' + linkSource,
        {
          extraConfig: `renderer: "renderer.tsx", colorSchemes: ["light", "dark"], stylesheets: ${configured ? '[{match:"**",stylesheets:["base.css"]}]' : "[]"},`,
        },
      );
      t.after(() => removeFixture(fixture));
      await prepareLinkFixture(
        fixture,
        'import "./renderer.css";\n' +
          linkRenderer(`${configuredLinks} + '<meta name="head-end">'`),
      );
      await fs.writeFile(
        path.join(fixture.entriesDir, "entry.css"),
        ".action{color:blue}",
      );
      await fs.writeFile(
        path.join(fixture.root, "renderer.css"),
        ".action{color:green}",
      );
      const config = await loadConfig(fixture.root);
      const routes = ["checkout/index", "action/default/index"].flatMap(
        (route) =>
          ["mobile", "desktop"].flatMap((viewport) =>
            ["", ".dark"].map((scheme) => `${route}.${viewport}${scheme}.html`),
          ),
      );
      let documents: string[];
      if (mode === "build") {
        const built = await compileCatalogue(config);
        assert.deepEqual(built.diagnostics ?? [], []);
        documents = routes.map((route) => built.outputs.get(route) as string);
      } else {
        const running = await serve(config, { port: 0, watch: false });
        fixture.beforeRemove(() => running.close());
        documents = [];
        for (const route of routes) {
          const response = await fetch(
            `${running.url}/static/mokly-generated/${route}`,
          );
          assert.equal(response.status, 200);
          documents.push(await response.text());
        }
        await assert.rejects(
          fs.access(path.join(config.generatedDir, "mokly-manifest.json")),
        );
      }
      for (const [index, html] of documents.entries()) {
        const prefix = "../".repeat(
          path.posix.dirname(routes[index]!).split("/").length + 1,
        );
        const links = [...html.matchAll(/<link\b[^>]*href="([^"]+)"/g)].map(
          (match) => match[1],
        );
        const generated = [
          `${prefix.slice(3)}styles/renderer.tsx.css`,
          `${prefix.slice(3)}styles/entries/fixture.mockup.tsx.css`,
        ];
        assert.deepEqual(
          links,
          configured
            ? [`${prefix}base.css`, `${prefix}action.css`, ...generated]
            : [...generated, `${prefix}action.css`],
        );
        assert.ok(
          configured
            ? html.indexOf("action.css") < html.indexOf('name="head-end"')
            : html.indexOf('name="head-end"') < html.indexOf("action.css"),
        );
      }
    });
