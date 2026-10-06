import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { VERIFICATION_RESOURCE_ROOT_ENV } from "../dist/baseline/process_owner.js";
import { timeAsync } from "../dist/diagnostics/timings.js";

import {
  PREVIEW_ARTIFACT_MARKER,
  previewFixtureContextRoot,
  startOwnedPreviewFixture,
} from "./browser/preview_fixture_owner.js";
import {
  timeExportPreparation,
  timeFixturePhase,
  type FixturePhaseTiming,
} from "./helpers/fixture_timing.js";

test("preview outputs stay in the executing checkout even with an outer owner", () => {
  const context = path.join(os.tmpdir(), "worker", ".context");
  const sibling = path.join(os.tmpdir(), "parent", ".context", "resources");
  assert.equal(
    previewFixtureContextRoot(context, {
      [VERIFICATION_RESOURCE_ROOT_ENV]: sibling,
    }),
    context,
  );
  const own = path.join(context, "resources", "owned");
  assert.equal(
    previewFixtureContextRoot(context, {
      [VERIFICATION_RESOURCE_ROOT_ENV]: own,
    }),
    own,
  );
});

test("owned preview fixtures isolate writable output and close independently", async (context) => {
  const contextRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-preview-owner-"),
  );
  const closed: string[] = [];
  context.after(() => fs.rm(contextRoot, { force: true, recursive: true }));
  const start = () =>
    startOwnedPreviewFixture({
      build: writeFreshArtifact,
      contextRoot,
      prefix: "worker-",
      serve: async (artifact) => ({
        close: async () => {
          closed.push(artifact);
        },
        url: `http://preview.invalid/${path.basename(path.dirname(artifact))}`,
      }),
    });

  const [first, second] = await Promise.all([start(), start()]);
  assert.notEqual(first.ownerRoot, second.ownerRoot);
  assert.notEqual(first.artifact, second.artifact);
  assert.equal(first.freshness.outputWasAbsent, true);
  assert.ok(
    first.freshness.markerModifiedAtMs >=
      first.freshness.preparationStartedAtMs - 2_000,
  );

  await first.close();
  await first.close();
  await assert.rejects(fs.access(first.ownerRoot), { code: "ENOENT" });
  await fs.access(second.artifact);
  assert.deepEqual(closed, [first.artifact]);

  await second.close();
  assert.deepEqual(closed, [first.artifact, second.artifact]);
});

test("owned preview close shares failures and retains output", async (context) => {
  const contextRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-preview-close-failure-"),
  );
  const failure = new Error("injected endpoint close failure");
  let closes = 0;
  context.after(() => fs.rm(contextRoot, { force: true, recursive: true }));
  const preview = await startOwnedPreviewFixture({
    build: writeFreshArtifact,
    contextRoot,
    prefix: "worker-",
    serve: async () => ({
      close: async () => {
        closes += 1;
        throw failure;
      },
      url: "http://preview.invalid",
    }),
  });

  const first = preview.close();
  const second = preview.close();
  assert.equal(first, second);
  await assert.rejects(first, (error) => error === failure);
  await assert.rejects(second, (error) => error === failure);
  assert.equal(closes, 1);
  await fs.access(preview.artifact);
});

for (const failure of ["build", "serve"] as const) {
  test(`owned preview cleanup removes output after ${failure} setup failure`, async (context) => {
    const contextRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "mokly-preview-failure-"),
    );
    let ownerRoot = "";
    context.after(() => fs.rm(contextRoot, { force: true, recursive: true }));

    await assert.rejects(
      startOwnedPreviewFixture({
        build: async (artifact) => {
          ownerRoot = path.dirname(artifact);
          await writeFreshArtifact(artifact);
          if (failure === "build") throw new Error("injected build failure");
        },
        contextRoot,
        prefix: "worker-",
        serve: async () => {
          throw new Error("injected serve failure");
        },
      }),
      new RegExp(`injected ${failure} failure`),
    );
    assert.ok(ownerRoot);
    await assert.rejects(fs.access(ownerRoot), { code: "ENOENT" });
  });
}

test("owned previews reject stale artifact markers before serving", async (context) => {
  const contextRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-preview-stale-"),
  );
  let ownerRoot = "";
  let served = false;
  context.after(() => fs.rm(contextRoot, { force: true, recursive: true }));

  await assert.rejects(
    startOwnedPreviewFixture({
      build: async (artifact) => {
        ownerRoot = path.dirname(artifact);
        await writeFreshArtifact(artifact);
        const old = new Date(Date.now() - 10_000);
        await fs.utimes(path.join(artifact, PREVIEW_ARTIFACT_MARKER), old, old);
      },
      contextRoot,
      prefix: "worker-",
      serve: async () => {
        served = true;
        return { close: async () => {}, url: "http://preview.invalid" };
      },
    }),
    /preview artifact marker predates preparation/,
  );
  assert.equal(served, false);
  await assert.rejects(fs.access(ownerRoot), { code: "ENOENT" });
});

test("fixture timings separate install, build, baseline and export work", async () => {
  const timings: FixturePhaseTiming[] = [];
  let tick = 0;
  const options = {
    clock: () => ++tick,
    write: (timing: FixturePhaseTiming) => timings.push(timing),
  };
  await timeFixturePhase(
    "slow-export",
    "baseline-fixture",
    false,
    async () => {},
    options,
  );
  await timeExportPreparation(
    "slow-export",
    () =>
      timeAsync("baseline", async () => {
        await timeAsync("baseline.command[0]", async () => {});
        await timeAsync("baseline.command[1]", async () => {});
        await timeAsync("baseline.command[2]", async () => {});
      }),
    options,
  );

  assert.deepEqual(
    timings.map(({ phase, status, operationUnderTest }) => ({
      operationUnderTest,
      phase,
      status,
    })),
    [
      {
        operationUnderTest: false,
        phase: "baseline-fixture",
        status: "ok",
      },
      { operationUnderTest: true, phase: "install", status: "ok" },
      { operationUnderTest: true, phase: "build", status: "ok" },
      { operationUnderTest: true, phase: "baseline", status: "ok" },
      { operationUnderTest: true, phase: "export", status: "ok" },
    ],
  );
  assert.ok(timings.every((timing) => (timing.durationMs ?? 0) > 0));
});

async function writeFreshArtifact(artifact: string): Promise<void> {
  await fs.mkdir(artifact, { recursive: true });
  await fs.writeFile(
    path.join(artifact, PREVIEW_ARTIFACT_MARKER),
    "schemaVersion=1\n",
  );
}
