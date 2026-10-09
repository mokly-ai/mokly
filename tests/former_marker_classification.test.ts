import assert from "node:assert/strict";
import test from "node:test";

import { acceptedGenerationFromCompilation } from "../dist/review/accepted_generation.js";
import { compareReview } from "../dist/review/compare.js";
import { readCatalogueChanges } from "../dist/server/component_changes.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { componentReviewFixture } from "./helpers/component_review_fixture.js";
import { formerMarkers } from "./helpers/former_marker_fixture.js";

for (const [name, literal] of formerMarkers)
  test(`unchanged catalogue script with former ${name} spelling has no Changes`, async (context) => {
    const script = `const sample = ${JSON.stringify(literal)};`;
    const source = componentEntrySource({
      body: `<script dangerouslySetInnerHTML={{__html:${JSON.stringify(script)}}} /><action.Component label="Use" />`,
      extra: 'import { defineUseCase } from "@mokly/mokly";',
      exports:
        '...action.entries, ...pane.entries, defineUseCase({path:"flow",title:"Flow",description:"Flow",relatedDocs:[],steps:[{screenPath:"home"}]}),',
    }).replace('path: "home",', 'path: "home", useCasePaths: ["flow"],');
    const fixture = await componentReviewFixture(
      context,
      (input) => input,
      source,
    );
    assert.deepEqual([...fixture.before.outputs], [...fixture.after.outputs]);
    const complete = await compareReview(
      fixture.after,
      fixture.config,
      fixture.git,
      "main",
      undefined,
      undefined,
      [],
      { useFastPath: false },
    );
    const fast = await compareReview(
      fixture.after,
      fixture.config,
      fixture.git,
      "main",
    );
    assert.deepEqual(fast.result, complete.result);
    assert.deepEqual(complete.result.changes, []);
    assert.ok(
      complete.result.screens.every((screen) => screen.state === "unchanged"),
    );
    assert.ok(
      complete.result.components.every(
        (component) => component.state === "unchanged",
      ),
    );
    assert.ok(
      fixture.after.manifest.entries.some((entry) => entry.path === "flow"),
    );
    const browse = await readCatalogueChanges(
      fixture.config,
      fixture.after.manifest,
      "main",
      fixture.git,
      "a".repeat(40),
      acceptedGenerationFromCompilation(fixture.after),
    );
    assert.deepEqual(browse.changedEntries, []);
    assert.deepEqual(browse.result, complete.result);
  });
