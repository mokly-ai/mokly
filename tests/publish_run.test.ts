import assert from "node:assert/strict";
import test from "node:test";

import { publishCatalogue } from "../dist/publish/run.js";

import {
  base,
  comparisonPath,
  config,
  dependencies,
  head,
  options,
} from "./helpers/publish_run_fixture.js";
import { extractUploadArchive } from "./helpers/upload_archive.js";

test("publish exchanges the pinned export and returns counts", async () => {
  const fixture = dependencies();
  const result = await publishCatalogue(
    config,
    options,
    "1.2.3",
    {},
    fixture.boundaries,
  );
  assert.equal(fixture.uploaded(), true);
  assert.deepEqual(result, {
    outcome: "published",
    uploaded: 3,
    unchanged: fixture.entries().length - 3,
    viewerUrl: "https://mokly.ai/catalogues/one",
  });
  assert.deepEqual(fixture.metadata(), {
    schemaVersion: 2,
    moklyVersion: "1.2.3",
    repository: { host: "github.com", owner: "team", name: "catalogue" },
    branch: "feature",
    headSha: head,
    baseRef: "origin/main",
    baseSha: base,
    pullRequest: null,
    configPath: "tools/mokly.config.ts",
    exportedAt: "2026-09-26T12:00:00.000Z",
    comparisonPath,
  });
  assert.deepEqual(
    [...fixture.planArchive()!.keys()],
    ["mokly-upload.json", ".mokly-export-artifact", comparisonPath],
  );
});

test("one incomplete completion re-plans and unions uploaded digests", async () => {
  const fixture = dependencies();
  let plans = 0;
  let completes = 0;
  fixture.boundaries.fetch = async (url, init) => {
    if (url === options.endpoint) {
      await extractUploadArchive(init?.body as Buffer);
      const round = plans++;
      const selected = fixture
        .entries()
        .find(({ path }) => path === (round === 0 ? "404.html" : "index.html"));
      return Response.json({
        schemaVersion: 1,
        upload: {
          id: `upload-${plans}`,
          expiresAt: "2026-09-26T13:00:00.000Z",
        },
        missing: selected ? [selected.sha256] : [],
        blobUrl: `https://example.com/uploads/${plans}/blobs/{sha256}`,
        completeUrl: `https://example.com/uploads/${plans}/complete`,
      });
    }
    if (String(url).includes("/blobs/"))
      return new Response(null, { status: 204 });
    if (++completes === 1) return new Response(null, { status: 409 });
    return new Response(null, { status: 201 });
  };
  const result = await publishCatalogue(
    config,
    options,
    "1.2.3",
    {},
    fixture.boundaries,
  );
  assert.equal(plans, 2);
  assert.equal(completes, 2);
  assert.equal(result.uploaded, 4);
  assert.equal(result.unchanged, fixture.entries().length - 4);
});

test("entries sharing a digest upload once but both count as uploaded", async () => {
  const fixture = dependencies(true);
  const result = await publishCatalogue(
    config,
    options,
    "1.2.3",
    {},
    fixture.boundaries,
  );
  assert.equal(result.uploaded, 4);
  assert.equal(result.unchanged, fixture.entries().length - 4);
});

test("a lost Blob response still counts when the next plan has it stored", async () => {
  const fixture = dependencies();
  let plans = 0;
  let now = new Date("2026-09-26T12:00:00.000Z");
  const attempted = () =>
    fixture.entries().find(({ path }) => path === "index.html")!;
  fixture.boundaries.now = () => now;
  fixture.boundaries.sleep = async () => {
    now = new Date("2026-09-26T12:00:00.001Z");
  };
  fixture.boundaries.fetch = async (url) => {
    if (url === options.endpoint) {
      const first = plans++ === 0;
      return Response.json({
        schemaVersion: 1,
        upload: {
          id: `upload-${plans}`,
          expiresAt: first
            ? "2026-09-26T12:00:00.001Z"
            : "2026-09-26T13:00:00.000Z",
        },
        missing: first ? [attempted().sha256] : [],
        blobUrl: `https://example.com/uploads/${plans}/blobs/{sha256}`,
        completeUrl: `https://example.com/uploads/${plans}/complete`,
      });
    }
    if (String(url).includes("/blobs/"))
      throw new Error(
        "the receiver stored the bytes but the response was lost",
      );
    return new Response(null, { status: 201 });
  };
  const result = await publishCatalogue(
    config,
    options,
    "1.2.3",
    {},
    fixture.boundaries,
  );
  assert.equal(plans, 2);
  assert.equal(result.uploaded, 3);
  assert.equal(result.unchanged, fixture.entries().length - 3);
});

test("blob expiry and local expiry each consume the single re-plan", async () => {
  for (const cause of ["blob-410", "local-expiry"] as const) {
    const fixture = dependencies();
    let plans = 0;
    let blobCalls = 0;
    fixture.boundaries.fetch = async (url) => {
      if (url === options.endpoint) {
        const first = plans++ === 0;
        const entry = fixture.entries()[0]!;
        return Response.json({
          schemaVersion: 1,
          upload: {
            id: `upload-${plans}`,
            expiresAt:
              first && cause === "local-expiry"
                ? "2026-09-26T12:00:00.000Z"
                : "2026-09-26T13:00:00.000Z",
          },
          missing: first ? [entry.sha256] : [],
          blobUrl: `https://example.com/uploads/${plans}/blobs/{sha256}`,
          completeUrl: `https://example.com/uploads/${plans}/complete`,
        });
      }
      if (String(url).includes("/blobs/")) {
        blobCalls++;
        return new Response(null, {
          status: cause === "blob-410" ? 410 : 204,
        });
      }
      return new Response(null, { status: 201 });
    };
    const result = await publishCatalogue(
      config,
      options,
      "1.2.3",
      {},
      fixture.boundaries,
    );
    assert.equal(plans, 2, cause);
    assert.equal(blobCalls, cause === "blob-410" ? 1 : 0, cause);
    assert.equal(result.outcome, "published", cause);
  }
});

test("a second re-plan signal fails the whole command", async () => {
  const fixture = dependencies();
  fixture.boundaries.fetch = async (url) => {
    if (url === options.endpoint)
      return Response.json({
        schemaVersion: 1,
        upload: {
          id: "upload",
          expiresAt: "2026-09-26T13:00:00.000Z",
        },
        missing: [],
        blobUrl: "https://example.com/uploads/upload/blobs/{sha256}",
        completeUrl: "https://example.com/uploads/upload/complete",
      });
    return new Response(null, { status: 410 });
  };
  await assert.rejects(
    publishCatalogue(config, options, "1.2.3", {}, fixture.boundaries),
    /upload-failed/,
  );
});
