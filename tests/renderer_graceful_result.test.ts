import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

for (const [name, source] of [
  ["screen-only", undefined],
  ["component-aware", componentEntrySource()],
] as const) {
  for (const legacy of [false, true])
    test(`${name} accepts structured HTML and ignores returned styles=${legacy}`, async (t) => {
      const fixture = await createFixture(source, {
        extraConfig: 'renderer: "renderer.tsx",',
      });
      t.after(() => removeFixture(fixture));
      await fs.writeFile(
        path.join(fixture.root, "renderer.tsx"),
        `import { renderToStaticMarkup } from "react-dom/server";
        export default ({node}) => ({
          html: '<!doctype html><html><head><style>.unmatched{color:red}</style></head><body>' + renderToStaticMarkup(node) + '</body></html>',
          ${legacy ? 'styles: [{startOffset: -1, componentIds: ["absent"]}],' : ""}
        });`,
      );
      const compiled = await compileCatalogue(await loadConfig(fixture.root));
      const warnings = compiled.diagnostics.filter(
        (warning) => warning.code === "ignored-renderer-styles",
      );
      const routes = [...compiled.outputs.keys()].filter((route) =>
        /index\.(mobile|desktop)\.html$/.test(route),
      );
      assert.ok(routes.length > 0);
      assert.equal(warnings.length, legacy ? routes.length : 0);
      assert.equal(
        new Set(warnings.map((warning) => warning.route)).size,
        warnings.length,
      );
      for (const route of routes) {
        assert.match(
          String(compiled.outputs.get(route)),
          /\.unmatched\{color:red\}/,
        );
      }
    });
}
