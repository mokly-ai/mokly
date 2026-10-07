import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { exportCatalogue } from "../dist/export/run.js";
import { publishCatalogue } from "../dist/publish/run.js";
import { NodeGitCommandRunner } from "../dist/review/git.js";

import { createCommittedExampleBaseline } from "./helpers/example_baseline.js";
import { directoryFiles } from "./helpers/export_fixture.js";
import { startFakeReceiver } from "./helpers/fake_receiver.js";
import { repositoryRoot } from "./helpers/fixture.js";

test("the example export and reconstructed publication use portable path segments", async (t) => {
  const root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/namespace-example-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const config = await createCommittedExampleBaseline(root, "static-example");
  const entry = path.join(
    root,
    "examples/basic/specs/example/archived.mockup.ts",
  );
  await fs.writeFile(
    entry,
    `import { definePage, defineScreen } from "@mokly/mokly";
export const entries = [
  definePage({ path: "example/archived", title: "Archived", description: "Archived guide", dependencies: [], relatedDocs: [], render: () => "<html><body>Archived guide</body></html>" }),
  defineScreen({ path: "example/archived-screen", title: "Archived screen", description: "Previous screen", dependencies: [], relatedDocs: [], mobile: "Previous mobile", desktop: "Previous desktop" }),
];`,
  );
  await writeCompilation(await compileCatalogue(config), config);
  const git = new NodeGitCommandRunner(root);
  await git.run(["add", "-A"]);
  await git.run(["add", "-f", "examples/basic/mokly-generated"]);
  await git.run([
    "-c",
    "core.hooksPath=/dev/null",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "-qm",
    "test: record archived namespace fixture",
  ]);
  await fs.rm(entry);
  await writeCompilation(await compileCatalogue(config), config);
  await git.run(["add", "-A"]);
  await git.run(["add", "-f", "examples/basic/mokly-generated"]);
  await git.run([
    "-c",
    "core.hooksPath=/dev/null",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "-qm",
    "test: commit removed namespace entries",
  ]);
  const receiver = await startFakeReceiver(t);
  await publishCatalogue(
    config,
    {
      out: path.join(root, "site"),
      base: "HEAD^",
      endpoint: receiver.endpoint,
      token: "fixture-token",
      repository: "github.com/sample/catalogue",
    },
    "1.2.3",
    {},
    {
      git: new NodeGitCommandRunner(root),
      export: exportCatalogue,
      fetch,
      now: () => new Date(),
      random: () => 0,
      sleep: async () => undefined,
    },
  );
  const exported = await directoryFiles(path.join(root, "site"));
  const plan = receiver.plans[0]!;
  const reconstructed = new Map(plan.files);
  for (const entry of plan.ownership.files) {
    const bytes =
      plan.files.get(entry.path) ?? receiver.blobs.get(entry.sha256);
    assert.ok(bytes, entry.path);
    reconstructed.set(entry.path, bytes);
  }
  assert.deepEqual(reconstructed, exported);
  for (const files of [exported, reconstructed]) {
    const paths = [...files.keys()];
    assert.deepEqual(
      paths.filter((name) =>
        name.split("/").some((segment) => /^[._#~]/u.test(segment)),
      ),
      [".mokly-export-artifact"],
    );
    assert.ok(paths.includes("mokly-viewer/catalogue.json"));
    assert.ok(
      paths.some((name) =>
        /mokly-viewer\/diffs\/generations\/[a-f0-9]{64}\/previews\/example\/archived\/index\.json$/u.test(
          name,
        ),
      ),
    );
    assert.ok(
      paths.some((name) =>
        name.includes(
          "snapshots/before/mokly-generated/example/archived-screen/index.",
        ),
      ),
    );
    assert.ok(paths.some((name) => name.includes("mokly-generated/styles/")));
    assert.ok(
      paths.some((name) =>
        name.endsWith(
          "assets/examples/imported-assets/workspace-note-signal.png",
        ),
      ),
    );
  }
  assert.equal(receiver.publications.size, 1);
});
