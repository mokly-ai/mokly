import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import test from "node:test";
import { gunzipSync } from "node:zlib";

import { extract } from "tar-stream";

import { exportCatalogue } from "../dist/export/run.js";
import { publishCatalogue } from "../dist/publish/run.js";
import type { UploadManifest } from "../dist/publish/types.js";
import { NodeGitCommandRunner } from "../dist/review/git.js";

import { derivedFixture } from "./helpers/derived_fixture.js";
import { directoryFiles } from "./helpers/export_fixture.js";
import { validEntrySource } from "./helpers/fixture.js";

test("publish bundles rebuilt derived comparisons and can replace them with current-only output", async (context) => {
  const fixture = await derivedFixture(context);
  await fs.writeFile(
    fixture.entryPath,
    validEntrySource({ body: "Published derived screen" }),
  );
  const uploaded: ReadonlyMap<string, Buffer>[] = [];
  const dependencies = {
    git: new NodeGitCommandRunner(fixture.root),
    export: exportCatalogue,
    now: () => new Date("2026-09-14T12:34:56.789Z"),
    fetch: (async (_url, init) => {
      const unpack = extract();
      const received = new Map<string, Buffer>();
      unpack.on("entry", (header, stream, next) => {
        const chunks: Buffer[] = [];
        stream.on("data", (chunk) => {
          assert.ok(Buffer.isBuffer(chunk));
          chunks.push(chunk);
        });
        stream.on("end", () => {
          received.set(header.name, Buffer.concat(chunks));
          next();
        });
        stream.resume();
      });
      await pipeline(Readable.from([gunzipSync(init!.body as Buffer)]), unpack);
      uploaded.push(received);
      return new Response(null, { status: 204 });
    }) satisfies typeof fetch,
  };
  const options = {
    out: "site",
    endpoint: "https://example.invalid/upload",
    token: "fixture-token",
    repository: "github.com/sample/catalogue",
  };
  const localBefore = await directoryFiles(fixture.mockupsDir);
  await publishCatalogue(fixture.config, options, "1.2.3", {}, dependencies);
  assert.deepEqual(await directoryFiles(fixture.mockupsDir), localBefore);
  const output = path.join(fixture.root, "site");
  const manifestPath = path.join(output, "mokly-upload.json");
  const manifest = JSON.parse(
    await fs.readFile(manifestPath, "utf8"),
  ) as UploadManifest;
  assert.equal(manifest.baseSha, fixture.commit);
  assert.equal(manifest.headSha, fixture.commit);
  assert.ok(manifest.comparisonPath);
  const reviewPath = path.join(output, manifest.comparisonPath);
  const review = JSON.parse(await fs.readFile(reviewPath, "utf8"));
  assert.equal(review.baseCommit, fixture.commit);
  assert.equal(review.baseRef, manifest.baseRef);
  assert.match(
    await fs.readFile(
      path.join(
        path.dirname(reviewPath),
        "snapshots/after/screens/home.mobile.html",
      ),
      "utf8",
    ),
    /Published derived screen/,
  );
  assert.doesNotMatch(
    await fs.readFile(
      path.join(
        path.dirname(reviewPath),
        "snapshots/before/screens/home.mobile.html",
      ),
      "utf8",
    ),
    /Published derived screen/,
  );
  assert.equal(uploaded.length, 1);
  assert.deepEqual(uploaded[0], await directoryFiles(output));
  await fixture.git("update-ref", "-d", "refs/remotes/origin/main");
  await publishCatalogue(
    fixture.config,
    { ...options, noChanges: true },
    "1.2.3",
    {},
    dependencies,
  );
  assert.deepEqual(await directoryFiles(fixture.mockupsDir), localBefore);
  const current = JSON.parse(
    await fs.readFile(manifestPath, "utf8"),
  ) as UploadManifest;
  assert.equal(current.baseSha, null);
  assert.equal(current.baseRef, null);
  assert.equal(current.comparisonPath, null);
  assert.equal(uploaded.length, 2);
  assert.equal(
    [...uploaded[1]!.keys()].some((name) => name.startsWith("__mokly/diffs/")),
    false,
  );
  assert.deepEqual(uploaded[1], await directoryFiles(output));
});
