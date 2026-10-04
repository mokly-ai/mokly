import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";

import {
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";
import { textOutput } from "./helpers/generated_text.js";

const source = validEntrySource({
  body: '<MockLink asChild to="details"><button id="continue">Continue</button></MockLink><MockLink to="details" id="ordinary">Plain</MockLink>',
}).replace(
  'import React from "react";',
  'import React from "react"; import { MockLink } from "@mokly/mokly";',
);

test("custom renderer casing cannot bypass child adaptation", async (context) => {
  const fixture = await createFixture(source, {
    extraConfig: 'renderer: "renderer.tsx",',
  });
  context.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    `import { renderToStaticMarkup } from "react-dom/server";
export default input => '<html><body>' + renderToStaticMarkup(input.node).replaceAll('data-mokly-link-child-', 'DATA-MOKLY-LINK-CHILD-') + '</body></html>';`,
  );
  const compilation = await compileCatalogue(await loadConfig(fixture.root));
  const html =
    textOutput(compilation.outputs, "screens/home.mobile.html") ?? "";
  assert.match(html, /<a id="continue"/);
  assert.match(html, /data-mokly-link-control="button"/);
  assert.doesNotMatch(html, /data-mokly-link-child-/i);
});
