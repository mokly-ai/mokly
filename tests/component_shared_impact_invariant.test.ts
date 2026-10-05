import assert from "node:assert/strict";
import { test } from "node:test";

import {
  pathCatalogueSource,
  pathEvidenceFixture,
  withEntryPaths,
} from "./helpers/component_path_evidence_fixture.js";

const globs = ["src/components/**", "src/styles/**", "mockups/**"];
const changedPaths = [
  "src/components/unowned.mokly.tsx",
  "src/shared/before/child.ts",
  "src/shared/after/child.ts",
  "notes.md",
  "src/components/action/impl.ts",
  "src/styles/owned.css",
  "src/styles/free.css",
  "mockups/unused.css",
  "src/tokens/pane.ts",
  "src/tokens/home.ts",
  "src/one-side/removed-screen/child.ts",
  "src/one-side/added-screen/child.ts",
  "src/one-side/removed-component/child.ts",
  "src/one-side/added-component/child.ts",
];

test("removed path inputs do not create evidence on current or removed records", async (context) => {
  const { before, after, result } = await pathEvidenceFixture(context, {
    beforeSource: singleSideSource(mixedSource("src/shared/before"), "removed"),
    afterSource: singleSideSource(mixedSource("src/shared/after"), "added"),
    changedPaths,
    sharedGlobs: globs,
  });
  for (const entry of [...before.manifest.entries, ...after.manifest.entries])
    for (const field of [
      "dependencies",
      "declaredDependencies",
      "ownedDependencies",
    ])
      assert.equal(Object.hasOwn(entry, field), false, entry.path);
  for (const side of ["removed", "added"] as const)
    for (const kind of ["screen", "component"] as const) {
      const entries = kind === "screen" ? result.screens : result.components;
      const entry = entries.find((item) => item.path === `${side}-${kind}`);
      assert.ok(entry);
      assert.equal(entry.before === undefined, side === "added");
      assert.equal(entry.after === undefined, side === "removed");
    }
  for (const entry of [...result.screens, ...result.components]) {
    assert.equal(Object.hasOwn(entry, "sharedImpact"), false, entry.path);
    assert.equal(Object.hasOwn(entry, "dependencies"), false, entry.path);
    const views =
      "views" in entry
        ? entry.views
        : entry.variants.flatMap((variant) => variant.views);
    assert.ok(
      views.every(
        (view) =>
          !(view.reasons ?? []).some((reason) =>
            changedPaths.includes(reason.path),
          ),
      ),
    );
  }
  assert.ok(
    result.changes.every((entry) =>
      entry.reasons.every((reason) => reason.kind !== "dependency"),
    ),
  );
});

function mixedSource(directory: string): string {
  let source = pathCatalogueSource([directory]);
  const actionOwners = [
    "notes.md",
    "src/components/action",
    "src/styles/owned.css",
  ];
  source = withEntryPaths(
    source,
    "action",
    [directory, ...actionOwners],
    actionOwners,
  );
  source = withEntryPaths(source, "pane", [directory, "src/tokens/pane.ts"]);
  return withEntryPaths(source, "home", [
    directory,
    "notes.md",
    "src/tokens/home.ts",
  ]);
}

function singleSideSource(source: string, side: "removed" | "added"): string {
  const componentId = `${side}-component`;
  const screenPath = `${side}-screen`;
  return source
    .replace(
      "export const mockups = [",
      `const oneSide = defineComponent({
  ...metadata, path: "${componentId}", title: "${side} component",
  description: "Only this side declares its shared folder",
  dependencies: ["src/one-side/${componentId}"],
  propSchema: { kind: "object", properties: {} },
  render: () => <span>${side} content</span>,
  variants: [{ slug:"default",  title: "${side} default", props: {} }]
});
export const mockups = [...oneSide.entries,`,
    )
    .replace(
      "\n];",
      `,\n  defineScreen({
  ...metadata, path: "${screenPath}", title: "${side} screen",
  description: "Only this side declares its shared folder",
  dependencies: ["src/one-side/${screenPath}"],
  mobile: <main>${side} content</main>, desktop: <main>${side} content</main>
})\n];`,
    );
}
