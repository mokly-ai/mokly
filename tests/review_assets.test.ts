import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { copySnapshotDependencies } from "../dist/review/assets.js";
import {
  NodeGitCommandRunner,
  CommittedRepository,
} from "../dist/review/git.js";
import { runReview } from "../dist/review/run.js";

import {
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";

const execFileAsync = promisify(execFile);

test("Review rejects non-portable base resource URLs", async () => {
  for (const reference of [
    "/styles.css",
    "//cdn.example.invalid/styles.css",
    "file:///tmp/styles.css",
  ]) {
    const route = "screens/home.mobile.html";
    const files = new Map([
      [
        `snapshots/before/${route}`,
        `<html><head><link rel="stylesheet" href="${reference}"></head></html>`,
      ],
    ]);

    await assert.rejects(
      () =>
        copySnapshotDependencies(
          files,
          "before",
          new Set([route]),
          async () => "",
        ),
      /non-portable asset URL/,
      reference,
    );
  }
});

test("Review copies local stylesheet dependencies for both snapshots", async (context) => {
  const fixture = await createFixture(
    validEntrySource({
      body: '<img alt="Inline" srcSet="data:image/png;base64,AA== 1x" />',
    }),
  );
  context.after(() => removeFixture(fixture));
  const stylesheet = path.join(fixture.mockupsDir, "styles.css");
  const image = path.join(fixture.mockupsDir, "pixel.png");
  await fs.promises.writeFile(
    stylesheet,
    'body { background: url("./pixel.png"); }\n',
  );
  await fs.promises.writeFile(image, Uint8Array.from([0, 1, 2, 255]));
  await fs.promises.writeFile(
    fixture.configPath,
    `import { defineConfig } from "@mokly/mokly";
export default defineConfig({
  entriesDir: "entries",
  mockupsDir: "mockups",
  repoRoot: ".",
  review: { outDir: ".review" },
  stylesheets: [{ match: "**/*.html", stylesheets: ["styles.css"] }]
});
`,
  );
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  await git(fixture.root, ["init", "-q"]);
  await git(fixture.root, ["config", "user.name", "Mokly Test"]);
  await git(fixture.root, ["config", "user.email", "mokly@example.invalid"]);
  await git(fixture.root, ["add", "."]);
  await git(fixture.root, ["commit", "-qm", "test: base"]);
  await fs.promises.writeFile(
    fixture.entryPath,
    validEntrySource({ firstTitle: "Changed" }),
  );
  await writeCompilation(await compileCatalogue(config), config);

  await runReview(
    config,
    "HEAD",
    config.review.outDir,
    new CommittedRepository(new NodeGitCommandRunner(fixture.root)),
  );

  for (const side of ["before", "after"]) {
    assert.equal(
      await fs.promises.readFile(
        path.join(config.review.outDir, "snapshots", side, "styles.css"),
        "utf8",
      ),
      'body { background: url("./pixel.png"); }\n',
    );
    assert.deepEqual(
      await fs.promises.readFile(
        path.join(config.review.outDir, "snapshots", side, "pixel.png"),
      ),
      Buffer.from([0, 1, 2, 255]),
    );
  }
});

test("Review rejects base dependencies beneath authored source roots", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const nestedEntries = path.join(fixture.mockupsDir, "src/entries");
  const nestedEntry = path.join(nestedEntries, "fixture.mockup.tsx");
  await fs.promises.mkdir(nestedEntries, { recursive: true });
  await fs.promises.rename(fixture.entryPath, nestedEntry);
  await fs.promises.writeFile(
    fixture.configPath,
    `import { defineConfig } from "@mokly/mokly";
export default defineConfig({
  entriesDir: "mockups/src/entries",
  mockupsDir: "mockups",
  repoRoot: ".",
  review: { outDir: ".review" }
});
`,
  );
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  const baseFragment = path.join(
    fixture.mockupsDir,
    "screens/home.mobile.html",
  );
  await fs.promises.writeFile(
    baseFragment,
    (await fs.promises.readFile(baseFragment, "utf8")).replace(
      "</body>",
      '<script src="../src/entries/fixture.mockup.tsx"></script></body>',
    ),
  );
  await git(fixture.root, ["init", "-q"]);
  await git(fixture.root, ["config", "user.name", "Mokly Test"]);
  await git(fixture.root, ["config", "user.email", "mokly@example.invalid"]);
  await git(fixture.root, ["add", "."]);
  await git(fixture.root, ["commit", "-qm", "test: base source reference"]);
  await fs.promises.writeFile(
    nestedEntry,
    validEntrySource({ firstTitle: "Changed" }),
  );
  await writeCompilation(await compileCatalogue(config), config);

  await assert.rejects(
    () =>
      runReview(
        config,
        "HEAD",
        config.review.outDir,
        new CommittedRepository(new NodeGitCommandRunner(fixture.root)),
      ),
    /not a public static file/,
  );
});

test("Review rejects non-regular base dependency blobs", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  const baseFragment = path.join(
    fixture.mockupsDir,
    "screens/home.mobile.html",
  );
  await fs.promises.symlink(
    "../notes.md",
    path.join(fixture.mockupsDir, "linked.css"),
  );
  await fs.promises.writeFile(
    baseFragment,
    (await fs.promises.readFile(baseFragment, "utf8")).replace(
      "</head>",
      '<link rel="stylesheet" href="../linked.css" /></head>',
    ),
  );
  await git(fixture.root, ["init", "-q"]);
  await git(fixture.root, ["config", "user.name", "Mokly Test"]);
  await git(fixture.root, ["config", "user.email", "mokly@example.invalid"]);
  await git(fixture.root, ["add", "."]);
  await git(fixture.root, ["commit", "-qm", "test: base symlink reference"]);
  await fs.promises.writeFile(
    fixture.entryPath,
    validEntrySource({ firstTitle: "Changed" }),
  );
  await writeCompilation(await compileCatalogue(config), config);

  await assert.rejects(
    () =>
      runReview(
        config,
        "HEAD",
        config.review.outDir,
        new CommittedRepository(new NodeGitCommandRunner(fixture.root)),
      ),
    /not a regular Git file/,
  );
});

test("Review rejects a base pane stored as a Git symlink", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  const fragment = path.join(fixture.mockupsDir, "screens/home.mobile.html");
  await fs.promises.rm(fragment);
  await fs.promises.symlink("../../notes.md", fragment);
  await git(fixture.root, ["init", "-q"]);
  await git(fixture.root, ["config", "user.name", "Mokly Test"]);
  await git(fixture.root, ["config", "user.email", "mokly@example.invalid"]);
  await git(fixture.root, ["add", "."]);
  await git(fixture.root, ["commit", "-qm", "test: symlink pane"]);
  await fs.promises.rm(fragment);
  await fs.promises.writeFile(
    fixture.entryPath,
    validEntrySource({ firstTitle: "Changed" }),
  );
  await writeCompilation(await compileCatalogue(config), config);

  await assert.rejects(
    () =>
      runReview(
        config,
        "HEAD",
        config.review.outDir,
        new CommittedRepository(new NodeGitCommandRunner(fixture.root)),
      ),
    /not a regular Git file/,
  );
});

async function git(cwd: string, arguments_: readonly string[]): Promise<void> {
  await execFileAsync("git", [...arguments_], { cwd });
}
