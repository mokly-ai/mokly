import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { NodeGitCommandRunner } from "../dist/review/git.js";
import { prepareReviewRepository } from "../dist/review/prepare.js";

import { derivedFixture } from "./helpers/derived_fixture.js";

for (const variant of ["complete", "missing", "stale", "extra"] as const) {
  test(`committed v6 inventory selects ${variant} output with one tree read`, async (context) => {
    const fixture = await derivedFixture(context);
    await writeCompilation(
      await compileCatalogue(fixture.config),
      fixture.config,
    );
    const route = [...fixture.baseline.outputs.keys()].find((name) =>
      name.endsWith(".html"),
    );
    assert.ok(route);
    const document = path.join(fixture.config.generatedDir, route);
    if (variant === "missing") await fs.rm(document);
    if (variant === "stale") await fs.appendFile(document, "stale bytes");
    if (variant === "extra")
      await fs.writeFile(
        path.join(fixture.config.generatedDir, "extra.html"),
        "unexpected",
      );
    await fixture.git("add", "-f", "mockups/.generated");
    await fixture.git("commit", "-qm", `test: ${variant} generated output`);

    const runner = new NodeGitCommandRunner(fixture.root);
    let treeReads = 0;
    const diagnostics: string[] = [];
    const selected = await prepareReviewRepository(fixture.config, "HEAD", {
      runner: {
        run(args: readonly string[]) {
          if (args[0] === "ls-tree") treeReads++;
          return runner.run(args);
        },
      },
      diagnostic: (message) => diagnostics.push(message),
    });
    assert.equal(treeReads, 1);
    assert.equal(selected.descriptor.layout, "generated-v6");
    assert.equal(selected.descriptor.generatedRoot, "mockups/.generated");
    assert.equal(
      selected.selection,
      variant === "complete" ? "blobs" : "rebuild",
    );
    if (variant === "complete") assert.deepEqual(diagnostics, []);
    else {
      const reason =
        variant === "stale"
          ? "has mismatched blob hashes"
          : variant === "missing"
            ? "is missing"
            : "has extra files";
      assert.deepEqual(diagnostics, [
        `Mokly baseline ${selected.commit}: rebuilding because generated output ${reason}: ${variant === "extra" ? "extra.html" : route}.`,
      ]);
      assert.equal(
        await selected.reader.readFile(
          selected.commit,
          `mockups/.generated/${route}`,
        ),
        fixture.baseline.outputs.get(route),
      );
    }
  });
}

test("a malformed committed manifest fails rather than triggering a rebuild", async (context) => {
  const fixture = await derivedFixture(context);
  await writeCompilation(
    await compileCatalogue(fixture.config),
    fixture.config,
  );
  await fs.writeFile(
    path.join(fixture.config.generatedDir, "mokly-manifest.json"),
    "{",
  );
  await fixture.git("add", "-f", "mockups/.generated");
  await fixture.git("commit", "-qm", "test: malformed generated manifest");
  await assert.rejects(prepareReviewRepository(fixture.config, "HEAD"), {
    code: "manifest-invalid",
  });
});

test("a repository-root catalogue rebuild discovers and reads its moved historical root", async (context) => {
  const fixture = await derivedFixture(context);
  const config = {
    ...fixture.config,
    mockupsDir: fixture.root,
    generatedDir: path.join(fixture.root, ".generated"),
  };
  const selected = await prepareReviewRepository(config, "HEAD");
  const route = [...fixture.baseline.outputs.keys()].find((name) =>
    name.endsWith(".html"),
  );
  assert.ok(route);
  assert.equal(selected.selection, "rebuild");
  assert.equal(selected.descriptor.catalogueRoot, "mockups");
  assert.equal(selected.descriptor.generatedRoot, "mockups/.generated");
  assert.equal(
    await fs.readFile(
      path.join(
        fixture.root,
        ".mokly-cache/baselines",
        fixture.commit,
        "inputs.json",
      ),
      "utf8",
    ),
    JSON.stringify("."),
  );
  assert.equal(
    await selected.reader.readFile(
      fixture.commit,
      `mockups/.generated/${route}`,
    ),
    fixture.baseline.outputs.get(route),
  );
});
