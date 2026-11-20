import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import { publicationBody } from "./publish";

/** The pinned viewer's public readers, which ship only as an ES module. */
const viewer = () => import("@mokly/viewer");

function artifacts(input: Parameters<typeof publicationBody>[0] = {}) {
  const body = publicationBody(input);
  const read = spawnSync(
    "python3",
    [
      "-c",
      "import io,json,sys,tarfile\nwith tarfile.open(fileobj=io.BytesIO(sys.stdin.buffer.read()),mode='r:gz') as a: json.dump({f.name:json.load(a.extractfile(f)) for f in a if f.isfile()},sys.stdout)",
    ],
    { input: body.plan },
  );
  assert.equal(read.status, 0, read.stderr.toString());
  return { body, plan: JSON.parse(read.stdout.toString()) };
}

test("the test publisher sends envelope v3, marker v3 and index v9", async () => {
  const { readCatalogueIndex } = await viewer();
  const { plan } = artifacts({ branch: "topic" });
  assert.deepEqual(Object.keys(plan).sort(), [
    ".mokly-export-artifact",
    "mokly-upload.json",
    "mokly-viewer/index.json",
  ]);
  const envelope = plan["mokly-upload.json"];
  assert.equal(envelope.schemaVersion, 3);
  assert.equal(envelope.branch, "topic");
  assert.equal(plan[".mokly-export-artifact"].schemaVersion, 3);
  const index = readCatalogueIndex(plan["mokly-viewer/index.json"]);
  assert.equal(index.baseCommit, envelope.baseSha);
  assert.match(
    index.comparisonUrl ?? "",
    /^mokly-viewer\/diffs\/generations\/[a-f0-9]{64}\/$/,
  );
});

test("the current-only test publisher sends an index the viewer accepts", async () => {
  const { readCatalogueIndex } = await viewer();
  const { plan } = artifacts({ currentOnly: true });
  const envelope = plan["mokly-upload.json"];
  assert.equal(envelope.baseRef, null);
  assert.equal(envelope.baseSha, null);
  assert.ok(
    plan[".mokly-export-artifact"].files.every(
      ({ path }: { path: string }) => !path.startsWith("mokly-viewer/diffs/"),
    ),
  );
  const index = readCatalogueIndex(plan["mokly-viewer/index.json"]);
  assert.equal(index.comparisonUrl, null);
  assert.equal(index.baseCommit, undefined);
  assert.equal(index.changesStatus, "disabled");
});

test("the version publisher stores details the viewer refuses at their paths", async () => {
  const { MoklyVersionError, readEntryDetail } = await viewer();
  const { body, plan } = artifacts({ detailVersion: 3 });
  const details = plan[".mokly-export-artifact"].files.filter(
    ({ path }: { path: string }) => path.startsWith("mokly-viewer/entries/"),
  );
  assert.ok(
    details.some(({ path }: { path: string }) => path.endsWith("/start.json")),
  );
  for (const { path, sha256 } of details) {
    const bytes = body.blobs.get(sha256);
    assert.ok(bytes, path);
    assert.throws(
      () => readEntryDetail(JSON.parse(bytes.toString())),
      (error) => error instanceof MoklyVersionError && error.version === 3,
    );
  }
});
