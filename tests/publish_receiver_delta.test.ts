import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { createExportFixture } from "./helpers/export_fixture.js";
import { startFakeReceiver } from "./helpers/fake_receiver.js";
import { validEntrySource } from "./helpers/fixture.js";
import { runPublishedCli } from "./helpers/publish_process.js";

const token = "delta-receiver-token";

test("publish uploads exactly the new marker digests after a committed entry change", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  const receiver = await startFakeReceiver(context, { token });

  await runPublishedCli(fixture.root, receiver.endpoint, token);
  const first = receiver.plans[0]!;
  const firstDigests = new Set(
    first.ownership.files.map(({ sha256 }) => sha256),
  );
  const firstByPath = new Map(
    first.ownership.files.map((entry) => [entry.path, entry.sha256]),
  );
  const putsBeforeChange = receiver.puts.length;

  await fs.writeFile(
    fixture.entryPath,
    validEntrySource({ body: "<strong>Changed published home</strong>" }),
  );
  await fixture.git("add", "entries/fixture.mockup.tsx");
  await fixture.git("commit", "-qm", "test: change one published screen");
  const { stdout, stderr } = await runPublishedCli(
    fixture.root,
    receiver.endpoint,
    token,
  );
  const second = receiver.plans[1]!;
  const archived = new Set([
    "mokly-upload.json",
    ...(second.manifest.comparisonPath ? [second.manifest.comparisonPath] : []),
  ]);
  const expected = second.ownership.files
    .filter(
      (entry) =>
        firstByPath.get(entry.path) !== entry.sha256 &&
        !firstDigests.has(entry.sha256) &&
        !archived.has(entry.path),
    )
    .map(({ path }) => path)
    .sort();
  const requested = second.ownership.files
    .filter(({ sha256 }) => second.missing.includes(sha256))
    .map(({ path }) => path)
    .sort();
  assert.deepEqual(requested, expected);
  assert.deepEqual(
    receiver.puts.slice(putsBeforeChange).sort(),
    [...second.missing].sort(),
  );
  assert.equal(
    stdout,
    `Published Mokly catalogue. ${requested.length} files uploaded, ${second.ownership.files.length - requested.length} unchanged.\n` +
      `${receiver.origin}/catalogues/publication-2/view\n`,
  );
  assert.equal(stderr, "");
  const snapshots = requested.filter((name) =>
    name.includes("/snapshots/after/screens/home."),
  );
  assert.equal(snapshots.length, 2);
  assert.deepEqual(
    requested,
    [
      "404.html",
      "__mokly/catalogue.json",
      "id/details/index.html",
      "id/home/index.html",
      "id/tour/index.html",
      "index.html",
      "static/screens/home.desktop.html",
      "static/screens/home.mobile.html",
      "view/screens/details.html",
      "view/screens/home.html",
      "view/user-flows/tour.html",
      ...snapshots,
    ].sort(),
  );
});
