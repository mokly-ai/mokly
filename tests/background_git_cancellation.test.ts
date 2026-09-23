import assert from "node:assert/strict";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { prepareLiveRuntime } from "../dist/build/live_runtime.js";
import { prepareReviewRepository } from "../dist/review/prepare.js";
import { RepositoryCatalogueChangeClassifier } from "../dist/server/component_changes.js";
import { BackgroundCompilation } from "../dist/server/demand/background.js";
import { BackgroundGeneration } from "../dist/server/demand/generation.js";

import { blockingGit, processExists } from "./helpers/blocking_git.js";
import { changedFixture } from "./helpers/changed_fixture.js";

test(
  "background shutdown drains its real Git subprocess before returning",
  { timeout: 15000, skip: process.platform === "win32" },
  async (t) => {
    const fixture = await changedFixture(t);
    const runtime = await prepareLiveRuntime(fixture.config);
    const existing = await compileCatalogue(fixture.config);
    const prepared = await prepareReviewRepository(fixture.config, "main");
    const blocked = await blockingGit(fixture);
    const background = new BackgroundCompilation(runtime, existing);
    fixture.beforeRemove(() => background.close());
    const classification = background.classify("main", prepared);
    const pid = await blocked.started();

    await background.close();

    assert.equal(await classification, undefined);
    assert.equal(processExists(pid), false, "Git survived background shutdown");
    await background.close();
  },
);

test("classification retains unavailable evidence when asynchronous Git reads fail", async (t) => {
  const fixture = await changedFixture(t);
  const compilation = await compileCatalogue(fixture.config);
  const commands: string[] = [];
  const classifier = new RepositoryCatalogueChangeClassifier({
    async run(args) {
      commands.push(args[0]!);
      if (args[0] === "rev-parse") return fixture.root;
      if (args[0] === "merge-base") return "a".repeat(40);
      throw new Error("Git read failed");
    },
  });
  assert.equal(
    await classifier.read(
      fixture.config,
      compilation.manifest,
      "main",
      undefined,
      {
        commit: "a".repeat(40),
        selection: "blobs",
        outputs: compilation.outputs,
      },
    ),
    undefined,
  );
  assert.ok(commands.includes("ls-tree"));
});

test(
  "source replacement drains old Git and allows fresh classification",
  { timeout: 15000, skip: process.platform === "win32" },
  async (t) => {
    const fixture = await changedFixture(t);
    const runtime = await prepareLiveRuntime(fixture.config);
    const existing = await compileCatalogue(fixture.config);
    const blocked = await blockingGit(fixture);
    let publications = 0;
    let published: () => void = () => {};
    const ready = new Promise<void>((resolve) => {
      published = resolve;
    });
    const background = new BackgroundGeneration(
      { check() {}, async write() {} },
      new RepositoryCatalogueChangeClassifier(),
      () => {},
      () => {
        publications++;
        published();
      },
    );
    fixture.beforeRemove(() => background.close());
    background.start(runtime, "main", existing);
    const pid = await blocked.started();

    await background.invalidate();

    assert.equal(processExists(pid), false, "Git survived source replacement");
    assert.equal(publications, 0);
    blocked.restore();
    background.start(
      { ...runtime, generation: "b".repeat(32) },
      "main",
      existing,
    );
    await ready;
    assert.equal(publications, 1);
  },
);
