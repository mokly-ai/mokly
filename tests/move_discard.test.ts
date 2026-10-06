import assert from "node:assert/strict";
import test from "node:test";

import { compareReview } from "../packages/mokly/dist/review/compare.js";
import { computeCatalogueChanges } from "../packages/mokly/dist/server/changed.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { moveReviewFixture as componentReviewFixture } from "./helpers/move_review_fixture.js";

test("an unpaired baseline screen is discarded when a current page reuses its path", async (t) => {
  const source = componentEntrySource();
  const fixture = await componentReviewFixture(
    t,
    (value) => {
      const prefix = value.split("\n  defineScreen(")[0]!;
      return (
        prefix.replace(
          "defineComponent, defineScreen,",
          "defineComponent, defineScreen, definePage,",
        ) +
        "\n  definePage({...metadata,path:'home',title:'Handbook',description:'An unrelated page',render:()=>'<html><body>Reference material</body></html>'})\n];"
      );
    },
    source,
  );
  const { result, pairing } = await compareReview(
    fixture.after,
    fixture.config,
    fixture.git,
    "main",
  );
  assert.deepEqual(pairing?.moves ?? [], []);
  assert.deepEqual(result.screens, []);
  assert.ok(!result.changes.some((change) => change.before?.path === "home"));
  const changes = await computeCatalogueChanges(
    fixture.config,
    "main",
    fixture.git,
    fixture.after.manifest,
  );
  assert.deepEqual(changes.removedEntries, []);
  assert.deepEqual(changes.changedEntries, ["home"]);
});
