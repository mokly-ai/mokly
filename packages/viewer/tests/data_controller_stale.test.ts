import assert from "node:assert/strict";
import { test } from "node:test";

import type { CatalogueReadModel } from "../src/catalogue/types.js";
import {
  ComponentRenderError,
  type ComponentRenderRequest,
  type RenderErrorCode,
} from "../src/components/render_types.js";
import { routeKey } from "../src/shell/data_requests.js";

import { detailFixture, indexFixture } from "./catalogue_v8_fixture.js";
import { controllerFixture } from "./data_controller_fixture.js";
import { flush, liveDescriptor } from "./data_fakes.js";

const GENERATION = "2".repeat(64);
const HOME = "product/browse/home";
const OTHER = "4".repeat(64);
const DESCRIPTOR = liveDescriptor(GENERATION);

function liveIndex(revision: number): CatalogueReadModel {
  return indexFixture((raw) => {
    raw.revision = revision;
    raw.live = { generation: GENERATION };
  });
}

/** A connected controller on the home route with its capability installed. */
async function editing() {
  const fixture = controllerFixture(liveIndex(1), {
    live: true,
    path: `/view/${HOME}/`,
  });
  const disconnect = fixture.controller.connect();
  fixture.live.descriptor().resolve(DESCRIPTOR);
  await flush();
  return { ...fixture, disconnect };
}

type Fixture = Awaited<ReturnType<typeof editing>>;

function request(revision: number): ComponentRenderRequest {
  return {
    entryPath: HOME,
    viewport: "desktop",
    colorScheme: "light",
    revision,
    pageId: "0".repeat(32),
    overrides: {},
  };
}

/** Start one render through the controller's transport; Serve answers later. */
function render(fixture: Fixture, revision: number) {
  const rendered = fixture.controller.live!.render(
    DESCRIPTOR,
    request(revision),
    new AbortController().signal,
  );
  return { rendered, answer: fixture.live.renders.at(-1)! };
}

/** Serve answers one render with a failure; the edit owner still receives it. */
async function fail(
  fixture: Fixture,
  revision: number,
  code: RenderErrorCode = "stale-revision",
) {
  const { rendered, answer } = render(fixture, revision);
  answer.reject(new ComponentRenderError(code, "The render failed."));
  await assert.rejects(
    rendered,
    (error) => error instanceof ComponentRenderError && error.code === code,
  );
}

/** Answer the pending refresh with one index and the home route's detail. */
async function publish(fixture: Fixture, index: CatalogueReadModel) {
  fixture.source.index().resolve(index);
  await flush();
  fixture.source
    .detail(HOME)
    .resolve({ ...detailFixture({ path: HOME }), revision: index.revision });
  await flush();
}

test("a 409 refreshes the index once and adopts the newer state without the event stream", async () => {
  const fixture = await editing();
  fixture.live.listener!.unavailable();
  await fail(fixture, 1);
  await fail(fixture, 1);
  assert.equal(fixture.source.indexes.length, 1);
  const newer = liveIndex(2);
  await publish(fixture, newer);
  assert.equal(fixture.commits.length, 1);
  assert.equal(fixture.controller.snapshot.index, newer);
  assert.equal(fixture.controller.refreshFailed, undefined);
});

test("a 409 whose refresh finds no newer revision shows the route unavailable with retry", async () => {
  const fixture = await editing();
  await fail(fixture, 1);
  await publish(fixture, liveIndex(1));
  await publish(fixture, liveIndex(1));
  assert.equal(fixture.commits.length, 0);
  assert.equal(fixture.controller.refreshFailed, routeKey(fixture.route()));
});

test("a 409 starts no refresh while one loads, after an adoption, after disconnect, or for other failures", async () => {
  const fixture = await editing();
  fixture.live.listener!.message(
    2,
    fixture.controller.snapshot.index.deploymentId,
  );
  await fail(fixture, 1);
  assert.equal(fixture.source.indexes.length, 1);
  await publish(fixture, liveIndex(2));
  assert.equal(fixture.controller.snapshot.index.revision, 2);
  await fail(fixture, 1);
  await fail(fixture, 2, "render-failed");
  await fail(fixture, 2, "invalid-input");
  assert.equal(fixture.source.indexes.length, 1);
  const late = render(fixture, 2);
  fixture.disconnect();
  late.answer.reject(new ComponentRenderError("stale-revision", "Stale."));
  await assert.rejects(late.rendered);
  assert.equal(fixture.source.indexes.length, 1);
});

test("a 409 that arrives after a replacement starts no refresh", async () => {
  const fixture = await editing();
  // A render of the installed revision is in flight when a detail of
  // another deployment replaces the catalogue.
  const { rendered, answer } = render(fixture, 1);
  fixture.navigate(`/view/${HOME}/`);
  fixture.source.detail(HOME).resolve({
    ...detailFixture({ path: HOME }),
    revision: 1,
    detailId: OTHER,
  });
  await flush();
  assert.equal(fixture.controller.replaced, true);
  answer.reject(
    new ComponentRenderError("stale-revision", "The render failed."),
  );
  await assert.rejects(rendered);
  await flush();
  assert.equal(fixture.source.indexes.length, 0);
});

test("the controller's transport forwards every call to Serve's transport", async () => {
  const fixture = await editing();
  const live = fixture.controller.live!;
  const { rendered, answer } = render(fixture, 1);
  assert.deepEqual(answer.input, {
    descriptor: DESCRIPTOR,
    request: request(1),
  });
  const success = {
    renderId: "render",
    revision: 1,
    previewUrl: "/mokly-viewer/components/renders/render/",
    props: {},
  } as unknown as Awaited<typeof rendered>;
  answer.resolve(success);
  assert.equal(await rendered, success);
  assert.equal(
    await live.previewExpired("/x", new AbortController().signal),
    false,
  );
  void live.loadDescriptor(new AbortController().signal);
  assert.equal(fixture.live.descriptors.length, 2);
  live.subscribe({ message: () => undefined, unavailable: () => undefined });
  assert.equal(fixture.live.subscriptions, 2);
  assert.equal(fixture.source.indexes.length, 0);
});
