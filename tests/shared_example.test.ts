import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { cacheLayout } from "../dist/baseline/cache_layout.js";

import {
  exampleFingerprint,
  readExampleDescriptor,
} from "./helpers/example_descriptor.js";
import {
  exampleCommit,
  validateWarmExample,
} from "./helpers/example_preparation.js";
import type { PreparedExample } from "./helpers/example_preparation.js";
import {
  acquireSharedExample,
  prepareSharedExample,
  sharedExampleEnvironment,
} from "./helpers/shared_example.js";
import {
  closeTestExamples,
  createMiniExample,
} from "./helpers/shared_example_test_source.js";

const execute = promisify(execFile);

test("one real baseline preparation supplies independent warm repositories and caches", async () => {
  let builds = 0;
  const shared = await prepareSharedExample({
    createSource: async (root) => {
      builds++;
      return createMiniExample(root);
    },
  });
  let first: PreparedExample | undefined, second: PreparedExample | undefined;
  try {
    const environment = sharedExampleEnvironment(shared);
    assert.equal(
      (await readExampleDescriptor(environment)).commit,
      shared.commit,
    );
    first = await acquireSharedExample("first-consumer", { environment });
    second = await acquireSharedExample("second-consumer", { environment });
    assert.equal(builds, 1);
    assert.notEqual(first.root, second.root);
    assert.equal(first.commit, shared.commit);
    assert.equal(second.commit, shared.commit);
    const files = [
      ".git/index",
      `.mokly-cache/baselines/${shared.commit}/complete.json`,
      "examples/basic/entries/home.mockup.ts",
    ];
    for (const file of files) {
      const original = await fs.stat(path.join(shared.root, file));
      const copied = await fs.stat(path.join(first.root, file));
      if (process.platform !== "win32")
        assert.notEqual(copied.ino, original.ino, file);
      assert.deepEqual(
        await fs.readFile(path.join(first.root, file)),
        await fs.readFile(path.join(shared.root, file)),
      );
    }
    await fs.appendFile(
      path.join(first.root, files[2]!),
      "\n// First consumer edit\n",
    );
    await execute("git", ["add", "."], { cwd: first.root });
    await execute(
      "git",
      [
        "-c",
        "core.hooksPath=/dev/null",
        "-c",
        "commit.gpgsign=false",
        "commit",
        "-qm",
        "test: independent edit",
      ],
      { cwd: first.root },
    );
    assert.notEqual(await exampleCommit(first.root), shared.commit);
    assert.equal(await exampleCommit(second.root), shared.commit);
    await fs.writeFile(cacheLayout(first.root, shared.commit).marker, "broken");
    await validateWarmExample(second.config, shared.commit);
    assert.equal(
      await exampleFingerprint(shared.root),
      shared.descriptor.templateHash,
    );
    assert.equal(first.close(), first.close());
  } finally {
    await closeTestExamples(first, second, shared);
  }
});

test("a copied cache is revalidated against its actual generated inventory", async () => {
  const shared = await prepareSharedExample({
    createSource: createMiniExample,
  });
  let copy: PreparedExample | undefined;
  try {
    copy = await acquireSharedExample("corrupt-copy", {
      environment: sharedExampleEnvironment(shared),
    });
    const output = cacheLayout(copy.root, copy.commit).output;
    await fs.appendFile(
      path.join(
        output,
        "examples/basic/mokly-generated/screens/home.mobile.html",
      ),
      "changed bytes",
    );
    await assert.rejects(
      validateWarmExample(copy.config, copy.commit),
      /A complete warm example baseline is required; no fixture fallback is allowed/,
    );
    assert.equal(
      await exampleFingerprint(shared.root),
      shared.descriptor.templateHash,
    );
  } finally {
    await closeTestExamples(copy, shared);
  }
});

test("consumers cannot discover a template without their explicit invocation descriptor", async () => {
  await assert.rejects(
    acquireSharedExample("missing", { environment: {} }),
    /not prepared by this invocation/u,
  );
});
