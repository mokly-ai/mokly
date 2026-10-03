import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { isCancellation, MoklyError } from "../dist/errors.js";
import { withPreInstallationCancellation } from "../dist/export/error.js";
import { fileExportOperations } from "../dist/export/operations.js";
import { exportCatalogue } from "../dist/export/run.js";
import { exportReservation } from "../dist/export/transaction.js";
import { GitReviewAssetReader } from "../dist/review/assets.js";
import { CommittedBaselineReader } from "../dist/review/committed.js";
import type { BaselineReader, GitCommandRunner } from "../dist/review/git.js";
import { readGitFiles } from "../dist/review/git_batch.js";
import { GitRepositoryEvidence } from "../dist/review/git_evidence.js";

import {
  createExportFixture,
  directoryFiles,
} from "./helpers/export_fixture.js";

test("pre-installation cancellation preserves every wrapped Git failure", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  const abort = new Error("The operation was aborted");
  abort.name = "AbortError";
  const runner: GitCommandRunner = {
    run: async () => {
      throw abort;
    },
    runBytes: async () => {
      throw abort;
    },
    runBytesWithInput: async () => {
      throw abort;
    },
  };
  const baseline: BaselineReader = {
    fileExists: async () => true,
    fileKind: async () => "regular",
    readFile: async () => "",
    readFileBytes: async () => new Uint8Array(),
    readFiles: async () => {
      throw abort;
    },
  };
  const failures = [
    [
      "Git command",
      () => new GitRepositoryEvidence(runner).mergeBase("main", "HEAD"),
    ],
    [
      "Git byte command",
      () =>
        new CommittedBaselineReader(runner).readFileBytes(
          "a".repeat(40),
          "mockups/screen.html",
        ),
    ],
    [
      "Git batch",
      () => readGitFiles(runner, "a".repeat(40), ["mockups/screen.html"]),
    ],
    [
      "Review asset",
      () =>
        new GitReviewAssetReader(
          fixture.config,
          baseline,
          "a".repeat(40),
          "mockups",
        ).read("screens/home.mobile.html"),
    ],
  ] as const;

  for (const [label, action] of failures) {
    const original = await rejection(action());
    assert.equal(isCancellation(original), false, label);
    const live = new AbortController();
    assert.equal(
      await rejection(
        withPreInstallationCancellation(live.signal, async () => {
          throw original;
        }),
      ),
      original,
      label,
    );
    const cancelled = new AbortController();
    cancelled.abort();
    const classified = await rejection(
      withPreInstallationCancellation(cancelled.signal, async () => {
        throw original;
      }),
    );
    assert.ok(classified instanceof MoklyError, label);
    assert.equal(classified, original, label);
    assert.equal(classified.code, original.code, label);
    assert.equal(classified.message, original.message, label);
    assert.equal(classified.presentation, original.presentation, label);
    assert.equal(isCancellation(classified), true, label);
  }
});

test("pre-installation cancellation preserves presentation and existing cancellation", async () => {
  const controller = new AbortController();
  controller.abort();
  const transport = new MoklyError("upload-failed", "Transport failed", {
    presentation: "publish-transport-failed",
  });
  const classified = await rejection(
    withPreInstallationCancellation(controller.signal, async () => {
      throw transport;
    }),
  );
  assert.ok(classified instanceof MoklyError);
  assert.equal(classified, transport);
  assert.equal(classified.message, transport.message);
  assert.equal(classified.presentation, transport.presentation);
  assert.equal(isCancellation(classified), true);

  const marked = new MoklyError("export-invalid", "Already cancelled", {
    cancelled: true,
  });
  assert.equal(
    await rejection(
      withPreInstallationCancellation(controller.signal, async () => {
        throw marked;
      }),
    ),
    marked,
  );

  const unexpected = new Error("unexpected failure");
  const wrapped = await rejection(
    withPreInstallationCancellation(controller.signal, async () => {
      throw unexpected;
    }),
  );
  assert.ok(wrapped instanceof MoklyError);
  assert.equal(wrapped.code, "export-invalid");
  assert.equal(
    wrapped.message,
    "[mokly/export-invalid] Could not export catalogue: unexpected failure",
  );
  assert.equal(wrapped.cause, unexpected);
  assert.equal(isCancellation(wrapped), true);
});

test("pre-installation cancellation waits for a queued abort", async () => {
  const controller = new AbortController();
  const original = new MoklyError("build-invalid", "compile failed");
  const pending = withPreInstallationCancellation(
    controller.signal,
    async () => {
      setImmediate(() => controller.abort());
      throw original;
    },
  );

  assert.equal(await rejection(pending), original);
  assert.equal(isCancellation(original), true);
});

test("a live signal preserves a genuine failure after one event-loop turn", async () => {
  const controller = new AbortController();
  const original = new MoklyError("build-invalid", "real compile failure");
  let immediateTurns = 0;
  setImmediate(() => {
    immediateTurns += 1;
    setImmediate(() => {
      immediateTurns += 1;
    });
  });

  assert.equal(
    await rejection(
      withPreInstallationCancellation(controller.signal, async () => {
        throw original;
      }),
    ),
    original,
  );
  assert.equal(immediateTurns, 2);
  assert.equal(isCancellation(original), false);
});

test("export never enters a consumer generated-output write transaction", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  const before = await directoryFiles(fixture.config.generatedDir);
  const original = fs.promises.writeFile;
  let generatedWrites = 0;
  context.mock.method(
    fs.promises,
    "writeFile",
    async (...args: Parameters<typeof original>) => {
      if (String(args[0]).includes(`${path.sep}.mokly-write-`)) {
        generatedWrites++;
        throw new Error("Unexpected generated-output write");
      }
      return original.apply(fs.promises, args);
    },
  );
  await exportCatalogue(fixture.config, { outDir: "site", noChanges: true });
  assert.equal(generatedWrites, 0);
  assert.deepEqual(await directoryFiles(fixture.config.generatedDir), before);
});

test("reservation setup failures remain unmarked after cancellation", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  await exportCatalogue(fixture.config, { outDir: "site", noChanges: true });
  const previous = await directoryFiles(fixture.output);
  const reservation = exportReservation(fixture.output);
  await fs.promises.mkdir(reservation);
  const controller = new AbortController();
  const original = fileExportOperations.lstat;
  let aborted = false;
  fileExportOperations.lstat = async (candidate) => {
    if (!aborted) {
      aborted = true;
      controller.abort();
    }
    return original(candidate);
  };
  try {
    const failure = await rejection(
      exportCatalogue(fixture.config, {
        outDir: "site",
        noChanges: true,
        signal: controller.signal,
      }),
    );
    assert.ok(failure instanceof MoklyError);
    assert.match(failure.message, /Export reservation unavailable/u);
    assert.equal(isCancellation(failure), false);
  } finally {
    fileExportOperations.lstat = original;
    await fs.promises.rm(reservation, { force: true, recursive: true });
  }
  assert.deepEqual(await directoryFiles(fixture.output), previous);
});

async function rejection(promise: Promise<unknown>): Promise<MoklyError> {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof MoklyError);
    return error;
  }
  assert.fail("expected a rejected operation");
}
