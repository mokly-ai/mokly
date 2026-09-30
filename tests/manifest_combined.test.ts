import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import {
  parseHistoricalManifest,
  parseManifest,
} from "../dist/registry/manifest.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

const pageSource = `import { definePage } from "@mokly/mokly";
export const mockups = [definePage({ id: "handbook", title: "Handbook", description: "Document", dependencies: [], relatedDocs: [], render: () => "<html><body>Handbook</body></html>" })];`;

test("v7 combines pages and component usage at both manifest boundaries", async (t) => {
  const fixture = await createFixture(componentEntrySource());
  t.after(() => removeFixture(fixture));
  await fs.writeFile(`${fixture.entriesDir}/handbook.mockup.ts`, pageSource);
  const compilation = await compileCatalogue(await loadConfig(fixture.root));
  const current = parseManifest(compilation.manifest);
  const historical = parseHistoricalManifest(compilation.manifest);
  assert.deepEqual(historical, current);
  assert.equal(current.schemaVersion, 7);
  assert.ok(current.sourceFiles.includes("entries/handbook.mockup.ts"));
  assert.ok(current.entries.some((entry) => entry.kind === "page"));
  assert.ok(current.entries.some((entry) => entry.kind === "component"));
  const screen = current.entries.find((entry) => entry.kind === "screen");
  assert.ok(screen?.componentViews?.every((view) => view.instances.length > 0));
  assert.match(
    compilation.outputs.get("pages/handbook.html") ?? "",
    /Handbook/,
  );
});
