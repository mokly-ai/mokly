import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { validateComponentReviewSources } from "../dist/review/component_result_sources.js";
import { parseReviewResult } from "../packages/viewer/dist/review/result_validation.js";

import {
  assertFastPathEquivalent,
  classifyFixtureWithSources,
  compilationFiles,
} from "./helpers/component_fast_path.js";
import { componentEntrySource } from "./helpers/component_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

test("source validation rejects a reason injected onto an affected-only screen", async (t) => {
  const changed = "mockups/action.css";
  const { before, after, result, classified } =
    await stylesheetValidationFixture(t, "component", true);
  const screen = result.screens.find((entry) => entry.id === "home")!;
  assert.ok(
    screen.views.some((view) =>
      view.reasons?.some((reason) => reason.path === changed),
    ),
  );
  assert.ok(
    !result.changes.some(
      (entry) => entry.kind === "screen" && entry.after?.id === "home",
    ),
  );
  const tampered = structuredClone(result);
  tampered.changes = [
    ...tampered.changes,
    {
      kind: "screen",
      before: screen.before!,
      after: screen.after!,
      reasons: [{ kind: "dependency", path: changed }],
    },
  ];
  assert.doesNotThrow(() => parseReviewResult(tampered));
  assert.throws(
    () =>
      validateComponentReviewSources(
        tampered,
        before.manifest,
        after.manifest,
        classified.implementationImpact,
        classified.sources,
      ),
    /dependency reason has no source evidence/,
  );
});

for (const kind of ["component", "screen"] as const)
  test(`source validation rejects an excluded public stylesheet declared by a ${kind}`, async (t) => {
    const fixture = await stylesheetValidationFixture(t, kind, false);
    const { before, after, result, classified } = fixture;
    assert.deepEqual(result.changes, []);
    const entry =
      kind === "component"
        ? result.components.find((item) => item.id === "action")!
        : result.screens.find((item) => item.id === "home")!;
    const views =
      "variants" in entry
        ? entry.variants.flatMap((variant) => variant.views)
        : entry.views;
    assert.ok(
      views.every((view) =>
        view.excludedResources?.some(
          (resource) => resource.path === "mockups/action.css",
        ),
      ),
    );
    const tampered = structuredClone(result);
    tampered.changes = [
      {
        kind,
        before: entry.before!,
        after: entry.after!,
        reasons: [{ kind: "dependency", path: "mockups/action.css" }],
      },
    ];
    assert.doesNotThrow(() => parseReviewResult(tampered));
    assert.throws(
      () =>
        validateComponentReviewSources(
          tampered,
          before.manifest,
          after.manifest,
          classified.implementationImpact,
          classified.sources,
        ),
      /dependency reason has no source evidence/,
    );
  });

test("an owned stylesheet retained by an exact-declaring screen remains valid", async (t) => {
  const fixture = await stylesheetValidationFixture(t, "both", true);
  const { before, after, result, classified } = fixture;
  const screen = result.screens.find((entry) => entry.id === "home")!;
  assert.ok(
    screen.views.some((view) =>
      view.reasons?.some((reason) => reason.path === "mockups/action.css"),
    ),
  );
  assert.ok(
    result.changes.some(
      (entry) =>
        entry.kind === "screen" &&
        entry.after?.id === "home" &&
        entry.reasons.some(
          (reason) =>
            reason.kind === "dependency" &&
            reason.path === "mockups/action.css",
        ),
    ),
  );
  assert.doesNotThrow(() =>
    validateComponentReviewSources(
      result,
      before.manifest,
      after.manifest,
      classified.implementationImpact,
      classified.sources,
    ),
  );
});

async function stylesheetValidationFixture(
  t: { after: (cleanup: () => Promise<void>) => void },
  declaration: "component" | "screen" | "both",
  matches: boolean,
) {
  let source = componentEntrySource({
    actionRender:
      '(props) => <button className="action">{props.label}</button>',
  });
  if (declaration !== "screen")
    source = source.replace(
      'id: "action",',
      'id: "action", dependencies: ["mockups/action.css"], ownedDependencies: ["mockups/action.css"],',
    );
  if (declaration !== "component")
    source = source.replace(
      'id: "home",',
      'id: "home", dependencies: ["mockups/action.css"],',
    );
  const fixture = await createFixture(source, {
    extraConfig:
      'colorSchemes: ["light", "dark"], stylesheets: [{ match: "**/*.html", stylesheets: ["action.css"] }],',
  });
  t.after(() => removeFixture(fixture));
  await fs.writeFile(path.join(fixture.mockupsDir, "action.css"), "");
  const config = await loadConfig(fixture.root);
  const before = await compileCatalogue(config);
  const after = await compileCatalogue(config);
  const selector = matches ? ".action" : ".absent";
  const caseInput = {
    before: before.manifest,
    after: after.manifest,
    beforeFiles: compilationFiles(before, {
      "action.css": `${selector}{color:red}`,
    }),
    afterFiles: compilationFiles(after, {
      "action.css": `${selector}{color:green}`,
    }),
    changedPaths: ["mockups/action.css"],
    config,
  };
  const result = await assertFastPathEquivalent(caseInput);
  const classified = await classifyFixtureWithSources(caseInput);
  assert.deepEqual(classified.result, result);
  return { before, after, result, classified };
}
