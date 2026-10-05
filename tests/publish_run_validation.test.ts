import assert from "node:assert/strict";
import test from "node:test";

import { isCancellation, MoklyError } from "../dist/errors.js";
import { publishCatalogue } from "../dist/publish/run.js";

import {
  config,
  dependencies,
  options,
} from "./helpers/publish_run_fixture.js";

test("a moved HEAD or failed export prevents the HTTP side effect", async () => {
  const moved = dependencies();
  const git = moved.boundaries.git;
  let reads = 0;
  moved.boundaries.git = {
    run: async (args) => {
      if (args.includes("--verify") && ++reads > 1) return "e".repeat(40);
      return git.run(args);
    },
  };
  await assert.rejects(
    publishCatalogue(config, options, "1.2.3", {}, moved.boundaries),
    /git-failed.*HEAD changed/,
  );
  assert.equal(moved.uploaded(), false);
  const failed = dependencies();
  failed.boundaries.export = async () => {
    throw new Error("export failed");
  };
  await assert.rejects(
    publishCatalogue(config, options, "1.2.3", {}, failed.boundaries),
    /export failed/,
  );
  assert.equal(failed.uploaded(), false);
});

test("an identity failure after cancellation is classified before export", async () => {
  const fixture = dependencies();
  const controller = new AbortController();
  let exported = false;
  fixture.boundaries.git = {
    run: async () => {
      controller.abort();
      throw new MoklyError("git-failed", "identity reader failed");
    },
  };
  fixture.boundaries.export = async () => {
    exported = true;
    throw new Error("export must not start");
  };
  await assert.rejects(
    publishCatalogue(
      config,
      options,
      "1.2.3",
      {},
      fixture.boundaries,
      controller.signal,
    ),
    (error: unknown) => {
      assert.ok(error instanceof MoklyError);
      assert.equal(error.code, "git-failed");
      assert.equal(
        error.message,
        "[mokly/git-failed] Publish needs a committed Git checkout and a valid remote; use --repository <host>/<owner>/<name> to set repository identity.",
      );
      assert.equal(isCancellation(error), true);
      assert.equal(error.cause, undefined);
      assert.match(error.stack ?? "", /readUploadIdentity/u);
      return true;
    },
  );
  assert.equal(exported, false);
});

test("invalid metadata prevents capture and upload", async () => {
  const fixture = dependencies();
  await assert.rejects(
    publishCatalogue(
      { ...config, configPath: "/outside/secret" },
      options,
      "1.2.3",
      {},
      fixture.boundaries,
    ),
    /upload-invalid-bundle/,
  );
  assert.equal(fixture.uploaded(), false);
});

test("a dirty checkout is written into the manifest and the result", async () => {
  const fixture = dependencies(false, () => " M tracked.txt\0");
  const result = await publishCatalogue(
    config,
    options,
    "1.2.3",
    {},
    fixture.boundaries,
  );
  assert.equal(result.uncommittedChanges, true);
  assert.equal(fixture.metadata()?.["uncommittedChanges"], true);
  assert.equal(fixture.metadata()?.["schemaVersion"], 2);
});

test("a state change during export fails before Plan in both directions", async () => {
  for (const [before, after] of [
    ["", "?? docs/draft.md\0"],
    ["?? docs/draft.md\0", ""],
  ] as const) {
    let reads = 0;
    const fixture = dependencies(false, () => (reads++ === 0 ? before : after));
    await assert.rejects(
      publishCatalogue(config, options, "1.2.3", {}, fixture.boundaries),
      /\[mokly\/git-failed\] Uncommitted changes appeared or disappeared during export\. Commit or ignore files that builds write, then publish again\./u,
    );
    assert.equal(reads, 2);
    assert.equal(fixture.planArchive(), undefined);
    assert.equal(fixture.uploaded(), false);
  }
});

test("Mokly's own output never makes the recheck differ", async () => {
  let reads = 0;
  const fixture = dependencies(false, () =>
    reads++ === 0
      ? ""
      : "?? tools/.context/mokly-publish/index.html\0?? tools/.context/.mokly-export-reservations/.owner\0?? .mokly-cache/locks/a\0",
  );
  const result = await publishCatalogue(
    config,
    options,
    "1.2.3",
    {},
    fixture.boundaries,
  );
  assert.equal(result.uncommittedChanges, false);
  assert.equal(reads, 2);
});
