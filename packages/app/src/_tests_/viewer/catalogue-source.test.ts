import assert from "node:assert/strict";
import { test } from "node:test";

import type { CatalogueTransport } from "../../viewer/access-exchange";
import {
  CatalogueReadError,
  catalogueArtifactOrigin,
  catalogueReads,
  detailSource,
  readIndex,
} from "../../viewer/catalogue-source.web";

import {
  cookieAccess,
  current,
  guidePath,
  host,
  indexFile,
  indexPath,
  packagedIndex,
  publicAccess,
  removedDetail,
  response,
  root,
} from "./catalogue-read-fixture";
import { removed } from "./fixtures";

const generation =
  "mokly-viewer/diffs/generations/" + "c".repeat(64) + "/entries/";

/** A copy of one fixture object with some fields replaced. */
function withFields(value: unknown, fields: Record<string, unknown>): object {
  assert.ok(typeof value === "object" && value !== null);
  return { ...value, ...fields };
}

test("a private index is read with the confirmed cookie from its own origin", async () => {
  const { calls, transport } = host({ [indexPath]: indexFile });
  const read = await readIndex(root, cookieAccess(), transport);
  assert.deepEqual(calls, [
    { path: indexPath, credentials: "include", authorization: null },
  ]);
  assert.equal(read.schemaVersion, 9);
  // The removed record the address-state tests select is one this release
  // really publishes, so those tests name an identity rather than a shape.
  assert.ok(
    read.removedEntries.some(
      ({ entry, snapshotId }) =>
        entry.path === removed.screen && snapshotId === removed.snapshotId,
    ),
  );
});

test("a public index read omits ambient credentials", async () => {
  const { calls, transport } = host({ [indexPath]: indexFile });
  await readIndex(root, publicAccess, transport);
  assert.deepEqual(calls, [
    { path: indexPath, credentials: "omit", authorization: null },
  ]);
});

const request = { origin: root.origin, access: publicAccess };

for (const version of [8, 10]) {
  test(`index v${version} is a version failure with the readers' diagnostic`, async () => {
    const changed = withFields(indexFile, { schemaVersion: version });
    const { transport } = host({ [indexPath]: changed });
    assert.deepEqual(await catalogueReads(transport).index(request), {
      failure: {
        details: `Unsupported Mokly catalogue version ${version}; this viewer supports version 9.`,
      },
    });
  });
}

test("a malformed or missing index fails the read, not the version gate", async () => {
  const malformed: CatalogueTransport = async () => {
    const answer = response(new URL(indexPath, root).href, 200, indexFile);
    answer.json = async () => JSON.parse("{");
    return answer;
  };
  await assert.rejects(catalogueReads(malformed).index(request), SyntaxError);
  const missing = host({}, { [indexPath]: [404] });
  await assert.rejects(catalogueReads(missing.transport).index(request), {
    name: "CatalogueReadError",
    status: 404,
  });
});

test("an answer from another origin is refused", async () => {
  const redirected: CatalogueTransport = async () =>
    response(
      "https://attacker.example/mokly-viewer/index.json",
      200,
      indexFile,
    );
  await assert.rejects(
    readIndex(root, cookieAccess(), redirected),
    CatalogueReadError,
  );
});

test("current and removed details are read from their own paths", async () => {
  const currentPath = "/mokly-viewer/entries/product/browse/details.json";
  const removedPath = "/" + generation + removed.screen + ".json";
  const { calls, transport } = host({
    [currentPath]: current("product/browse/details"),
    [removedPath]: removedDetail,
  });
  const detail = detailSource({
    root,
    access: () => publicAccess,
    index: await packagedIndex(),
    transport,
  });
  const read = await detail("product/browse/details");
  assert.equal(read.entry.path, "product/browse/details");
  const previous = await detail(removed.screen, removed.snapshotId);
  assert.equal(previous.entry.snapshotId, removed.snapshotId);
  assert.deepEqual(calls, [
    { path: currentPath, credentials: "omit", authorization: null },
    { path: removedPath, credentials: "omit", authorization: null },
  ]);
});

test("a detail of another version keeps the readers' typed version error", async () => {
  const { MoklyVersionError } = await import("@mokly/viewer");
  const { transport } = host({
    [guidePath]: withFields(current("guide"), { schemaVersion: 3 }),
  });
  const detail = detailSource({
    root,
    access: () => publicAccess,
    index: await packagedIndex(),
    transport,
  });
  await assert.rejects(detail("guide"), (error) => {
    assert.ok(error instanceof MoklyVersionError);
    assert.equal(error.boundary, "detail");
    assert.equal(error.supported, 4);
    return true;
  });
});

/** A private detail source whose path answers the given statuses first. */
async function privateDetail(
  statuses: number[],
  renewal?: () => Promise<void>,
) {
  const reads = host(
    { [guidePath]: current("guide") },
    { [guidePath]: statuses },
  );
  let renewals = 0;
  const access = cookieAccess(async () => {
    renewals += 1;
    await renewal?.();
  });
  const detail = detailSource({
    root,
    access: () => access,
    index: await packagedIndex(),
    transport: reads.transport,
  });
  return { detail, calls: reads.calls, renewals: () => renewals };
}

test("a private detail read that answers 401 renews once and reads once more", async () => {
  const { detail, calls, renewals } = await privateDetail([401]);
  assert.equal((await detail("guide")).entry.path, "guide");
  assert.equal(renewals(), 1);
  assert.deepEqual(calls, [
    { path: guidePath, credentials: "include", authorization: null },
    { path: guidePath, credentials: "include", authorization: null },
  ]);
});

test("a private detail read that answers 401 after its renewal fails", async () => {
  const { detail, calls, renewals } = await privateDetail([401, 401]);
  await assert.rejects(detail("guide"), { status: 401 });
  assert.equal(renewals(), 1);
  assert.equal(calls.length, 2);
});

test("a refused renewal fails the read without reading again", async () => {
  const { detail, calls } = await privateDetail([401], async () => {
    throw new Error("refused");
  });
  await assert.rejects(detail("guide"), /refused/);
  assert.equal(calls.length, 1);
});

test("only a private read renews, and only after a 401", async () => {
  for (const [access, status] of [
    [publicAccess, 401],
    [cookieAccess(), 403],
  ] as const) {
    const reads = host({}, { [guidePath]: [status] });
    const detail = detailSource({
      root,
      access: () => access,
      index: await packagedIndex(),
      transport: reads.transport,
    });
    await assert.rejects(detail("guide"), { status });
    assert.equal(reads.calls.length, 1, `${access.policy} ${status}`);
  }
});

test("only a plain HTTP catalogue origin is accepted", () => {
  assert.equal(
    catalogueArtifactOrigin("https://p-publication.example").href,
    "https://p-publication.example/",
  );
  for (const value of [
    "file:///tmp/catalogue",
    "https://user:p@example.test/",
    "https://p.example.test/path",
    "https://p.example.test/?token=secret",
    "https://p.example.test/#fragment",
  ]) {
    assert.throws(() => catalogueArtifactOrigin(value));
  }
});
