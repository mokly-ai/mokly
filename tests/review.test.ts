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
  const detail = compilation.manifest.entries.find(
    (entry) => entry.kind === "screen" && entry.id === "details",
  );
  const home = compilation.manifest.entries.find(
    (entry) => entry.kind === "screen" && entry.id === "home",
  );
  assert.ok(detail?.kind === "screen" && home?.kind === "screen");
  const old = {
    ...home,
    fragments: {
      desktop: "screens/old.desktop.html",
      mobile: "screens/old.mobile.html",
    },
    id: "old-screen",
    route: "screens/old.html",
    title: "Old screen",
    useCaseIds: [],
  };
  const baseManifest = {
    entries: [{ ...detail, useCaseIds: [] }, old],
    generatedBy: "mokly" as const,
    sourceFiles: compilation.manifest.sourceFiles,
    schemaVersion: 5 as const,
  };
  const gitFiles = new Map<string, string>([
    ["mockups/mokly-manifest.json", `${JSON.stringify(baseManifest)}\n`],
    [
      "mockups/screens/details.mobile.html",
      textOutput(compilation.outputs, "screens/details.mobile.html") ?? "",
    ],
    [
      "mockups/screens/details.desktop.html",
      textOutput(compilation.outputs, "screens/details.desktop.html") ?? "",
    ],
    ["mockups/screens/old.mobile.html", "<html><body>Old mobile</body></html>"],
    [
      "mockups/screens/old.desktop.html",
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
    artifact.result.screens.find((screen) => screen.id === "home")?.state,
    "added",
  );
  assert.equal(
    artifact.result.screens.find((screen) => screen.id === "old-screen")?.state,
    "removed",
  );
  assert.equal(
    artifact.result.screens.find((screen) => screen.id === "details")?.state,
    "unchanged",
  );
});
