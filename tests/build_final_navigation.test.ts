import assert from "node:assert/strict";
import fs from "node:fs";
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

test("metadata-only native links retain their role after rendering", async (context) => {
  const fixture = await createFixture(
    validEntrySource({
      body: '<a data-nav-href="mock:details">Details metadata</a>',
    }),
  );
  context.after(() => removeFixture(fixture));

  const compilation = await compileCatalogue(await loadConfig(fixture.root));
  const mobile =
    textOutput(compilation.outputs, "screens/home.mobile.html") ?? "";

  assert.match(mobile, /<a data-nav-href="\.\/details\.mobile\.html">/);
  assert.doesNotMatch(mobile, /data-mokly-link/);
});

test("final rendering validates anchors across all target views", async (context) => {
  const fixture = await createFixture(fragmentSource(), {
    extraConfig: 'colorSchemes: ["light", "dark"], renderer: "renderer.tsx",',
  });
  context.after(() => removeFixture(fixture));
  await fs.promises.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    `import { renderToStaticMarkup } from "react-dom/server";
export default input => {
 const body = renderToStaticMarkup(input.node);
 return "<html><body>" + (input.entry.id === "details" && input.viewport === "mobile" && input.colorScheme === "dark" ? body.replace(' id="section"', '') : body) + "</body></html>";
};`,
  );
  await assert.rejects(
    async () => compileCatalogue(await loadConfig(fixture.root)),
    /logical fragment section.*missing.*mobile.*dark/,
  );
});

function fragmentSource(): string {
  return `import { defineScreen } from "@mokly/mokly";
import React from "react";
const metadata = { dependencies: [], navPath: ["Fixture"], relatedDocs: [], useCaseIds: [] };
export const mockups = [
  defineScreen({ ...metadata, description: "Home", desktop: <main><a href="mock:details#section">Details</a></main>, id: "home", mobile: <main><a href="mock:details#section">Details</a></main>, route: "screens/home.html", title: "Home" }),
  defineScreen({ ...metadata, description: "Details", desktop: <main id="section">Details</main>, id: "details", mobile: <main id="section">Details</main>, route: "screens/details.html", title: "Details" })
];
`;
}
