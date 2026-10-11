import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  generatedBytes,
  transferGeneratedFile,
} from "../dist/build/generated_file.js";
import { compareReview } from "../dist/review/compare.js";
import { RepositorySelectedReview } from "../dist/review/selected.js";
import { selectedComparisonViews } from "../packages/viewer/src/shell/comparison_selection.js";

import { movedCatalogueFixture } from "./helpers/move_catalogue.js";
import { moveReviewFixture as componentReviewFixture } from "./helpers/move_review_fixture.js";

async function capture(
  fixture: Pick<
    Awaited<ReturnType<typeof componentReviewFixture>>,
    "before" | "after" | "config" | "git"
  >,
  path: string,
) {
  const artifact = await compareReview(
    fixture.after,
    fixture.config,
    fixture.git,
    "main",
  );
  const selected = await new RepositorySelectedReview(
    fixture.config,
    fixture.git.reader,
  ).generate(
    {
      before: fixture.before.manifest,
      after: fixture.after.manifest,
      result: artifact.result,
      baseCommit: artifact.result.baseCommit,
      baseRef: "main",
      changedPaths: [],
      headOutputs: [...fixture.after.outputs].map(
        ([route, value]) => [route, transferGeneratedFile(value)] as const,
      ),
      headDigests: Object.fromEntries(
        [...fixture.after.outputs].map(([route, bytes]) => [
          `mokly-generated/${route}`,
          createHash("sha256").update(generatedBytes(bytes)).digest("hex"),
        ]),
      ),
    },
    { path },
    new AbortController().signal,
  );
  const views = selectedComparisonViews(
    {
      result: selected.result,
      url: "https://catalogue.test/mokly-viewer/diffs/generations/selected-one/review.json",
    },
    {
      mode: "side",
      viewport: "both",
      colorScheme: "dark",
      requestedColorScheme: "dark",
    },
    "screen",
    path,
  );
  return { selected, views };
}

test("selected moved-screen capture and viewer addresses use the original before path", async (t) => {
  const fixture = await movedCatalogueFixture(t);
  const { selected, views } = await capture(fixture, "new/screen/detail");
  assert.equal(selected.result.screens.length, 1);
  assert.equal(selected.result.screens[0]!.previousPath, "old/screen/detail");
  for (const viewport of ["mobile", "desktop"])
    for (const suffix of ["", ".dark"]) {
      const before = `old/screen/detail/index.${viewport}${suffix}.html`;
      const after = `new/screen/detail/index.${viewport}${suffix}.html`;
      assert.deepEqual(
        Buffer.from(
          selected.files.get(`snapshots/before/mokly-generated/${before}`) ??
            [],
        ),
        Buffer.from(generatedBytes(fixture.before.outputs.get(before)!)),
      );
      assert.ok(selected.files.has(`snapshots/after/mokly-generated/${after}`));
    }
  assert.equal(
    views?.[0]?.documents.before,
    "https://catalogue.test/mokly-viewer/diffs/generations/selected-one/snapshots/before/mokly-generated/old/screen/detail/index.mobile.dark.html",
  );
  assert.equal(
    views?.[0]?.documents.after,
    "https://catalogue.test/mokly-viewer/diffs/generations/selected-one/snapshots/after/mokly-generated/new/screen/detail/index.mobile.dark.html",
  );
  assert.ok(
    ![...selected.files.keys()].some((route) => route.includes("guide")),
  );
});

test("case-only selected capture retains exact before spelling without previousPath", async (t) => {
  const source =
    "import {defineScreen} from '@mokly/mokly'; export default defineScreen({path:'Welcome',title:'Welcome',description:'Start',relatedDocs:[],mobile:'Mobile',desktop:'Desktop'});";
  const fixture = await componentReviewFixture(
    t,
    (text) => text.replace("path:'Welcome'", "path:'welcome'"),
    source,
  );
  const { selected, views } = await capture(fixture, "welcome");
  assert.equal(selected.result.screens[0]!.previousPath, undefined);
  assert.ok(
    selected.files.has(
      "snapshots/before/mokly-generated/Welcome/index.mobile.html",
    ),
  );
  assert.match(
    views?.[0]?.documents.before ?? "",
    /\/before\/mokly-generated\/Welcome\/index.mobile.dark.html$/,
  );
});
