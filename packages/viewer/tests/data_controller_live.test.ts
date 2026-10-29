import assert from "node:assert/strict";
import { test } from "node:test";

import type { CatalogueReadModel } from "../src/catalogue/types.js";
import { MoklyVersionError } from "../src/catalogue/version_error.js";
import { routeKey } from "../src/shell/data_requests.js";

import { detailFixture, indexFixture } from "./catalogue_v9_fixture.js";
import { controllerFixture } from "./data_controller_fixture.js";
import { flush, liveDescriptor } from "./data_fakes.js";

const GENERATION = "2".repeat(64);
const NEXT_GENERATION = "3".repeat(64);
const OTHER = "4".repeat(64);
const HOME = "product/browse/home";

function liveIndex(revision = 1, generation = GENERATION): CatalogueReadModel {
  return indexFixture((raw) => {
    raw.revision = revision;
    raw.live = { generation };
  });
}

function connected(path = `/view/${HOME}/`) {
  const fixture = controllerFixture(liveIndex(), { live: true, path });
  const disconnect = fixture.controller.connect();
  return { ...fixture, disconnect, deployment: liveIndex().deploymentId };
}

/** Read the installed descriptor anew after each step. */
function installed(fixture: ReturnType<typeof connected>) {
  return fixture.controller.descriptor;
}

function revised(path: string, revision: number) {
  return { ...detailFixture({ path }), revision };
}

test("a live index loads its descriptor and installs the capability", async () => {
  const fixture = connected();
  assert.equal(fixture.live.subscriptions, 1);
  fixture.live.descriptor().resolve(liveDescriptor(GENERATION));
  await flush();
  assert.deepEqual(fixture.controller.descriptor, liveDescriptor(GENERATION));
  assert.notEqual(fixture.controller.live, undefined);
  fixture.disconnect();
  assert.equal(fixture.live.closed, 1);
  assert.equal(fixture.controller.descriptor, undefined);
});

test("a descriptor of another generation waits for the next message", async () => {
  const fixture = connected();
  fixture.live.descriptor().resolve(liveDescriptor(OTHER));
  await flush();
  assert.equal(fixture.controller.descriptor, undefined);
  fixture.live.listener!.message(1, fixture.deployment);
  fixture.live.descriptor().resolve(liveDescriptor(GENERATION));
  await flush();
  assert.equal(installed(fixture)?.generation, GENERATION);
  assert.deepEqual(fixture.warnings, []);
});

test("a failed descriptor warns, keeps browsing, and retries on the next message", async () => {
  const fixture = connected();
  fixture.live.descriptor().reject(new Error("offline"));
  await flush();
  assert.deepEqual(fixture.warnings, ["Live prop editing is unavailable."]);
  assert.equal(fixture.controller.live, undefined);
  assert.equal(fixture.controller.editing, "failed");
  fixture.live.listener!.message(1, fixture.deployment);
  assert.equal(fixture.live.descriptors.length, 2);
  assert.equal(fixture.source.indexes.length, 0);
});

test("a descriptor of another version shows the version error state", async () => {
  const fixture = connected();
  const error = new MoklyVersionError("live", 2, 3);
  fixture.live.descriptor().reject(error);
  await flush();
  assert.deepEqual(fixture.versionErrors, [error]);
  assert.deepEqual(fixture.warnings, []);
  assert.equal(fixture.controller.live, undefined);
});

test("a message from another deployment replaces the catalogue once", () => {
  const fixture = connected();
  const listener = fixture.live.listener!;
  listener.message(9, OTHER);
  assert.equal(fixture.controller.replaced, true);
  assert.equal(fixture.source.deploymentChanges, 1);
  // The stream closes. A message that it had already queued changes nothing.
  assert.equal(fixture.live.listener, undefined);
  listener.message(10, OTHER);
  assert.equal(fixture.source.deploymentChanges, 1);
  assert.equal(fixture.source.indexes.length, 0);
});

test("a message at or below the installed revision changes nothing", () => {
  const fixture = connected();
  fixture.live.listener!.message(1, fixture.deployment);
  fixture.live.listener!.message(0, fixture.deployment);
  assert.equal(fixture.source.indexes.length, 0);
  assert.equal(fixture.commits.length, 0);
});

test("a newer revision refreshes the index and the route's details in one commit", async () => {
  const fixture = connected();
  fixture.live.listener!.message(2, fixture.deployment);
  const newer = liveIndex(2);
  fixture.source.index().resolve(newer);
  await flush();
  fixture.source.detail(HOME).resolve(revised(HOME, 2));
  await flush();
  assert.equal(fixture.commits.length, 1);
  assert.equal(fixture.controller.snapshot.index, newer);
  assert.equal(fixture.controller.snapshot.details.size, 1);
  assert.equal(fixture.source.deploymentChanges, 0);
  assert.equal(fixture.controller.refreshFailed, undefined);
});

test("a newer message cancels the refresh still in flight", () => {
  const fixture = connected();
  fixture.live.listener!.message(2, fixture.deployment);
  const first = fixture.source.index();
  fixture.live.listener!.message(3, fixture.deployment);
  assert.equal(first.signal.aborted, true);
  assert.equal(fixture.source.indexes.length, 2);
});

