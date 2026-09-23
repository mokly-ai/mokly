import assert from "node:assert/strict";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { prepareReviewRepository } from "../dist/review/prepare.js";

import { derivedFixture } from "./helpers/derived_fixture.js";

test("each pinned commit independently selects rebuilt or committed output", async (context) => {
  const fixture = await derivedFixture(context);
  const untracked = await prepareReviewRepository(fixture.config, "HEAD");
  assert.equal(untracked.selection, "rebuild");
  assert.equal(untracked.commit, fixture.commit);

  await writeCompilation(
    await compileCatalogue(fixture.config),
    fixture.config,
  );
  await fixture.git("add", "-f", "mockups");
  await fixture.git("commit", "-qm", "test: track generated output");
  const tracked = await prepareReviewRepository(fixture.config, "HEAD");
  assert.equal(tracked.selection, "blobs");
  assert.notEqual(tracked.commit, fixture.commit);

  await fixture.git("rm", "-qr", "--cached", "mockups");
  await fixture.git("commit", "-qm", "test: stop tracking generated output");
  const again = await prepareReviewRepository(fixture.config, "HEAD");
  assert.equal(again.selection, "rebuild");
  assert.notEqual(again.commit, tracked.commit);
  assert.equal(
    (
      await prepareReviewRepository(fixture.config, "HEAD", {
        commit: tracked.commit,
      })
    ).selection,
    "blobs",
  );
});
