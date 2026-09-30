import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { createExportFixture } from "./helpers/export_fixture.js";
import { startFakeReceiver } from "./helpers/fake_receiver.js";
import { validEntrySource } from "./helpers/fixture.js";
import { expectedUploadedEntries } from "./helpers/publish_counts.js";
import { runPublishedCli } from "./helpers/publish_process.js";

const token = "delta-receiver-token";

test("delta receiver uploads generated CSS and exact binary asset bytes", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  const receiver = await startFakeReceiver(context, { token });
  const assetBytes = Buffer.from([0, 255, 3, 10]);
  await fs.writeFile(
    fixture.entryPath,
    validEntrySource({
      body: "<button className={classes.auth}>Sign in</button>",
    }) + '\nimport classes from "./theme.module.css";\n',
  );
  await fs.writeFile(
    path.join(fixture.entriesDir, "theme.module.css"),
    '.auth { background-image: url("./font.woff2"); color: red; }',
  );
  await fs.writeFile(path.join(fixture.entriesDir, "font.woff2"), assetBytes);

  await runPublishedCli(fixture.root, receiver.endpoint, token);
  const ownership = receiver.plans[0]!.ownership.files;
  const assetPath = "static/mokly-generated/assets/entries/font.woff2";
  const cssPath =
    "static/mokly-generated/styles/entries/fixture.mockup.tsx.css";
  const asset = ownership.find(({ path }) => path === assetPath);
  const stylesheet = ownership.find(({ path }) => path === cssPath);
  assert.ok(asset);
  assert.ok(stylesheet);
  assert.equal(asset.size, assetBytes.length);
  assert.equal(
    asset.sha256,
    createHash("sha256").update(assetBytes).digest("hex"),
  );
  assert.deepEqual(receiver.blobs.get(asset.sha256), assetBytes);
  const cssBytes = receiver.blobs.get(stylesheet.sha256);
  assert.ok(cssBytes);
  assert.equal(stylesheet.size, cssBytes.length);
  assert.equal(
    stylesheet.sha256,
    createHash("sha256").update(cssBytes).digest("hex"),
  );
  assert.match(cssBytes.toString("utf8"), /mokly_[a-f0-9]{12}_auth/u);
  assert.ok(receiver.puts.includes(asset.sha256));
  assert.ok(receiver.puts.includes(stylesheet.sha256));
});

test("publish uploads changed content and identity-stamped shells after an entry change", async (context) => {
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
  assert.notEqual(
    second.manifest.comparisonPath,
    first.manifest.comparisonPath,
  );
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
  const uploaded = expectedUploadedEntries(second);
  assert.equal(
    stdout,
    `Published Mokly catalogue. ${uploaded} ${uploaded === 1 ? "file" : "files"} uploaded, ${second.ownership.files.length - uploaded} unchanged.\n` +
      `${receiver.origin}/catalogues/publication-2/view\n`,
  );
  assert.equal(stderr, "");
  const snapshots = requested.filter((name) =>
    name.includes("/snapshots/after/screens/home."),
  );
  assert.equal(snapshots.length, 2);
  const identityStamped = [
    "404.html",
    "__mokly/catalogue.json",
    "index.html",
    "view/screens/details.html",
    "view/screens/home.html",
    "view/user-flows/tour.html",
  ];
  const allStamped = second.ownership.files
    .map(({ path }) => path)
    .filter(
      (name) =>
        name === "index.html" ||
        name === "404.html" ||
        name === "__mokly/catalogue.json" ||
        name.startsWith("view/"),
    )
    .sort();
  assert.deepEqual([...identityStamped].sort(), allStamped);
  assert.deepEqual(
    requested,
    [
      ...identityStamped,
      "static/screens/home.desktop.html",
      "static/screens/home.mobile.html",
      ...snapshots,
    ].sort(),
  );
});

test("a new commit with unchanged current-only content uploads no Blob", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  const receiver = await startFakeReceiver(context, { token });
  await runPublishedCli(fixture.root, receiver.endpoint, token, [
    "--no-changes",
  ]);
  const first = receiver.plans[0]!;
  const puts = receiver.puts.length;
  await fixture.git("commit", "--allow-empty", "-qm", "test: new revision");
  const result = await runPublishedCli(fixture.root, receiver.endpoint, token, [
    "--no-changes",
  ]);
  const second = receiver.plans[1]!;
  assert.notEqual(second.manifest.headSha, first.manifest.headSha);
  assert.notDeepEqual(
    second.files.get("mokly-upload.json"),
    first.files.get("mokly-upload.json"),
  );
  assert.equal(second.ownership.files.length, first.ownership.files.length);
  assert.deepEqual(second.missing, []);
  assert.equal(receiver.puts.length, puts);
  assert.match(result.stdout, /^Published Mokly catalogue\./u);
  assert.equal(result.stderr, "");
});
