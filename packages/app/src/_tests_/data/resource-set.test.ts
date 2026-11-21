import assert from "node:assert/strict";
import { test } from "node:test";

import { act, createElement, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";

import { unexpectedError } from "../../api/errors";
import { useResource } from "../../data/use-resource";
import { tabAt, withWindowAsync } from "../page-window";

type LoadedResource = ReturnType<typeof useResource<string>>;

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

async function withResource(
  load: () => Promise<string>,
  run: (current: () => LoadedResource) => Promise<void>,
): Promise<void> {
  const page = Object.assign(new EventTarget(), {
    location: tabAt(),
    event: undefined,
    HTMLIFrameElement: class {},
  });
  const fragment = Object.assign(new EventTarget(), {
    nodeType: 11,
    nodeName: "#document-fragment",
    ownerDocument: new EventTarget(),
    textContent: "",
    firstChild: null,
  });
  let committed: LoadedResource | undefined;
  function Probe() {
    const resource = useResource(load, "billing");
    useLayoutEffect(() => {
      committed = resource;
    });
    return null;
  }
  const root = createRoot(fragment as unknown as DocumentFragment);
  await withWindowAsync(page, async () => {
    try {
      await act(async () => root.render(createElement(Probe)));
      await run(() => {
        assert.ok(committed);
        return committed;
      });
    } finally {
      await act(async () => root.unmount());
    }
  });
}

test("set keeps its value when an older read succeeds and permits a later reload", async () => {
  const older = Promise.withResolvers<string>();
  const later = Promise.withResolvers<string>();
  let reads = 0;
  await withResource(
    () => (++reads === 1 ? older.promise : later.promise),
    async (current) => {
      assert.equal(reads, 1);
      assert.deepEqual(current().state, { status: "loading" });

      await act(async () => current().set("Team"));
      assert.deepEqual(current().state, { status: "ready", value: "Team" });

      await act(async () => older.resolve("Free"));
      assert.deepEqual(current().state, { status: "ready", value: "Team" });

      await act(async () => current().reload());
      assert.equal(reads, 2);
      assert.deepEqual(current().state, {
        status: "ready",
        value: "Team",
        refreshing: true,
      });
      await act(async () => later.resolve("Updated Team"));
      assert.deepEqual(current().state, {
        status: "ready",
        value: "Updated Team",
      });
    },
  );
});

test("set keeps its value when an older read fails", async () => {
  const older = Promise.withResolvers<string>();
  await withResource(
    () => older.promise,
    async (current) => {
      assert.deepEqual(current().state, { status: "loading" });

      await act(async () => current().set("Team"));
      assert.deepEqual(current().state, { status: "ready", value: "Team" });

      await act(async () => older.reject(unexpectedError()));
      assert.deepEqual(current().state, { status: "ready", value: "Team" });
    },
  );
});
