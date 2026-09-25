import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import {
  NodeGitCommandRunner,
  CommittedRepository,
} from "../dist/review/git.js";
import { runReview } from "../dist/review/run.js";
import { writeReviewArtifact } from "../dist/review/write.js";

import {
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";
import { git } from "./helpers/review_fixtures.js";

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
