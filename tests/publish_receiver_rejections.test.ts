import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { createExportFixture } from "./helpers/export_fixture.js";
import {
  startFakeReceiver,
  type FakeRequestKind,
} from "./helpers/fake_receiver.js";
import { runPublishedCli } from "./helpers/publish_process.js";

const token = "rejection-receiver-token";

const statuses: ReadonlyArray<readonly [number, string, string]> = [
  [
    400,
    "upload-invalid-bundle",
    "The service rejected the catalogue data. Rebuild the export and retry.",
  ],
  [
    422,
    "upload-invalid-bundle",
    "The service rejected the catalogue data. Rebuild the export and retry.",
  ],
  [
    401,
    "upload-unauthorized",
    "The service denied the upload. Check the token and repository access.",
  ],
  [
    403,
    "upload-unauthorized",
    "The service denied the upload. Check the token and repository access.",
  ],
  [
    413,
    "upload-too-large",
    "The catalogue exceeds an upload limit. Reduce the catalogue or its assets.",
  ],
  [
    426,
    "upload-unsupported-version",
    "The service does not support this upload version. Update Mokly or the receiver.",
  ],
  [
    404,
    "upload-failed",
    "The service did not accept the upload. Check the endpoint and retry.",
  ],
  [
    302,
    "upload-failed",
    "The service did not accept the upload. Check the endpoint and retry.",
  ],
];

test("plan, blob and complete rejection statuses keep fixed secret-free output", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  const receiver = await startFakeReceiver(context, { token });
  const kinds: Exclude<FakeRequestKind, "unknown">[] = [
    "plan",
    "blob",
    "complete",
  ];
  for (const kind of kinds) {
    for (const [status, code, message] of statuses) {
      receiver.queue(kind, { status, body: token });
      await assert.rejects(
        runPublishedCli(fixture.root, receiver.endpoint, token, [
          "--no-changes",
          "--upload-concurrency=1",
        ]),
        (error: unknown) => {
          const output = error as { stdout: string; stderr: string };
          assert.equal(output.stdout, "", `${kind} ${status}`);
          assert.equal(
            output.stderr,
            `[mokly/${code}] ${message}\n`,
            `${kind} ${status}`,
          );
          assert.equal((output.stdout + output.stderr).includes(token), false);
          return true;
        },
      );
    }
  }
  const output = path.join(fixture.root, "site");
  const marker = JSON.parse(
    await fs.readFile(path.join(output, ".mokly-export-artifact"), "utf8"),
  ) as { files: Array<{ path: string }> };
  assert.ok(marker.files.length > 0);
  for (const entry of marker.files)
    assert.equal(
      (await fs.stat(path.join(output, entry.path))).isFile(),
      true,
      entry.path,
    );
  assert.equal(JSON.stringify(receiver.requests).includes(token), false);
});
