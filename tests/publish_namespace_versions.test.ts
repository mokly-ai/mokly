import assert from "node:assert/strict";
import test from "node:test";

import { exportCatalogue } from "../dist/export/run.js";
import { publishCatalogue } from "../dist/publish/run.js";
import { NodeGitCommandRunner } from "../dist/review/git.js";

import { createExportFixture } from "./helpers/export_fixture.js";
import { startFakeReceiver } from "./helpers/fake_receiver.js";
import { readFakePlanArchive } from "./helpers/fake_receiver_archive.js";
import {
  fakePlanArchive,
  fakePlanRequest,
} from "./helpers/fake_receiver_fixture.js";

for (const noChanges of [false, true])
  test(`an older receiver rejects a new ${noChanges ? "current-only" : "Changes-enabled"} publication without fallback`, async (t) => {
    const fixture = await createExportFixture();
    t.after(() => fixture.close());
    let requests = 0;
    await assert.rejects(
      publishCatalogue(
        fixture.config,
        {
          out: "site",
          noChanges,
          endpoint: "https://legacy.invalid/upload",
          token: "fixture-token",
          repository: "github.com/sample/catalogue",
        },
        "1.2.3",
        {},
        {
          git: new NodeGitCommandRunner(fixture.root),
          export: exportCatalogue,
          now: () => new Date(),
          random: () => 0,
          sleep: async () => {
            assert.fail("A version failure must not retry");
          },
          fetch: async (_url, options) => {
            requests++;
            assert.equal(
              requests,
              1,
              "No Blobs, Complete, downgrade or re-plan",
            );
            const files = await readFakePlanArchive(
              Buffer.from(options?.body as Uint8Array),
            );
            const envelope = JSON.parse(
              files.get("mokly-upload.json")!.toString(),
            );
            const marker = JSON.parse(
              files.get(".mokly-export-artifact")!.toString(),
            );
            assert.equal(envelope.schemaVersion, 2);
            assert.equal(marker.schemaVersion, 3);
            assert.equal(envelope.comparisonPath === null, noChanges);
            // The pre-rename receiver gates versions before interpreting any file paths.
            assert.ok(
              envelope.schemaVersion !== 1 && marker.schemaVersion !== 2,
            );
            return new Response("private receiver diagnostic", { status: 426 });
          },
        },
      ),
      (error: unknown) => {
        assert.ok(error instanceof Error && "code" in error);
        assert.equal(error.code, "upload-unsupported-version");
        assert.equal(
          error.message,
          "[mokly/upload-unsupported-version] The catalogue service does not support this Mokly version. Update the service and try again.",
        );
        return true;
      },
    );
    assert.equal(requests, 1);
  });

test("the updated receiver rejects old upload and ownership envelopes", async (t) => {
  const receiver = await startFakeReceiver(t);
  for (const options of [{ manifestVersion: 1 }, { markerVersion: 2 }]) {
    const fixture = await fakePlanArchive(options);
    assert.equal(
      (
        await fakePlanRequest(
          receiver.endpoint,
          fixture.archive,
          "fixture-token",
        )
      ).status,
      426,
    );
  }
  assert.equal(receiver.plans.length, 0);
  assert.equal(receiver.publications.size, 0);
  assert.equal(receiver.blobs.size, 0);
});
