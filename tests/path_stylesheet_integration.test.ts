import assert from "node:assert/strict";
import test from "node:test";

import { parseManifest } from "../dist/registry/manifest.js";
import { mapUsagePaths } from "../dist/review/moves/identity.js";
import { validateCssAnalysis } from "../packages/viewer/dist/review/result_css.js";

import {
  assertFastPathEquivalent,
  compilationFiles,
} from "./helpers/component_fast_path.js";
import { currentManifest } from "./helpers/current_manifest.js";
import { stylesheetMoveFixture } from "./helpers/move_review_fixture.js";
import { pathFixture } from "./helpers/path_fixture.js";

for (const kind of ["screen", "component"] as const)
  for (const destination of ["new/home", "new/deep/home"])
    for (const stylesheet of ["action.css", "old/action.css"])
      test(`${kind} move to ${destination} with ${stylesheet} agrees on complete and fast comparison`, async (t) => {
        const fixture = await stylesheetMoveFixture(
          t,
          kind,
          destination,
          stylesheet,
        );
        const result = await assertFastPathEquivalent({
          before: fixture.before.manifest,
          after: fixture.after.manifest,
          beforeFiles: compilationFiles(fixture.before, fixture.resources),
          afterFiles: compilationFiles(fixture.after, fixture.resources),
          config: fixture.config,
          changedPaths: [],
        });
        assert.deepEqual(
          result.changes.map((entry) => [
            entry.after?.path,
            entry.previousPath,
            entry.reasons,
          ]),
          kind === "screen"
            ? [[destination, "old/home", []]]
            : [
                [destination, "old/home", []],
                [`${destination}/default`, "old/home/default", []],
              ],
        );
        assert.deepEqual(result.affectedConsumers, []);
        const views =
          kind === "screen"
            ? result.screens.find((entry) => entry.path === destination)!.views
            : result.components.find((entry) => entry.path === destination)!
                .variants[0]!.views;
        assert.equal(views.length, 2);
        assert.ok(
          views.every((view) => view.state === "unchanged" && !view.material),
        );
      });

test("path definitions keep stylesheet provenance and removed-field warnings beside documents", async (t) => {
  const fixture = await pathFixture({
    "generated/action.css": ".action { color: red; }",
    "specs/library/action.mockup.tsx": `import {defineComponent} from '@mokly/mokly';
export const action = defineComponent({title:'Action',description:'A control',
 dependencies:['unused.ts'],ownedDependencies:['unused.ts'],stylesheets:['action.css'],relatedDocs:[],
 propSchema:{kind:'object',properties:{}},render:()=> <button className="action">Save</button>,
 variants:[{slug:'default',title:'Default',props:{}}]});`,
    "specs/shop/home.mockup.tsx": `import {defineScreen} from '@mokly/mokly';
import {action} from '../library/action.mockup.js';
export default defineScreen({title:'Home',description:'Home',relatedDocs:[],
 mobile:<main><action.Component/></main>,desktop:<main><action.Component/></main>});`,
    "specs/shop/README.md": "# Shop\n\nChoose a screen.\n",
  });
  t.after(fixture.remove);
  const built = await fixture.compile();
  assert.equal(parseManifest(built.manifest).schemaVersion, 10);
  assert.deepEqual(
    built.diagnostics?.map((warning) => [warning.subject?.path]),
    [["library/action"], ["library/action"]],
  );
  assert.ok(
    built.manifest.entries.some(
      (entry) => entry.kind === "document" && entry.path === "shop",
    ),
  );
  const screen = built.manifest.entries.find(
    (entry) => entry.path === "shop/home",
  );
  assert.equal(screen?.kind, "screen");
  if (screen?.kind !== "screen") assert.fail("Missing screen");
  assert.deepEqual(
    screen.componentViews?.[0]?.insertedStylesheets?.[0]?.componentPaths,
    ["library/action"],
  );
  assert.ok(
    screen.componentViews?.[0]?.instances.every(
      (instance) => instance.componentId === "library/action",
    ),
  );
});

test("move normalization maps inserted stylesheet declarers and preserves their spans", () => {
  const span = {
    path: "action.css",
    startOffset: 10,
    endOffset: 60,
    componentPaths: ["old/action"],
  };
  const mapped = mapUsagePaths(
    {
      viewport: "mobile",
      colorScheme: "light",
      instances: [],
      slots: [],
      ranges: [],
      styles: [],
      resources: [],
      insertedStylesheets: [span],
    },
    (path) => (path === "old/action" ? "library/action" : path),
  );
  assert.deepEqual(mapped.insertedStylesheets, [
    { ...span, componentPaths: ["library/action"] },
  ]);
  assert.deepEqual(span.componentPaths, ["old/action"]);
});

test("CSS rule evidence accepts component paths and rejects the former field", () => {
  const rule = {
    ruleKey: "a".repeat(64),
    status: "matched",
    selectors: [".action"],
    changedComponentPaths: ["library/action"],
    pageSelectors: [],
  };
  validateCssAnalysis({
    status: "matched",
    selectors: [".action"],
    rules: [rule],
  });
  const { changedComponentPaths, ...rest } = rule;
  assert.throws(() =>
    validateCssAnalysis({
      status: "matched",
      selectors: [".action"],
      rules: [{ ...rest, changedComponentIds: changedComponentPaths }],
    }),
  );
});

test("removed folder dependencies warn using the folder path without inheritance", async (t) => {
  const fixture = await pathFixture({
    "specs/home.mockup.ts": `import {defineFolder,defineScreen} from '@mokly/mokly';
export const entries = [defineFolder({path:'shop',dependencies:undefined}),
defineScreen({path:'shop/home',title:'Home',description:'Home',relatedDocs:[],mobile:'Home',desktop:'Home'})];`,
  });
  t.after(fixture.remove);
  const built = await fixture.compile();
  assert.deepEqual(
    built.diagnostics?.map(({ code, subject, message }) => ({
      code,
      subject,
      message,
    })),
    [
      {
        code: "removed-dependencies",
        subject: { kind: "folder", path: "shop" },
        message:
          "dependencies has been removed; ignoring it. Delete the field.",
      },
    ],
  );
  assert.ok(
    built.manifest.entries.every(
      (entry) => !Object.hasOwn(entry, "dependencies"),
    ),
  );
});

test("a moved whole-document page retains Unmodified evidence status", async () => {
  const { createCatalogue } =
    await import("../packages/viewer/dist/shell/catalogue.js");
  const { pageComparisonEvidence } =
    await import("../packages/viewer/dist/shell/page_evidence_data.js");
  const before = currentManifest({
    schemaVersion: 10 as const,
    generatedBy: "mokly" as const,
    folders: [],
    sourceFiles: ["specs/page.mockup.ts"],
    entries: [
      {
        kind: "page" as const,
        path: "old/guide",
        title: "Guide",
        description: "Guide",
        relatedDocs: [],
        sourcePath: "specs/page.mockup.ts",
      },
    ],
  });
  const after = currentManifest({
    ...before,
    entries: before.entries.map((entry) => ({ ...entry, path: "docs/guide" })),
  });
  const pairing = {
    moves: [
      { kind: "page" as const, path: "docs/guide", previousPath: "old/guide" },
    ],
    diagnostics: [],
  };
  const catalogue = createCatalogue(after, [], pairing.moves);
  assert.deepEqual(
    pageComparisonEvidence(
      catalogue,
      {
        base: "main",
        updateVersion: 0,
        changedEntries: ["docs/guide"],
        componentChanges: { baseline: before, pairing, changedEntries: [] },
      },
      "docs/guide",
    ),
    { status: "Unmodified" },
  );
});
