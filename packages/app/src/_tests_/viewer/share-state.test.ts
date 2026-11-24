import assert from "node:assert/strict";
import { test } from "node:test";

import { ApiError } from "../../api/errors";
import type { Screen, ShareLink } from "../../api/types";
import type { PagedItems } from "../../data/publications";
import type { Resource } from "../../data/use-resource";
import type { ViewerSelection } from "../../viewer/host";
import { shareLinkState } from "../../viewer/share-state";

const selection: ViewerSelection = {
  screen: "product/start",
  view: "all",
  viewport: "both",
  scheme: "light",
  search: "",
  tags: [],
};
const screen: Screen = {
  path: "product/start",
  title: "Start",
  views: [{ viewport: "desktop", colorScheme: "light" }],
};
const failure = new ApiError({
  code: "unavailable",
  reason: "operation-unavailable",
  message: "Screens could not load.",
  requestId: "request-1",
  status: 503,
});
const publicationLink: ShareLink = {
  url: "https://app.example/publications/p1",
  access: "public",
};
const input = {
  publicationId: "p1",
  comparable: true,
  selection,
  defaults: { scheme: "light" as const, publication: true },
};

test("Share hides a held publication link while selected-screen membership loads", () => {
  const result = shareLinkState(
    { ...input, walk: { status: "loading" } },
    {
      key: "viewer-share:p1:::",
      state: { status: "ready", value: publicationLink },
    },
  );
  assert.equal(result.request, undefined);
  assert.deepEqual(result.visible, { status: "loading" });
});

test("a loaded screen requests its view and hides the previous link", () => {
  for (const { scheme, sharedScheme } of [
    { scheme: "light", sharedScheme: undefined },
    { scheme: "dark", sharedScheme: "light" },
  ] as const) {
    const current = {
      ...input,
      selection: { ...selection, scheme },
      walk: {
        status: "ready" as const,
        value: { items: [screen], truncated: false },
      },
    };
    const result = shareLinkState(current, {
      key: "viewer-share:p1:::",
      state: { status: "ready", value: publicationLink },
    });
    assert.equal(result.screen, "product/start");
    assert.deepEqual(result.request?.selection, {
      screen: "product/start",
      viewport: undefined,
      scheme: sharedScheme,
    });
    assert.deepEqual(result.visible, { status: "loading" });
    const ready: Resource<ShareLink> = {
      status: "ready",
      value: {
        url: "https://app.example/publications/p1?catalogueScreen=product%2Fstart",
        access: "public",
      },
    };
    assert.deepEqual(
      shareLinkState(current, { key: result.key, state: ready }).visible,
      ready,
    );
  }
});

test("failed or capped screen membership requests only the supported selection", () => {
  const cases: {
    name: string;
    walk: Resource<PagedItems<Screen>>;
    expected?: string;
  }[] = [
    { name: "failed", walk: { status: "error", error: failure } },
    {
      name: "capped with selection",
      walk: { status: "ready", value: { items: [screen], truncated: true } },
      expected: "product/start",
    },
    {
      name: "capped without selection",
      walk: { status: "ready", value: { items: [], truncated: true } },
    },
  ];
  for (const { name, walk, expected } of cases) {
    const before = structuredClone(selection);
    const result = shareLinkState({ ...input, walk });
    assert.deepEqual(
      result.request?.selection,
      { screen: expected, viewport: undefined, scheme: undefined },
      name,
    );
    assert.deepEqual(selection, before, name);
  }
});

test("Share prepares an unresolved entry and keeps the resolved empty guard", () => {
  for (const { publication, empty } of [
    { publication: undefined, empty: false },
    { publication: false, empty: true },
  ] as const) {
    const result = shareLinkState({
      ...input,
      publicationId: undefined,
      defaults: { scheme: "light", publication },
      walk: { status: "loading" },
    });
    assert.equal(result.empty, empty);
    assert.equal(result.request, undefined);
    assert.deepEqual(result.visible, { status: "loading" });
  }
});

test("sharing a whole publication does not wait for screen membership", () => {
  for (const change of [
    { comparable: false },
    { selection: { ...selection, screen: undefined } },
  ]) {
    const result = shareLinkState({
      ...input,
      ...change,
      walk: { status: "loading" },
    });
    assert.deepEqual(result.request?.selection, {
      screen: undefined,
      viewport: undefined,
      scheme: undefined,
    });
  }
});
