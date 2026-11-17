import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  CatalogueReadError,
  catalogueArtifactOrigin,
  catalogueReads,
  detailSource,
  readIndex,
} from "../../viewer/catalogue-source.web";
import type { CatalogueTransport } from "../../viewer/catalogue-source.web";
import { repositoryRoot } from "../root";
import { removed } from "./fixtures";

const fixtures =
  repositoryRoot + "/docs/protocol/fixtures/";
const indexFile: unknown = JSON.parse(
  readFileSync(fixtures + "catalogue-v9.json", "utf8"),
);
const detailFiles: unknown = JSON.parse(
  readFileSync(fixtures + "entry-details-v4.json", "utf8"),
);
const root = new URL("https://p-publication.example/");
const generation =
  "mokly-viewer/diffs/generations/" + "c".repeat(64) + "/entries/";

/** One member of a fixture object, read without asserting its type. */
function member(value: unknown, key: string): unknown {
  assert.ok(typeof value === "object" && value !== null, key);
  const found: unknown = Reflect.get(value, key);
  return found;
}

/** A copy of one fixture object with some fields replaced. */
function withFields(value: unknown, fields: Record<string, unknown>): object {
  assert.ok(typeof value === "object" && value !== null);
  return { ...value, ...fields };
}

const current = (path: string) => member(member(detailFiles, "current"), path);
const removedDetail = member(
  member(detailFiles, "removed"),
  removed.snapshotId,
);

function response(url: string, status: number, body: unknown) {
  const value = new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
  Object.defineProperty(value, "url", { value: url });
  return value;
}

/**
 * The publication host: one body per path, and the statuses a path answers
 * before it answers its body, in order.
 */
function host(
  files: Record<string, unknown>,
  refusals: Record<string, number[]> = {},
) {
  const calls: Array<{ path: string; credentials?: RequestCredentials }> = [];
  const transport: CatalogueTransport = async (url, init) => {
    calls.push({ path: url.pathname, credentials: init.credentials });
    const refused = refusals[url.pathname]?.shift();
    if (refused !== undefined) return response(url.href, refused, {});
    return response(url.href, 200, files[url.pathname]);
  };
  return { calls, transport };
}

/** The packaged index, read the way the host reads every index. */
function packagedIndex() {
  return readIndex(
    root,
    false,
    host({ "/mokly-viewer/index.json": indexFile }).transport,
  );
}

test("a private index is read with the confirmed cookie from its own origin", async () => {
  const { calls, transport } = host({ "/mokly-viewer/index.json": indexFile });
  const read = await readIndex(root, true, transport);
  assert.deepEqual(calls, [
    { path: "/mokly-viewer/index.json", credentials: "include" },
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
  const { calls, transport } = host({ "/mokly-viewer/index.json": indexFile });
  await readIndex(root, false, transport);
  assert.equal(calls[0]?.credentials, "omit");
});

const request = {
  origin: "https://p-publication.example",
  credentialed: false,
  projectId: "project",
  publicationId: "publication",
};

for (const version of [8, 10]) {
  test(`index v${version} is a version failure with the readers' diagnostic`, async () => {
    const changed = withFields(indexFile, { schemaVersion: version });
    const { transport } = host({ "/mokly-viewer/index.json": changed });
    assert.deepEqual(await catalogueReads(transport).index(request), {
      failure: {
        details: `Unsupported Mokly catalogue version ${version}; this viewer supports version 9.`,
      },
    });
  });
}

test("a malformed or missing index fails the read, not the version gate", async () => {
  const malformed: CatalogueTransport = async () => {
    const answer = response(
      new URL("mokly-viewer/index.json", root).href,
      200,
      indexFile,
    );
    answer.json = async () => JSON.parse("{");
    return answer;
  };
  await assert.rejects(catalogueReads(malformed).index(request), SyntaxError);
  const missing = host({}, { "/mokly-viewer/index.json": [404] });
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
  await assert.rejects(readIndex(root, true, redirected), CatalogueReadError);
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
    credentialed: false,
    index: await packagedIndex(),
    renew: async () => assert.fail("a public catalogue never renews"),
    transport,
  });
  const read = await detail("product/browse/details");
  assert.equal(read.entry.path, "product/browse/details");
  const previous = await detail(removed.screen, removed.snapshotId);
  assert.equal(previous.entry.snapshotId, removed.snapshotId);
  assert.deepEqual(calls, [
    { path: currentPath, credentials: "omit" },
    { path: removedPath, credentials: "omit" },
  ]);
});

test("a detail of another version keeps the readers' typed version error", async () => {
  const { MoklyVersionError } = await import("@mokly/viewer");
  const path = "/mokly-viewer/entries/guide.json";
  const { transport } = host({
    [path]: withFields(current("guide"), { schemaVersion: 3 }),
  });
  const detail = detailSource({
    root,
    credentialed: false,
    index: await packagedIndex(),
    renew: async () => undefined,
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
  const path = "/mokly-viewer/entries/guide.json";
  const reads = host({ [path]: current("guide") }, { [path]: statuses });
  let renewals = 0;
  const detail = detailSource({
    root,
    credentialed: true,
    index: await packagedIndex(),
    renew: async () => {
      renewals += 1;
      await renewal?.();
    },
    transport: reads.transport,
  });
  return { detail, calls: reads.calls, renewals: () => renewals };
}

test("a private detail read that answers 401 renews once and reads once more", async () => {
  const { detail, calls, renewals } = await privateDetail([401]);
  assert.equal((await detail("guide")).entry.path, "guide");
  assert.equal(renewals(), 1);
  assert.deepEqual(
    calls.map((call) => call.credentials),
    ["include", "include"],
  );
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
  const path = "/mokly-viewer/entries/guide.json";
  for (const [credentialed, status] of [
    [false, 401],
    [true, 403],
  ] as const) {
    const reads = host({}, { [path]: [status] });
    let renewals = 0;
    const detail = detailSource({
      root,
      credentialed,
      index: await packagedIndex(),
      renew: async () => {
        renewals += 1;
      },
      transport: reads.transport,
    });
    await assert.rejects(detail("guide"), { status });
    assert.equal(renewals, 0, `${credentialed} ${status}`);
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