test("a refresh that cannot settle shows the route unavailable until a retry", async () => {
  const fixture = connected();
  fixture.live.listener!.message(3, fixture.deployment);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    fixture.source.index().resolve(liveIndex(2));
    await flush();
    fixture.source.detail(HOME).resolve(revised(HOME, 2));
    await flush();
  }
  assert.equal(fixture.commits.length, 0);
  assert.equal(fixture.controller.refreshFailed, routeKey(fixture.route()));
  fixture.controller.retryRefresh();
  fixture.source.index().resolve(liveIndex(3));
  await flush();
  fixture.source.detail(HOME).resolve(revised(HOME, 3));
  await flush();
  assert.equal(fixture.commits.length, 1);
  assert.equal(fixture.controller.refreshFailed, undefined);
});

test("a refresh from another deployment replaces the catalogue", async () => {
  const fixture = connected();
  fixture.live.listener!.message(2, fixture.deployment);
  fixture.source.index().resolve(
    indexFixture((raw) => {
      raw.revision = 2;
      raw.live = { generation: GENERATION };
      raw.deploymentId = OTHER;
    }),
  );
  await flush();
  assert.equal(fixture.controller.replaced, true);
  assert.equal(fixture.source.deploymentChanges, 1);
  assert.equal(fixture.commits.length, 0);
});

test("a replacement ends the live connection, so no message or retry loads an index", async () => {
  const fixture = connected();
  fixture.navigate(`/view/${HOME}/`);
  fixture.source.detail(HOME).resolve({
    ...detailFixture({ path: HOME }),
    revision: 1,
    detailId: OTHER,
  });
  await flush();
  assert.equal(fixture.controller.replaced, true);
  // The stream closes, so a later message of the installed deployment
  // cannot start a refresh, and neither can a retry or a new connection.
  assert.equal(fixture.live.closed, 1);
  assert.equal(fixture.live.listener, undefined);
  fixture.controller.retryRefresh();
  fixture.controller.connect();
  assert.equal(fixture.live.subscriptions, 1);
  assert.equal(fixture.source.indexes.length, 0);
});

test("a new render generation keeps the installed capability until its replacement installs", async () => {
  const fixture = connected();
  fixture.live.descriptor().resolve(liveDescriptor(GENERATION));
  await flush();
  fixture.live.listener!.message(2, fixture.deployment);
  fixture.source.index().resolve(liveIndex(2, NEXT_GENERATION));
  await flush();
  fixture.source.detail(HOME).resolve(revised(HOME, 2));
  await flush();
  assert.equal(installed(fixture)?.generation, GENERATION);
  assert.equal(fixture.controller.editing, "ready");
  assert.notEqual(fixture.controller.live, undefined);
  fixture.live.descriptor().resolve(liveDescriptor(NEXT_GENERATION));
  await flush();
  assert.equal(installed(fixture)?.generation, NEXT_GENERATION);
});

test("a failed refetch keeps the installed capability and editing ready", async () => {
  const fixture = connected();
  fixture.live.descriptor().resolve(liveDescriptor(GENERATION));
  await flush();
  fixture.live.listener!.message(2, fixture.deployment);
  fixture.source.index().resolve(liveIndex(2, NEXT_GENERATION));
  await flush();
  fixture.source.detail(HOME).resolve(revised(HOME, 2));
  await flush();
  fixture.live.descriptor().reject(new Error("offline"));
  await flush();
  assert.equal(installed(fixture)?.generation, GENERATION);
  assert.equal(fixture.controller.editing, "ready");
  fixture.live.listener!.message(2, fixture.deployment);
  fixture.live.descriptor().resolve(liveDescriptor(NEXT_GENERATION));
  await flush();
  assert.equal(installed(fixture)?.generation, NEXT_GENERATION);
});

test("editing prepares until the first descriptor installs", async () => {
  const fixture = connected();
  const versions = [fixture.controller.version()];
  assert.equal(fixture.controller.editing, "preparing");
  fixture.live.descriptor().resolve(liveDescriptor(OTHER));
  await flush();
  assert.equal(fixture.controller.editing, "preparing");
  fixture.live.listener!.message(1, fixture.deployment);
  fixture.live.descriptor().resolve(liveDescriptor(GENERATION));
  await flush();
  versions.push(fixture.controller.version());
  assert.equal(fixture.controller.editing, "ready");
  assert.ok(versions[1]! > versions[0]!);
});

test("a failed start shows until Try again loads the descriptor again", async () => {
  const fixture = connected();
  fixture.live.descriptor().reject(new Error("offline"));
  await flush();
  assert.equal(fixture.controller.editing, "failed");
  const failed = fixture.controller.version();
  fixture.controller.retryDescriptor();
  assert.equal(fixture.live.descriptors.length, 2);
  assert.equal(fixture.controller.editing, "preparing");
  assert.ok(fixture.controller.version() > failed);
  fixture.controller.retryDescriptor();
  assert.equal(fixture.live.descriptors.length, 2);
  fixture.live.descriptor().resolve(liveDescriptor(GENERATION));
  await flush();
  assert.equal(fixture.controller.editing, "ready");
});

test("editing prepares before the shell connects, and has no status without a live index", () => {
  const unconnected = controllerFixture(liveIndex(), { live: true });
  assert.equal(unconnected.controller.editing, "preparing");
  unconnected.controller.retryDescriptor();
  assert.equal(unconnected.live.descriptors.length, 0);
  const published = controllerFixture(indexFixture(), { live: true });
  assert.equal(published.controller.editing, undefined);
  assert.equal(controllerFixture(liveIndex()).controller.editing, undefined);
});

test("an unavailable stream warns once and browsing continues", () => {
  const fixture = connected();
  fixture.live.listener!.unavailable();
  fixture.live.listener!.unavailable();
  assert.deepEqual(fixture.warnings, [
    "Live catalogue updates are unavailable.",
  ]);
  assert.equal(fixture.source.deploymentChanges, 0);
});
