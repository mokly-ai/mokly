import assert from "node:assert/strict";
import { test } from "node:test";

import { ApiError } from "../../api/errors";
import type { ViewerSelection } from "../../viewer/host";
import { shareableScreen } from "../../viewer/screens";

const unavailable = new ApiError({
  code: "failed-precondition",
  reason: "operation-unavailable",
  message: "This operation is unavailable.",
  requestId: "request-1",
  status: 412,
});

const selection: ViewerSelection = {
  screen: "notice/draft",
  view: "all",
  viewport: "desktop",
  scheme: "light",
  search: "",
  tags: [],
};

test("only a supported listed screen can enter a Share request", () => {
  assert.equal(
    shareableScreen({ status: "loading" }, true, selection),
    undefined,
  );
  assert.equal(
    shareableScreen({ status: "error", error: unavailable }, true, selection),
    undefined,
  );
  const listed = {
    status: "ready" as const,
    value: {
      items: [
        {
          path: "product/start",
          title: "Start",
          views: [
            { viewport: "desktop" as const, colorScheme: "light" as const },
          ],
        },
        {
          path: "product/finish",
          title: "Finish",
          views: [
            { viewport: "mobile" as const, colorScheme: "light" as const },
            { viewport: "mobile" as const, colorScheme: "dark" as const },
          ],
        },
      ],
      truncated: false,
    },
  };
  assert.equal(shareableScreen(listed, true, selection), undefined);
  const start = { path: "product/start", title: "Start", scheme: "light" };
  assert.deepEqual(
    shareableScreen(listed, true, { ...selection, screen: "product/start" }),
    start,
  );
  assert.deepEqual(
    shareableScreen(listed, true, {
      ...selection,
      screen: "product/start",
      viewport: "both",
    }),
    start,
  );
  assert.equal(
    shareableScreen(listed, true, { ...selection, screen: "product/finish" }),
    undefined,
  );
  // Start has no dark view. Under Dark the viewer shows its light view, so
  // Share still offers it, and its link opens that light view.
  assert.deepEqual(
    shareableScreen(listed, true, {
      ...selection,
      screen: "product/start",
      scheme: "dark",
    }),
    start,
  );
  // Finish has both views on mobile, so under Dark its link opens the dark
  // view: the light view stands in only for a missing dark view.
  assert.deepEqual(
    shareableScreen(listed, true, {
      ...selection,
      screen: "product/finish",
      viewport: "mobile",
      scheme: "dark",
    }),
    { path: "product/finish", title: "Finish", scheme: "dark" },
  );
});

test("a capped screen list keeps an absent selection out of Share without changing it", () => {
  const state = {
    status: "ready" as const,
    value: {
      items: [
        {
          path: "product/start",
          title: "Start",
          views: [
            { viewport: "desktop" as const, colorScheme: "light" as const },
          ],
        },
      ],
      truncated: true,
    },
  };
  const before = structuredClone(selection);
  assert.equal(shareableScreen(state, true, selection), undefined);
  assert.deepEqual(selection, before);
  assert.deepEqual(
    shareableScreen(state, true, { ...selection, screen: "product/start" }),
    { path: "product/start", title: "Start", scheme: "light" },
  );
});
