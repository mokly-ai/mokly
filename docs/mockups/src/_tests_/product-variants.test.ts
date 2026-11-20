/**
 * Which situations each product screen draws as its variants and which stand
 * beside it as screens of their own, as `product-inventory.ts` derives them
 * from the inventory's declarations.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { screenVariantLimit } from "./catalogue-variants";
import { expectedProductScreens } from "./product-inventory";

test("each product screen keeps its states and situations within four variants", () => {
  const screens = expectedProductScreens();
  for (const screen of screens)
    assert.ok(screen.variants.length <= screenVariantLimit, screen.path);
  const byId = new Map(screens.map((screen) => [screen.path, screen.variants]));
  assert.deepEqual(byId.get("product/viewer/switcher"), [
    "product/viewer/switcher/empty",
    "product/viewer/switcher/loading",
    "product/viewer/switcher/error",
    "product/viewer/switcher/no-branches",
  ]);
  assert.deepEqual(byId.get("product/account/sign-in"), [
    "product/account/sign-in/empty",
    "product/account/sign-in/loading",
    "product/account/sign-in/error",
  ]);
  assert.deepEqual(byId.get("product/account/sign-in/github-refused"), []);
  assert.deepEqual(byId.get("product/account/sign-in/desktop"), [
    "product/account/sign-in/desktop/waiting",
  ]);
  assert.deepEqual(byId.get("product/account/connect-desktop"), [
    "product/account/connect-desktop/empty",
    "product/account/connect-desktop/loading",
    "product/account/connect-desktop/error",
    "product/account/connect-desktop/opened",
  ]);
  assert.deepEqual(
    byId.get("product/account/connect-desktop/session-loading"),
    [],
  );
  // Each window drawing of a GitHub action is its screen's fourth variant,
  // while the screen's other situations stay screens beside it.
  assert.deepEqual(byId.get("product/settings/account"), [
    "product/settings/account/empty",
    "product/settings/account/loading",
    "product/settings/account/error",
    "product/settings/account/desktop",
  ]);
  assert.deepEqual(byId.get("product/settings/github"), [
    "product/settings/github/empty",
    "product/settings/github/loading",
    "product/settings/github/error",
    "product/settings/github/desktop",
  ]);
  assert.deepEqual(byId.get("product/settings/github/suspended"), []);
  assert.deepEqual(byId.get("product/account/install-app"), [
    "product/account/install-app/empty",
    "product/account/install-app/loading",
    "product/account/install-app/error",
    "product/account/install-app/desktop",
  ]);
  assert.deepEqual(byId.get("product/account/install-app/member"), []);
  assert.deepEqual(byId.get("product/account/invitation-accept"), [
    "product/account/invitation-accept/empty",
    "product/account/invitation-accept/loading",
    "product/account/invitation-accept/error",
  ]);
  assert.deepEqual(byId.get("product/account/invitation-accept/expired"), []);
  assert.deepEqual(
    byId.get("product/account/invitation-accept/open-error"),
    [],
  );
  assert.deepEqual(byId.get("product/settings/tokens/create"), [
    "product/settings/tokens/create/loading",
    "product/settings/tokens/create/error",
    "product/settings/tokens/create/reveal",
    "product/settings/tokens/create/copy",
  ]);
  assert.deepEqual(byId.get("product/settings/workspace/slug-recovery"), [
    "product/settings/workspace/slug-recovery/error",
  ]);
  assert.deepEqual(byId.get("product/settings/project"), [
    "product/settings/project/empty",
    "product/settings/project/loading",
    "product/settings/project/error",
    "product/settings/project/no-builds",
  ]);
  assert.deepEqual(byId.get("product/viewer/pull-request"), [
    "product/viewer/pull-request/empty",
    "product/viewer/pull-request/loading",
    "product/viewer/pull-request/error",
    "product/viewer/pull-request/publishing",
  ]);
  assert.deepEqual(byId.get("product/viewer/pull-request/closed"), [
    "product/viewer/pull-request/closed/merged",
  ]);
  assert.deepEqual(byId.get("product/viewer/standalone/publish"), [
    "product/viewer/standalone/publish/pull-request",
    "product/viewer/standalone/publish/reader",
    "product/viewer/standalone/publish/publishing",
    "product/viewer/standalone/publish/reader-pull-request",
  ]);
  assert.deepEqual(byId.get("product/viewer/standalone/build"), [
    "product/viewer/standalone/build/empty",
    "product/viewer/standalone/build/loading",
    "product/viewer/standalone/build/error",
    "product/viewer/standalone/build/published",
  ]);
  assert.deepEqual(byId.get("product/viewer/standalone/build/unreadable"), []);
  assert.deepEqual(byId.get("product/viewer/standalone/build/lockfile"), []);
  assert.deepEqual(byId.get("product/viewer/standalone/build/refused"), [
    "product/viewer/standalone/build/refused/cancel",
  ]);
  assert.deepEqual(byId.get("product/viewer/standalone/build/reader"), [
    "product/viewer/standalone/build/reader/plan",
    "product/viewer/standalone/build/reader/plan-loading",
    "product/viewer/standalone/build/reader/queued",
    "product/viewer/standalone/build/reader/running",
  ]);
  assert.deepEqual(byId.get("product/viewer/standalone/publish-refused"), [
    "product/viewer/standalone/publish-refused/pull-request",
  ]);
  assert.deepEqual(byId.get("product/viewer/pull-request/fork"), []);
  assert.deepEqual(byId.get("product/viewer/pull-request/plan"), [
    "product/viewer/pull-request/plan/reader",
  ]);
});
