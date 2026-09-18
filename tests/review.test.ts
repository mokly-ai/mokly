import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { compileCatalogue } from "../dist/build/compile.js";
import type { Compilation } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { renderReviewArtifact } from "../dist/review/artifact.js";
import { compareReview } from "../dist/review/compare.js";
import {
  NodeGitCommandRunner,
  CommittedRepository,
} from "../dist/review/git.js";
import {
  normalizeReviewPair,
  normalizeSingleDocument,
} from "../dist/review/ignore.js";
import type { ReadOnlyReviewRepository } from "../dist/review/repository.js";
import { runReview } from "../dist/review/run.js";
import { writeReviewArtifact } from "../dist/review/write.js";
import type {
  ManifestScreen,
  ManifestV5,
} from "../packages/viewer/dist/registry/types.js";
import type { ReviewResult } from "../packages/viewer/dist/review/types.js";

import {
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";

const execFileAsync = promisify(execFile);

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
      compilation.outputs.get("screens/details.mobile.html") ?? "",
    ],
    [
      "mockups/screens/details.desktop.html",
      compilation.outputs.get("screens/details.desktop.html") ?? "",
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

test("dark views compare and classify against a pre-dark base", async (context) => {
  const fixture = await createFixture(undefined, {
    extraConfig: 'colorSchemes: ["light", "dark"],',
  });
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const rawCompilation = await compileCatalogue(config);
  const compilation = withHomeIgnoredRegions(rawCompilation, "after");
  const baseCompilation = withHomeIgnoredRegions(rawCompilation, "before");
  const baseManifest = withoutDarkFragments(baseCompilation.manifest);

  const artifact = await compareReview(
    compilation,
    config,
    fakeGit(filesForCompilation(baseManifest, baseCompilation)),
    "HEAD",
  );

  const home = artifact.result.screens.find((screen) => screen.id === "home");
  assert.ok(home);
  assert.deepEqual(
    home.views.map(({ colorScheme, state, viewport }) => ({
      colorScheme,
      state,
      viewport,
    })),
    [
      { colorScheme: "light", state: "ignored-only", viewport: "mobile" },
      { colorScheme: "dark", state: "added", viewport: "mobile" },
      { colorScheme: "light", state: "ignored-only", viewport: "desktop" },
      { colorScheme: "dark", state: "added", viewport: "desktop" },
    ],
  );
  const reviewJson = JSON.parse(
    renderReviewArtifact(artifact).get("review.json") as string,
  ) as ReviewResult;
  assert.equal(reviewJson.schemaVersion, 2);
  const jsonHome = reviewJson.screens.find((screen) => screen.id === "home");
  assert.ok(jsonHome);
  assert.deepEqual(
    jsonHome.views.map(
      ({
        afterPath,
        beforePath,
        colorScheme,
        ignoredIds,
        state,
        viewport,
      }) => ({
        after: Boolean(afterPath),
        before: Boolean(beforePath),
        colorScheme,
        ignoredIds,
        state,
        viewport,
      }),
    ),
    [
      {
        after: true,
        before: true,
        colorScheme: "light",
        ignoredIds: ["nav"],
        state: "ignored-only",
        viewport: "mobile",
      },
      {
        after: true,
        before: false,
        colorScheme: "dark",
        ignoredIds: [],
        state: "added",
        viewport: "mobile",
      },
      {
        after: true,
        before: true,
        colorScheme: "light",
        ignoredIds: ["nav"],
        state: "ignored-only",
        viewport: "desktop",
      },
      {
        after: true,
        before: false,
        colorScheme: "dark",
        ignoredIds: [],
        state: "added",
        viewport: "desktop",
      },
    ],
  );
  assert.deepEqual(reviewJson.ignoredImpact, [
    { colorScheme: "light", count: 1, id: "nav", viewport: "mobile" },
    { colorScheme: "light", count: 1, id: "nav", viewport: "desktop" },
  ]);
});

test("removing dark classifies dark views removed", async (context) => {
  const fixture = await createFixture(undefined, {
    extraConfig: 'colorSchemes: ["light", "dark"],',
  });
  context.after(() => removeFixture(fixture));
  const darkConfig = await loadConfig(fixture.root);
  const darkCompilation = await compileCatalogue(darkConfig);
  await fs.promises.writeFile(
    fixture.configPath,
    `import { defineConfig } from "@mokly/mokly";
export default defineConfig({
  entriesDir: "entries",
  mockupsDir: "mockups",
  repoRoot: ".",
  review: { outDir: ".review", sharedImpact: ["notes.md"] }
});
`,
  );
  const lightConfig = await loadConfig(fixture.root);
  const lightCompilation = await compileCatalogue(lightConfig);

  const artifact = await compareReview(
    lightCompilation,
    lightConfig,
    fakeGit(filesForCompilation(darkCompilation.manifest, darkCompilation)),
    "HEAD",
  );

  const home = artifact.result.screens.find((screen) => screen.id === "home");
  assert.ok(home);
  assert.deepEqual(
    home.views.map(({ colorScheme, state, viewport }) => ({
      colorScheme,
      state,
      viewport,
    })),
    [
      { colorScheme: "light", state: "unchanged", viewport: "mobile" },
      { colorScheme: "dark", state: "removed", viewport: "mobile" },
      { colorScheme: "light", state: "unchanged", viewport: "desktop" },
      { colorScheme: "dark", state: "removed", viewport: "desktop" },
    ],
  );
});

test("ignoredImpact sorts by viewport then scheme then id", async (context) => {
  const fixture = await createFixture(undefined, {
    extraConfig: 'colorSchemes: ["light", "dark"],',
  });
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  const baseCompilation = withHomeIgnoredRegions(compilation, "before", [
    "z-nav",
    "a-nav",
  ]);
  const headCompilation = withHomeIgnoredRegions(compilation, "after", [
    "z-nav",
    "a-nav",
  ]);

  const artifact = await compareReview(
    headCompilation,
    config,
    fakeGit(filesForCompilation(baseCompilation.manifest, baseCompilation)),
    "HEAD",
  );

  assert.deepEqual(artifact.result.ignoredImpact, [
    { colorScheme: "light", count: 1, id: "a-nav", viewport: "mobile" },
    { colorScheme: "light", count: 1, id: "z-nav", viewport: "mobile" },
    { colorScheme: "dark", count: 1, id: "a-nav", viewport: "mobile" },
    { colorScheme: "dark", count: 1, id: "z-nav", viewport: "mobile" },
    { colorScheme: "light", count: 1, id: "a-nav", viewport: "desktop" },
    { colorScheme: "light", count: 1, id: "z-nav", viewport: "desktop" },
    { colorScheme: "dark", count: 1, id: "a-nav", viewport: "desktop" },
    { colorScheme: "dark", count: 1, id: "z-nav", viewport: "desktop" },
  ]);
});

test("Review compares Git base without checkout and writes deterministic artifacts", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  await git(fixture.root, ["init", "-q"]);
  await git(fixture.root, ["config", "user.name", "Mokly Test"]);
  await git(fixture.root, ["config", "user.email", "mokly@example.invalid"]);
  await git(fixture.root, ["add", "."]);
  await git(fixture.root, ["commit", "-qm", "test: base catalogue"]);

  await fs.promises.writeFile(
    fixture.entryPath,
    validEntrySource({ firstTitle: "Updated Home" }),
  );
  await fs.promises.writeFile(
    path.join(fixture.root, "notes.md"),
    "# Updated fixture notes\n",
  );
  await writeCompilation(await compileCatalogue(config), config);
  const result = await runReview(
    config,
    "HEAD",
    config.review.outDir,
    new CommittedRepository(new NodeGitCommandRunner(fixture.root)),
  );
  assert.equal(
    result.screens.find((screen) => screen.route === "screens/home.html")
      ?.state,
    "changed",
  );
  assert.deepEqual(result.sharedImpact, ["notes.md"]);
  assert.ok(
    result.screens.every((screen) => screen.sharedImpact.includes("notes.md")),
  );
  const reviewJson = JSON.parse(
    await fs.promises.readFile(
      path.join(config.review.outDir, "review.json"),
      "utf8",
    ),
  ) as { baseCommit: string; schemaVersion: number };
  assert.equal(reviewJson.schemaVersion, 2);
  assert.match(reviewJson.baseCommit, /^[a-f0-9]{40}$/);
  assert.equal(
    fs.existsSync(path.join(config.review.outDir, "index.html")),
    false,
  );
  assert.equal(
    fs.existsSync(path.join(config.review.outDir, "summary.md")),
    true,
  );
});

