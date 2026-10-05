import assert from "node:assert/strict";
import test from "node:test";

import { parseReviewResult } from "@mokly/viewer/data";

import { compareReview } from "../dist/review/compare.js";

import { moveReviewFixture as componentReviewFixture } from "./helpers/move_review_fixture.js";

const source = `import { defineScreen } from '@mokly/mokly';
export default defineScreen({
  path: 'old/welcome', title: 'Welcome', description: 'Start here',
  dependencies: [], relatedDocs: [], mobile: <h1>Welcome</h1>, desktop: <h1>Welcome</h1>,
  variants: [{slug:'returning',title:'Returning',description:'Continue your work',mobile:<h1>Continue</h1>,desktop:<h1>Continue</h1>}]
});`;

for (const edited of [false, true])
  test(`moved screen and its variant compare against their original paths: edited=${edited}`, async (t) => {
    const fixture = await componentReviewFixture(
      t,
      (text) => {
        const moved = text.replace(
          "path: 'old/welcome'",
          "path: 'new/welcome'",
        );
        return edited
          ? moved.replaceAll("<h1>Welcome</h1>", "<h1>Welcome back</h1>")
          : moved;
      },
      source,
    );
    const artifact = await compareReview(
      fixture.after,
      fixture.config,
      fixture.git,
      "main",
    );
    const result = parseReviewResult(artifact.result);
    assert.equal(result.screens.length, 2);
    assert.deepEqual(
      result.screens.map((entry) => [
        entry.path,
        entry.previousPath,
        entry.state,
      ]),
      [
        ["new/welcome", "old/welcome", edited ? "changed" : "unchanged"],
        ["new/welcome/returning", "old/welcome/returning", "unchanged"],
      ],
    );
    assert.equal(result.changes.length, 2);
    assert.deepEqual(result.changes[1]!.reasons, []);
    for (const entry of result.changes) {
      assert.equal(entry.previousPath, entry.before?.path);
      assert.ok(entry.after);
      assert.ok(
        !entry.reasons.some(
          (reason) => reason.kind === "added" || reason.kind === "removed",
        ),
      );
    }
    if (!edited) assert.deepEqual(result.changes[0]!.reasons, []);
    assert.ok(
      artifact.files.has("snapshots/before/old/welcome/index.mobile.html"),
    );
    assert.ok(
      artifact.files.has("snapshots/after/new/welcome/index.mobile.html"),
    );
    assert.ok(
      !artifact.files.has("snapshots/before/new/welcome/index.mobile.html"),
    );
  });

test("a moved screen variant retains its parent's title as reviewable metadata", async (t) => {
  const before =
    source.replace("{ defineScreen }", "{ defineScreen, defineComponent }") +
    `
    export const control = defineComponent({path:'control',title:'Control',description:'A control',dependencies:[],relatedDocs:[],propSchema:{kind:'object',properties:{}},render:()=> 'Control',variants:[{slug:'default',title:'Default',props:{}}]});`;
  const fixture = await componentReviewFixture(
    t,
    (text) =>
      text
        .replace(
          "path: 'old/welcome'",
          "path: 'new/welcome', movedFrom: 'old/welcome'",
        )
        .replace("title: 'Welcome'", "title: 'New welcome'"),
    before,
  );
  const { result } = await compareReview(
    fixture.after,
    fixture.config,
    fixture.git,
    "main",
  );
  const variant = result.changes.find(
    (entry) => entry.after?.path === "new/welcome/returning",
  )!;
  assert.equal(variant.previousPath, "old/welcome/returning");
  assert.deepEqual(variant.reasons, [{ kind: "metadata" }]);
});
