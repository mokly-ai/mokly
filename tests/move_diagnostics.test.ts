import assert from "node:assert/strict";
import test from "node:test";

import { summaryMarkdown } from "../dist/review/artifact.js";
import { compareReview } from "../dist/review/compare.js";
import { computeCatalogueChanges } from "../dist/server/changed.js";

import { componentReviewFixture } from "./helpers/component_review_fixture.js";
import { pageSource } from "./helpers/path_fixture.js";

test("an unmatched movedFrom remains added and records the exact comparison diagnostic", async (t) => {
  const fixture = await componentReviewFixture(
    t,
    () => pageSource('path:"new",movedFrom:"missing",'),
    pageSource('path:"old",'),
  );
  const artifact = await compareReview(
    fixture.after,
    fixture.config,
    fixture.git,
    "main",
  );
  assert.deepEqual(artifact.pairing, {
    moves: [],
    diagnostics: [
      "new: movedFrom missing matched no removed baseline entry of kind page",
    ],
  });
  assert.ok(
    summaryMarkdown(artifact.result, artifact.pairing).includes(
      "new: movedFrom missing matched no removed baseline entry of kind page",
    ),
  );
  const changes = await computeCatalogueChanges(
    fixture.config,
    "main",
    fixture.git,
    fixture.after.manifest,
  );
  assert.deepEqual(changes.movedEntries, []);
  assert.deepEqual(
    changes.removedEntries.map(({ entry }) => entry.path),
    ["old"],
  );
  assert.deepEqual(changes.changedEntries, ["new", "old"]);
});

for (const declared of [false, true])
  test(`ambiguous identical screens require an explicit declaration: declared=${declared}`, async (t) => {
    const screen = (path: string, extra = "") =>
      `defineScreen({path:'${path}',title:'Same',description:'A screen',dependencies:[],relatedDocs:[],mobile:'Content',desktop:'Content',${extra}})`;
    const before = `import {defineScreen} from '@mokly/mokly'; export default [${screen("a")},${screen("b")}];`;
    const after = `import {defineScreen} from '@mokly/mokly'; export default [${screen("new", declared ? "movedFrom:'a'," : "")}];`;
    const fixture = await componentReviewFixture(t, () => after, before);
    const artifact = await compareReview(
      fixture.after,
      fixture.config,
      fixture.git,
      "main",
    );
    assert.deepEqual(
      artifact.pairing,
      declared
        ? {
            moves: [{ kind: "screen", path: "new", previousPath: "a" }],
            diagnostics: [],
          }
        : {
            moves: [],
            diagnostics: [
              "added screen new matches removed entries a and b; declare movedFrom to pair it",
            ],
          },
    );
    assert.equal(
      artifact.result.screens.find((entry) => entry.path === "new")?.state,
      declared ? "unchanged" : "added",
    );
  });