test("Review reports descendants of directory dependencies", async (context) => {
  const fixture = await createFixture(
    validEntrySource().replace(
      'dependencies: ["notes.md"]',
      'dependencies: ["src/components"]',
    ),
  );
  context.after(() => removeFixture(fixture));
  const component = path.join(fixture.root, "src/components/Button.tsx");
  await fs.promises.mkdir(path.dirname(component), { recursive: true });
  await fs.promises.writeFile(component, "export const label = 'Before';\n");
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  await git(fixture.root, ["init", "-q"]);
  await git(fixture.root, ["config", "user.name", "Mokly Test"]);
  await git(fixture.root, ["config", "user.email", "mokly@example.invalid"]);
  await git(fixture.root, ["add", "."]);
  await git(fixture.root, ["commit", "-qm", "test: base directory dependency"]);
  await fs.promises.writeFile(component, "export const label = 'After';\n");

  const result = await runReview(
    config,
    "HEAD",
    config.review.outDir,
    new CommittedRepository(new NodeGitCommandRunner(fixture.root)),
  );

  assert.ok(
    result.screens.every((screen) =>
      screen.sharedImpact.includes("src/components/Button.tsx"),
    ),
  );
});

test("Review writer will not replace an unowned directory or repository root", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const out = path.join(fixture.root, "existing");
  await fs.promises.mkdir(out);
  await fs.promises.writeFile(path.join(out, "keep.txt"), "keep\n");
  await assert.rejects(
    () => writeReviewArtifact(new Map([["index.html", "safe"]]), out, config),
    /unowned Review directory/,
  );
  await assert.rejects(
    () =>
      writeReviewArtifact(
        new Map([["index.html", "safe"]]),
        fixture.root,
        config,
      ),
    /must not overlap/,
  );
});

