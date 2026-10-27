import assert from "node:assert/strict";
import { test } from "node:test";

import { MoklyVersionError } from "../src/catalogue/version_error.js";
import {
  fetchStandaloneIndex,
  standaloneDataSource,
  type StandaloneWindow,
} from "../src/standalone/data_source.js";

import {
  indexFixture,
  rawDetailFixtures,
  rawIndexFixture,
} from "./catalogue_v8_fixture.js";

const ORIGIN = "http://localhost:4810";
const RETIRED =
  "9222f823b4a0d8a23e201436f42c7d624b675f318bc496b635d18fb9f5a4806e";

/** A window whose fetch serves JSON bodies by pathname. */
function fakeWindow(routes: Record<string, unknown>) {
  const requests: { url: string; init: RequestInit }[] = [];
  let reloads = 0;
  const win: StandaloneWindow = {
    location: {
      href: `${ORIGIN}/view/guide/?comparison=side#hero`,
      reload: () => (reloads += 1),
    },
    fetch: async (url, init) => {
      requests.push({ url: url.href, init });
      const body = routes[url.pathname];
      return {
        ok: body !== undefined,
        status: body === undefined ? 404 : 200,
        url: url.href,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => body,
      } as Response;
    },
  };
  return { win, requests, reloads: () => reloads };
}

const signal = new AbortController().signal;

test("the standalone shell reads the index at the stub's origin", async () => {
  const { win, requests } = fakeWindow({
    "/mokly-viewer/index.json": rawIndexFixture(),
  });
  const index = await fetchStandaloneIndex(win, signal);
  assert.equal(index.schemaVersion, 8);
  assert.deepEqual(requests, [
    {
      url: `${ORIGIN}/mokly-viewer/index.json`,
      init: { credentials: "omit", signal },
    },
  ]);
  const older = fakeWindow({
    "/mokly-viewer/index.json": { ...rawIndexFixture(), schemaVersion: 6 },
  });
  await assert.rejects(
    fetchStandaloneIndex(older.win, signal),
    MoklyVersionError,
  );
});

test("current details live under entries and removed ones under their generation", async () => {
  const details = rawDetailFixtures();
  const index = indexFixture();
  const generation = index.comparisonUrl!.split("/").at(-2);
  const { win, requests } = fakeWindow({
    "/mokly-viewer/entries/product/browse/home.json":
      details.current["product/browse/home"],
    [`/mokly-viewer/diffs/generations/${generation}/entries/product/browse/home/retired.json`]:
      details.removed[RETIRED],
  });
  const source = standaloneDataSource(win);
  const current = await source.loadDetail(
    { path: "product/browse/home" },
    index,
    signal,
  );
  assert.equal(current.entry.path, "product/browse/home");
  const removed = await source.loadDetail(
    { path: "product/browse/home/retired", snapshotId: RETIRED },
    index,
    signal,
  );
  assert.equal(removed.entry.snapshotId, RETIRED);
  assert.deepEqual(
    requests.map((request) => request.init.credentials),
    ["omit", "omit"],
  );
  await assert.rejects(
    source.loadDetail(
      { path: "product/browse/home/retired", snapshotId: RETIRED },
      { ...index, comparisonUrl: null },
      signal,
    ),
  );
});

test("static source reads the deployment file from the catalogue root", async () => {
  const index = indexFixture();
  const { win, requests } = fakeWindow({
    "/mokly-viewer/deployment.json": {
      schemaVersion: 1,
      deploymentId: index.deploymentId,
    },
  });
  const deployment = await standaloneDataSource(win).loadDeployment!(signal);
  assert.deepEqual(deployment, {
    schemaVersion: 1,
    deploymentId: index.deploymentId,
  });
  assert.equal(requests[0]!.url, `${ORIGIN}/mokly-viewer/deployment.json`);
});

test("another deployment reloads the requested page", () => {
  const fake = fakeWindow({});
  const source = standaloneDataSource(fake.win);
  source.deploymentChanged();
  assert.equal(fake.reloads(), 1);
});

test("the descriptor is read from the live route of the same origin", async () => {
  const generation = "7".repeat(64);
  const descriptor = {
    schemaVersion: 3,
    generation,
    render: { url: "/mokly-viewer/components/render", token: "secret" },
  };
  const { win, requests } = fakeWindow({
    "/mokly-viewer/live.json": descriptor,
  });
  const live = standaloneDataSource(win).live!;
  assert.deepEqual(await live.loadDescriptor(signal), descriptor);
  assert.equal(requests[0]!.url, `${ORIGIN}/mokly-viewer/live.json`);
  assert.equal(requests[0]!.init.credentials, "omit");
  const older = fakeWindow({
    "/mokly-viewer/live.json": { ...descriptor, schemaVersion: 2 },
  });
  await assert.rejects(
    standaloneDataSource(older.win).live!.loadDescriptor(signal),
    MoklyVersionError,
  );
});

/** An EventSource stand-in the test drives by hand. */
class FakeEventSource {
  static last: FakeEventSource | undefined;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(readonly url: URL) {
    FakeEventSource.last = this;
  }
  close() {
    this.closed = true;
  }
  send(id: string, data: string) {
    this.onmessage?.({ lastEventId: id, data } as MessageEvent);
  }
}

test("each stream message carries the revision as id and the deployment as data", () => {
  const { win } = fakeWindow({});
  win.EventSource = FakeEventSource as unknown as typeof EventSource;
  const messages: [number, string][] = [];
  let unavailable = 0;
  const close = standaloneDataSource(win).live!.subscribe({
    message: (revision, deploymentId) =>
      messages.push([revision, deploymentId]),
    unavailable: () => (unavailable += 1),
  });
  const stream = FakeEventSource.last!;
  assert.equal(stream.url.href, `${ORIGIN}/mokly-viewer/events`);
  const deployment = "ab".repeat(32);
  stream.send("3", deployment);
  for (const [id, data] of [
    ["", deployment],
    ["03", deployment],
    ["-1", deployment],
    ["1.5", deployment],
    ["99999999999999999999", deployment],
    ["4", "not-a-deployment"],
    ["4", deployment.toUpperCase()],
  ])
    stream.send(id!, data!);
  assert.deepEqual(messages, [[3, deployment]]);
  stream.onerror?.();
  stream.onerror?.();
  assert.equal(unavailable, 1);
  stream.send("4", deployment);
  stream.onerror?.();
  assert.equal(unavailable, 2);
  close();
  assert.equal(stream.closed, true);
});

test("a browser without EventSource browses without live updates", () => {
  const { win } = fakeWindow({});
  let unavailable = 0;
  const close = standaloneDataSource(win).live!.subscribe({
    message: () => assert.fail("no stream exists"),
    unavailable: () => (unavailable += 1),
  });
  assert.equal(unavailable, 1);
  close();
});
