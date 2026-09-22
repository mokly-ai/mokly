import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { changedManifestRoutes } from "../dist/registry/changed_routes.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("definitions retain the module that invokes their helper", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  await fs.promises.writeFile(
    path.join(fixture.entriesDir, "shared.ts"),
    `import { defineScreen } from "@mokly/mokly";
const metadata = { dependencies: ["notes.md"], relatedDocs: ["notes.md"], useCaseIds: [] };
export function makeShared(id: string, route: string, title: string) {
  return defineScreen({ ...metadata, description: title, desktop: title, id, mobile: title, route, title });
}
`,
  );
  await fs.promises.writeFile(
    path.join(fixture.entriesDir, "late.ts"),
    screenSource("late", "screens/late.html", "Late"),
  );
  await fs.promises.writeFile(
    fixture.entryPath,
    `import { makeShared } from "./shared.js";
export const mockups = [makeShared("shared-first", "screens/shared-first.html", "Shared first")];
`,
  );
  await fs.promises.writeFile(
    path.join(fixture.entriesDir, "second.mockup.ts"),
    `import { defineScreen } from "@mokly/mokly";
import { late } from "./late.js";
import { makeShared } from "./shared.js";
const metadata = { dependencies: ["notes.md"], relatedDocs: ["notes.md"], useCaseIds: [] };
export const mockups = [
  defineScreen({ ...metadata, description: "Second", desktop: "Second", id: "second", mobile: "Second", route: "screens/second.html", title: "Second" }),
  makeShared("shared-second", "screens/shared-second.html", "Shared second"),
  late
];
`,
  );

  const compilation = await compileCatalogue(await loadConfig(fixture.root));
  const sources = new Map(
    compilation.manifest.entries.map((entry) => [entry.id, entry.sourcePath]),
  );

  assert.equal(sources.get("shared-first"), "entries/shared.ts");
  assert.equal(sources.get("shared-second"), "entries/shared.ts");
  assert.equal(sources.get("late"), "entries/late.ts");
  assert.equal(sources.get("second"), "entries/second.mockup.ts");
});

test("flattened screen variants retain their defining module", async (context) => {
  const fixture = await createFixture(`
import { defineScreen } from "@mokly/mokly";
export const mockups = [defineScreen({
  dependencies: [],
  description: "Parent",
  desktop: "Parent",
  id: "parent",
  mobile: "Parent",
  relatedDocs: [],
  route: "screens/parent.html",
  title: "Parent",
  variants: [{
    description: "Empty",
    desktop: "Empty",
    id: "parent-empty",
    mobile: "Empty",
    slug: "empty",
    title: "Parent, empty"
  }]
})];
`);
  context.after(() => removeFixture(fixture));

  const manifest = (await compileCatalogue(await loadConfig(fixture.root)))
    .manifest;
  assert.deepEqual(
    manifest.entries.map(({ id, sourcePath }) => [id, sourcePath]),
    [
      ["parent", "entries/fixture.mockup.tsx"],
      ["parent-empty", "entries/fixture.mockup.tsx"],
    ],
  );
});

test("dark fragment changes attribute their screen", async (context) => {
  const fixture = await createFixture(undefined, {
    extraConfig: 'colorSchemes: ["light", "dark"],',
  });
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const manifest = (await compileCatalogue(config)).manifest;

  const routes = changedManifestRoutes(manifest, manifest, config, [
    "mockups/screens/home.mobile.dark.html",
  ]);
  assert.ok(routes.includes("screens/home.html"));
  assert.equal(routes.includes("screens/details.html"), false);
});

function screenSource(id: string, route: string, title: string): string {
  return `import { defineScreen } from "@mokly/mokly";
const metadata = { dependencies: ["notes.md"], relatedDocs: ["notes.md"], useCaseIds: [] };
export const ${id} = defineScreen({ ...metadata, description: ${JSON.stringify(title)}, desktop: ${JSON.stringify(title)}, id: ${JSON.stringify(id)}, mobile: ${JSON.stringify(title)}, route: ${JSON.stringify(route)}, title: ${JSON.stringify(title)} });
`;
}