async function git(cwd: string, arguments_: readonly string[]): Promise<void> {
  await execFileAsync("git", [...arguments_], { cwd });
}

function fakeGit(files: ReadonlyMap<string, string>): ReadOnlyReviewRepository {
  return {
    evidence: {
      changedPaths: async () => [],
      mergeBase: async () => "a".repeat(40),
    },
    reader: {
      fileExists: async (_commit, repoPath) => files.has(repoPath),
      fileKind: async (_commit, repoPath) =>
        files.has(repoPath) ? "regular" : "missing",
      readFile: async (_commit, repoPath) => {
        const content = files.get(repoPath);
        if (content === undefined)
          throw new Error(`missing fake Git path ${repoPath}`);
        return content;
      },
      readFileBytes: async (_commit, repoPath) => {
        const content = files.get(repoPath);
        if (content === undefined)
          throw new Error(`missing fake Git path ${repoPath}`);
        return Buffer.from(content);
      },
    },
  };
}

function filesForCompilation(
  manifest: ManifestV5,
  compilation: Compilation,
): Map<string, string> {
  const files = new Map<string, string>([
    ["mockups/mokly-manifest.json", `${JSON.stringify(manifest)}\n`],
  ]);
  for (const [route, content] of compilation.outputs) {
    if (route === "mokly-manifest.json") continue;
    files.set(`mockups/${route}`, content);
  }
  return files;
}

function withoutDarkFragments(manifest: ManifestV5): ManifestV5 {
  return {
    ...manifest,
    entries: manifest.entries.map((entry) => {
      if (entry.kind !== "screen") return entry;
      const { darkFragments: _darkFragments, ...screen } = entry;
      return screen;
    }),
  };
}

function withHomeIgnoredRegions(
  compilation: Compilation,
  label: string,
  ids: readonly string[] = ["nav"],
): Compilation {
  const home = compilation.manifest.entries.find(
    (entry) => entry.kind === "screen" && entry.id === "home",
  );
  if (home?.kind !== "screen") throw new Error("missing home screen");
  const outputs = new Map(compilation.outputs);
  for (const fragment of screenFragments(home)) {
    const content = outputs.get(fragment);
    if (content === undefined) throw new Error(`missing output ${fragment}`);
    outputs.set(fragment, insertIgnoredRegions(content, label, ids));
  }
  return { ...compilation, outputs };
}

function screenFragments(screen: ManifestScreen): string[] {
  return [
    ...Object.values(screen.fragments),
    ...Object.values(screen.darkFragments ?? {}),
  ];
}

function insertIgnoredRegions(
  content: string,
  label: string,
  ids: readonly string[],
): string {
  const regions = ids
    .map(
      (id) =>
        `<!--mokly-review-ignore:start:${id}-->` +
        `<span>${label}-${id}</span>` +
        `<!--mokly-review-ignore:end:${id}-->`,
    )
    .join("");
  if (!content.includes("</main>")) throw new Error("missing main close tag");
  return content.replace("</main>", `${regions}</main>`);
}
