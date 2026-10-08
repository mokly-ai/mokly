import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import {
  readCatalogue,
  readShellCatalogue,
} from "../packages/viewer/src/catalogue/reader.js";
import { projectScopedCatalogue } from "../packages/viewer/src/catalogue/scoped_projection.js";
import { createCatalogue } from "../packages/viewer/src/shell/catalogue.js";
import { viewerCatalogue } from "../packages/viewer/src/viewer/projection.js";
import { projectCatalogue } from "../src/catalogue/projection.js";
import { removedManifestEntries } from "../src/registry/changes.js";

import { entriesWhere, entryAt } from "./helpers/catalogue_selection.js";
import { pathFixture } from "./helpers/path_fixture.js";

for (const kind of ["screen", "component"] as const) {
  test(`removed ${kind} variants keep their baseline parent title before selection`, async (t) => {
    const metadata =
      "title:'Former title',description:'Example',dependencies:[],relatedDocs:[]";
    const fixture = await pathFixture({
      "specs/library/action.mockup.tsx":
        kind === "screen"
          ? `import {defineScreen} from '@mokly/mokly'; export default defineScreen({${metadata},mobile:<p>Parent</p>,desktop:<p>Parent</p>,variants:[{slug:'old',title:'Old',description:'Old variant',mobile:<p>Old</p>,desktop:<p>Old</p>},{slug:'kept',title:'Kept',description:'Kept variant',mobile:<p>Kept</p>,desktop:<p>Kept</p>}]});`
          : `import {defineComponent} from '@mokly/mokly'; export default defineComponent({${metadata},propSchema:{kind:'object',properties:{}},render:()=><p>Parent</p>,variants:[{slug:'old',title:'Old',props:{}},{slug:'kept',title:'Kept',props:{}}]});`,
    });
    t.after(fixture.remove);
    const baseline = (await fixture.compile()).manifest;
    const parent = entryAt(baseline, "library/action", kind);
    for (const replacement of ["absent", "document", "retitled"] as const) {
      const current = {
        ...baseline,
        entries:
          replacement === "absent"
            ? []
            : replacement === "retitled"
              ? entriesWhere(
                  baseline,
                  "entries without the removed action variant",
                  (entry) => entry.path !== "library/action/old",
                ).map((entry) =>
                  entry.path === parent.path
                    ? { ...entry, title: "New title" }
                    : entry,
                )
              : [
                  {
                    kind: "document" as const,
                    path: parent.path,
                    title: "Guide",
                    description: "Replacement",
                    sourcePath: "specs/library/action.md",
                    declaredDependencies: [],
                    relatedDocs: [],
                    colorSchemes: ["light" as const],
                    resources: [],
                  },
                ],
      };
      const removed = removedManifestEntries(current, baseline);
      const variant = removed.find(
        ({ entry }) => entry.path === "library/action/old",
      )!;
      assert.equal(variant.parentTitle, "Former title", replacement);
      for (const record of removed.filter(
        ({ entry }) => entry.path === parent.path,
      ))
        assert.equal(Object.hasOwn(record, "parentTitle"), false);
      const model = projectCatalogue({
        catalogue: createCatalogue(current, removed),
        configPath: "mokly.config.ts",
        changesStatus: "ready",
        comparisonUrl: null,
        evidence: { baseline },
        revision: { content: 0, evidence: 0 },
      });
      assert.equal(
        model.removedEntries.find(
          ({ entry }) => entry.path === variant.entry.path,
        )?.parentTitle,
        "Former title",
      );
      assert.deepEqual(readCatalogue(model), model);
      assert.deepEqual(readShellCatalogue(model), model);
      const scoped = projectScopedCatalogue(model, {
        kind: "target",
        entryKind: kind,
        entryPath: variant.entry.path,
      });
      assert.deepEqual(readShellCatalogue(scoped), scoped);
      assert.equal(
        viewerCatalogue(model).removedEntries.find(
          ({ entry }) => entry.path === variant.entry.path,
        )?.parentTitle,
        "Former title",
      );
    }
  });
}

for (const [name, reader] of [
  ["complete", readCatalogue],
  ["scoped", readShellCatalogue],
] as const) {
  for (const kind of ["screen", "component"] as const) {
    test(`${name} reader requires parentTitle exactly on removed ${kind} variants`, async () => {
      const model = JSON.parse(
        await fs.readFile("docs/protocol/fixtures/catalogue-v5.json", "utf8"),
      );
      const source = kind === "screen" ? model.screens[0] : model.components[1];
      const entry = {
        ...source,
        path: "former/old",
        variantOf: "former",
        changes: { status: "ready", kind: "removed", included: true },
      };
      delete entry.previousPath;
      const comparison = {
        status: "ready",
        kind: "removed",
        eligible: kind === "component",
      };
      if (kind === "component") entry.comparison = comparison;
      entry.views = entry.views.map((view: Record<string, unknown>) => ({
        ...view,
        comparison,
      }));
      const record = {
        entry,
        folderTitles: [],
        parentTitle: "Former title",
        snapshotId: "d".repeat(64),
      };
      model.removedEntries = [record];
      assert.equal(
        reader(model).removedEntries[0]?.parentTitle,
        "Former title",
      );
      for (const value of [undefined, null, "", "  ", 42]) {
        const invalid = structuredClone(model);
        if (value === undefined) delete invalid.removedEntries[0].parentTitle;
        else invalid.removedEntries[0].parentTitle = value;
        assert.throws(() => reader(invalid), /parentTitle/, String(value));
      }
      for (const value of ["Former title", "", null]) {
        const invalid = structuredClone(model);
        invalid.removedEntries[0].entry = {
          ...model.pages[0],
          path: "former",
          changes: entry.changes,
        };
        invalid.removedEntries[0].parentTitle = value;
        assert.throws(() => reader(invalid), /parentTitle/);
      }
    });
  }
}
