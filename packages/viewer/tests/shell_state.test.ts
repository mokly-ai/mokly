import assert from "node:assert/strict";
import { test } from "node:test";

import { viewHref } from "../src/navigation/routes.js";
import { frameNavigationHref } from "../src/shell/frame_event_router.js";
import { routeFromUrl, routeHref } from "../src/shell/routes.js";
import { canonicalRouteUrl } from "../src/shell/store_browser_urls.js";

import { catalogue, model } from "./shell_state_fixture.js";

test("shell routes derive entry targets, fragments, and misses from view URLs", () => {
  const screen = routeFromUrl(
    catalogue,
    new URL("https://example.test/view/product/browse/home/?fragment=hero"),
  );
  assert.equal(screen.view.kind, "target");
  assert.equal(screen.fragment, "hero");

  const variant = routeFromUrl(
    catalogue,
    new URL("https://example.test/view/components/action/default/"),
  );
  assert.equal(variant.view.kind, "target");
  assert.equal(
    variant.view.kind === "target" ? variant.view.target.entry.path : undefined,
    "components/action/default",
  );
  assert.equal(
    routeFromUrl(catalogue, new URL("https://example.test/id/home")).view.kind,
    "missing",
  );
  assert.equal(
    routeFromUrl(catalogue, new URL("https://example.test/id/product")).view
      .kind,
    "missing",
  );
  assert.equal(
    routeFromUrl(
      catalogue,
      new URL("https://example.test/view/not-present.html"),
    ).view.kind,
    "missing",
  );
});

test("logical frame destinations resolve through catalogue identity", () => {
  assert.equal(
    frameNavigationHref(catalogue, {
      activation: "primary",
      fragment: "hero",
      screenPath: "product/browse/home",
      target: { kind: "self" },
    }),
    "/view/product/browse/home/?fragment=hero",
  );
  const unknown = frameNavigationHref(catalogue, {
    activation: "primary",
    screenPath: "not-present",
    target: { kind: "self" },
  });
  assert.equal(unknown, "/view/not-present/");
  assert.equal(
    routeFromUrl(catalogue, new URL(unknown, "https://example.test")).view.kind,
    "missing",
  );
});

test("an inferred historical route is pinned in the installed browser URL", () => {
  const historical = model.removedEntries[0]!;
  assert.ok(historical.snapshotId);
  const bare = new URL(
    `https://example.test${viewHref(historical.entry.path)}`,
  );
  const route = routeFromUrl(catalogue, bare);
  assert.equal(route.snapshot, historical.snapshotId);
  assert.equal(
    canonicalRouteUrl(bare, route).href,
    `${bare.href}?snapshot=${historical.snapshotId}`,
  );

  const mismatched = new URL(`${bare.href}?snapshot=${"f".repeat(64)}`);
  assert.equal(
    canonicalRouteUrl(mismatched, routeFromUrl(catalogue, mismatched)).href,
    mismatched.href,
  );
});

test("provider-normalized routes resolve through the parser and catalogue", () => {
  assert.equal(
    routeFromUrl(
      catalogue,
      new URL("https://example.test/view/product/browse/home?fragment=hero"),
    ).view.kind,
    "target",
  );
  assert.equal(
    routeFromUrl(
      catalogue,
      new URL("https://example.test/view/components/action"),
    ).view.kind,
    "target",
  );
});

test("shell routes serialize workspace state without a second entry identity", () => {
  assert.equal(
    routeHref("components/action/default", undefined, {
      colorScheme: "dark",
      viewport: "mobile",
    }),
    "/view/components/action/default/?viewport=mobile&scheme=dark",
  );
});

test("shell routes parse explicit view axes independently", () => {
  const valid = routeFromUrl(
    catalogue,
    new URL(
      "https://example.test/view/product/browse/home/?viewport=desktop&scheme=dark",
    ),
  );
  assert.equal(valid.viewport, "desktop");
  assert.equal(valid.colorScheme, "dark");

  const partial = routeFromUrl(
    catalogue,
    new URL(
      "https://example.test/view/product/browse/home/?viewport=invalid&scheme=dark",
    ),
  );
  assert.equal(partial.viewport, undefined);
  assert.equal(partial.colorScheme, "dark");

  const repeated = routeFromUrl(
    catalogue,
    new URL(
      "https://example.test/view/product/browse/home/?viewport=mobile&scheme=light&scheme=dark",
    ),
  );
  assert.equal(repeated.viewport, "mobile");
  assert.equal(repeated.colorScheme, undefined);
});
