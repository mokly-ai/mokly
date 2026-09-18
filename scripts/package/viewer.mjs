import fs from "node:fs/promises";
import path from "node:path";

import { runCommand } from "./command.mjs";

/** Exercise the installed viewer using the CLI's actual exported public data. */
export async function smokeViewer(root) {
  const script = `import assert from "node:assert/strict";
import fs from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MoklyViewer, readCatalogue, sameOriginAdapter, postMessageAdapter } from "@mokly/viewer";
import { renderViewer } from "@mokly/viewer/server";
import { initializeBrowseShell } from "@mokly/viewer/runtime";
import { resolveInstance } from "@mokly/viewer/data";
assert.equal(typeof initializeBrowseShell, "function");
assert.equal(typeof resolveInstance, "function");
const fixture = readCatalogue(JSON.parse(fs.readFileSync("node_modules/@mokly/mokly/docs/protocol/fixtures/catalogue-v1.json", "utf8")));
assert.ok(renderViewer({catalogue: fixture, baseUrl: "https://fixture.example", defaultSelection: {screenId: fixture.screens[0].id}}).includes(fixture.screens[0].title));
const catalogue = readCatalogue(JSON.parse(fs.readFileSync("published/__mokly/catalogue.json", "utf8")));
const props = {catalogue, baseUrl: "https://artifact.example", defaultSelection: {screenId: catalogue.screens[0].id}};
const html = renderViewer(props);
assert.equal(html, renderToStaticMarkup(createElement(MoklyViewer, props)));
assert.ok(html.includes(catalogue.screens[0].title));
assert.equal(typeof sameOriginAdapter().mount, "function");
assert.equal(typeof postMessageAdapter({frameOrigin: "https://frames.example"}).mount, "function");
assert.ok(fs.readFileSync(new URL(import.meta.resolve("@mokly/viewer/styles.css")), "utf8").includes("@scope (.mokly-viewer)"));
`;
  const filename = path.join(root, "verify-viewer.mjs");
  await fs.writeFile(filename, script);
  await runCommand("node", [filename], { cwd: root });
}
