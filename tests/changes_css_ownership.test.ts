import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { renderReviewArtifact } from "../dist/review/artifact.js";
import { compareReview } from "../dist/review/compare.js";
import {
  NodeGitCommandRunner,
  CommittedRepository,
} from "../dist/review/git.js";
import { committedReviewRepository } from "../dist/review/repository.js";
import { computeCatalogueChanges } from "../dist/server/changed.js";
import { parseReviewResult } from "../packages/viewer/dist/review/result_validation.js";

import { changedFixture } from "./helpers/changed_fixture.js";
import { componentEntrySource } from "./helpers/component_fixture.js";

for (const ownership of ["dependency", "renderer"] as const)
  for (const exact of [false, true])
    for (const matches of [false, true])
      test(`actual invocation CSS ownership=${ownership}, exact screen=${exact}, matches=${matches}`, async (t) => {
        const source = componentEntrySource({
          actionRender:
            '(props) => <button className={props.label === "Finish" ? "actual-only" : "saved"}>{props.label}</button>',
        })
          .replace(
            'id: "action",',
            ownership === "dependency"
              ? 'id: "action", dependencies: ["mockups/action.css"], ownedDependencies: ["mockups/action.css"],'
              : 'id: "action",',
          )
          .replace(
            'id: "home",',
            exact
              ? 'id: "home", dependencies: ["mockups/action.css"],'
              : 'id: "home",',
          );
        const fixture = await changedFixture(
          t,
          source,
          {
            extraConfig: `colorSchemes: ["light", "dark"], stylesheets: [{ match: "**", stylesheets: ["action.css"] }], ${ownership === "renderer" ? 'renderer: "renderer.tsx",' : ""}`,
          },
          async ({ root, mockupsDir }) => {
            await fs.writeFile(
              path.join(mockupsDir, "action.css"),
              ".actual-only { color: red; }",
            );
            if (ownership === "renderer")
              await fs.writeFile(
                path.join(root, "renderer.tsx"),
                `import { renderToStaticMarkup } from "react-dom/server";
export default (input) => ({ html: '<html><head><link rel="stylesheet" href="' + input.stylesheets[0] + '"></head><body>' + renderToStaticMarkup(input.node) + '</body></html>', resources: [{ path: "action.css", componentIds: ["action"] }] });`,
              );
          },
        );
        await fs.appendFile(
          path.join(fixture.mockupsDir, "action.css"),
          matches
            ? ".actual-only { color: blue; }"
            : ".not-present { color: blue; }",
        );
        const live = await computeCatalogueChanges(
          fixture.config,
          "main",
          committedReviewRepository(fixture.config),
        );
        const expected = matches
          ? ["components/action.html", ...(exact ? ["screens/home.html"] : [])]
          : [];
        assert.deepEqual(live.changedRoutes, expected);
        const artifact = await compareReview(
          await compileCatalogue(fixture.config),
          fixture.config,
          new CommittedRepository(new NodeGitCommandRunner(fixture.root)),
          "main",
        );
        const { result } = artifact;
        assert.equal(result.schemaVersion, 3);
        if (result.schemaVersion !== 3) return;
        assert.deepEqual(live.componentChanges?.result, result);
        const reason = {
          kind: "dependency",
          path: "mockups/action.css",
          analysis: { status: "matched", selectors: [".actual-only"] },
        };
        for (const change of result.changes)
          assert.deepEqual(change.reasons, [reason]);
        const home = result.screens.find((entry) => entry.id === "home")!;
        assert.equal(home.views.length, 4);
        for (const view of home.views) {
          assert.equal(view.state, matches ? "changed" : "unchanged");
          assert.deepEqual(view.reasons, matches ? [reason] : undefined);
          assert.deepEqual(
            view.excludedResources,
            matches
              ? undefined
              : [{ path: "mockups/action.css", reason: "no-matching-rule" }],
          );
        }
        for (const component of result.components) {
          assert.deepEqual(
            component.sharedImpact,
            matches && component.id === "action" ? ["mockups/action.css"] : [],
          );
          for (const variant of component.variants) {
            assert.equal(variant.views.length, 4);
            for (const view of variant.views) {
              assert.equal(view.state, "unchanged");
              assert.deepEqual(view.excludedResources, [
                { path: "mockups/action.css", reason: "no-matching-rule" },
              ]);
              assert.equal(view.reasons, undefined);
            }
          }
        }
        assert.equal(Boolean(result.affectedConsumers.length), matches);
        const files = renderReviewArtifact(artifact);
        assert.deepEqual(
          parseReviewResult(JSON.parse(String(files.get("review.json")))),
          result,
        );
      });

test("non-CSS declared public dependencies retain their existing file-level policy", async (t) => {
  const fixture = await changedFixture(
    t,
    componentEntrySource().replace(
      'id: "action",',
      'id: "action", dependencies: ["mockups/asset.svg"], ownedDependencies: ["mockups/asset.svg"],',
    ),
    undefined,
    ({ mockupsDir }) =>
      fs.writeFile(path.join(mockupsDir, "asset.svg"), "<svg></svg>"),
  );
  await fs.appendFile(path.join(fixture.mockupsDir, "asset.svg"), "\n");
  const live = await computeCatalogueChanges(
    fixture.config,
    "main",
    committedReviewRepository(fixture.config),
  );
  assert.deepEqual(live.changedRoutes, ["components/action.html"]);
  const result = live.componentChanges?.result;
  assert.equal(result?.schemaVersion, 3);
  if (result?.schemaVersion !== 3) return;
  assert.deepEqual(result.changes[0]?.reasons, [
    { kind: "dependency", path: "mockups/asset.svg" },
  ]);
});
