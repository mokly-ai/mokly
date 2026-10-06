import assert from "node:assert/strict";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { compareReview } from "../dist/review/compare.js";
import { CommittedRepository } from "../dist/review/git.js";
import {
  normalizeReviewPair,
  normalizeSingleDocument,
} from "../dist/review/ignore.js";

import { entryAt } from "./helpers/catalogue_selection.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";
import { textOutput } from "./helpers/generated_text.js";

test("Review ignore normalizes paired regions and retains malformed content", () => {
  const base =
    "<main><!--mokly-review-ignore:start:nav--><nav>A</nav><!--mokly-review-ignore:end:nav--><p>Body</p></main>";
  const head =
    "<main><!--mokly-review-ignore:start:nav--><nav>B</nav><!--mokly-review-ignore:end:nav--><p>Body</p></main>";
  const pair = normalizeReviewPair(base, head, "screen.mobile.html");
  assert.equal(pair.base, pair.head);
  assert.deepEqual(pair.ignoredIds, ["nav"]);
  assert.equal(
    normalizeSingleDocument(base, "screen.mobile.html").includes(
      "<nav>A</nav>",
    ),
    true,
  );
  assert.throws(
    () =>
      normalizeReviewPair(
        base,
        head.replace("end:nav", "end:other"),
        "screen.mobile.html",
      ),
    /does not match/,
  );
});

test("Git failures keep typed operation context", async () => {
  const git = new CommittedRepository({
    run: async () => {
      throw new Error("not a repository");
    },
  });
  await assert.rejects(
    () => git.evidence.mergeBase("origin/main", "HEAD"),
    /find merge base of origin\/main and HEAD.*not a repository/,
  );
});

test("Review classifies added, removed, and unchanged routes independently", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  const detail = entryAt(compilation.manifest, "details", "screen");
  const home = entryAt(compilation.manifest, "home", "screen");
  const old = {
    ...home,
    path: "old-screen",
    title: "Old screen",
    useCasePaths: [],
  };
  const baseManifest = {
    ...compilation.manifest,
    entries: [{ ...detail, useCasePaths: [] }, old],
  };
  const gitFiles = new Map<string, string>([
    ["mockups/mokly-manifest.json", `${JSON.stringify(baseManifest)}\n`],
    [
      "mockups/details/index.mobile.html",
      textOutput(compilation.outputs, "details/index.mobile.html") ?? "",
    ],
    [
      "mockups/details/index.desktop.html",
      textOutput(compilation.outputs, "details/index.desktop.html") ?? "",
    ],
    [
      "mockups/old-screen/index.mobile.html",
      "<html><body>Old mobile</body></html>",
    ],
    [
      "mockups/old-screen/index.desktop.html",
      "<html><body>Old desktop</body></html>",
    ],
  ]);
  const artifact = await compareReview(
    compilation,
    config,
    {
      evidence: {
        changedPaths: async () => [],
        mergeBase: async () => "a".repeat(40),
      },
      reader: {
        fileExists: async (_commit, repoPath) => gitFiles.has(repoPath),
        fileKind: async (_commit, repoPath) =>
          gitFiles.has(repoPath) ? "regular" : "missing",
        readFile: async (_commit, repoPath) => {
          const content = gitFiles.get(repoPath);
          if (content === undefined)
            throw new Error(`missing fake Git path ${repoPath}`);
          return content;
        },
        readFileBytes: async (_commit, repoPath) => {
          const content = gitFiles.get(repoPath);
          if (content === undefined)
            throw new Error(`missing fake Git path ${repoPath}`);
          return Buffer.from(content);
        },
      },
    },
    "HEAD",
  );
  assert.equal(
    artifact.result.screens.find((screen) => screen.path === "home")?.state,
    "added",
  );
  assert.equal(
    artifact.result.screens.find((screen) => screen.path === "old-screen")
      ?.state,
    "removed",
  );
  assert.equal(
    artifact.result.screens.find((screen) => screen.path === "details")?.state,
    "unchanged",
  );
});
