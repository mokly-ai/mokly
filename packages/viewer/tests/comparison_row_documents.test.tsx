/**
 * The pane documents of each compared row, under the comparison panes
 * lifecycle: each row presents and cancels its own documents, a row whose
 * request failed reads failed, a renewing row loads nothing new, and the
 * accepted documents outlast Inspect.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { act, renderHook } from "@testing-library/react";

import { snapshotViewPath } from "../src/navigation/routes.js";
import type { ComparisonEnvironment } from "../src/shell/comparison_context.js";
import type { ComparisonGenerations } from "../src/shell/use_comparison.js";
import {
  useComparisonDocuments,
  type ComparisonRowDocuments,
} from "../src/shell/use_comparison_documents.js";

import {
  ACTION,
  generationRoot,
  ORIGIN,
  OUTLINE,
} from "./comparison_lifecycle_harness.js";
import { flush } from "./data_fakes.js";
import { unregisterDom } from "./dom_teardown.js";
import { ShellStoreFixture } from "./shell_markup.js";

const UNAVAILABLE = "The comparison is unavailable.";
const action = { url: generationRoot("action-1") };
const outline = { url: generationRoot("outline-1") };

/** A row's documents of one side and scheme beneath its generation. */
function address(
  root: string,
  side: "after" | "before",
  path: string,
  scheme: "dark" | "light" = "light",
): string {
  return new URL(snapshotViewPath(side, path, "desktop", scheme), root).href;
}

/** Both sides of a row's desktop view of one scheme. */
function sides(
  root: string,
  path: string,
  scheme: "dark" | "light" = "light",
): string[] {
  return [
    address(root, "before", path, scheme),
    address(root, "after", path, scheme),
  ];
}

/** A host whose snapshot documents wait for the test. */
function documentHost() {
  const requests: { address: string; answer(): void; signal: AbortSignal }[] =
    [];
  const environment: ComparisonEnvironment = {
    baseUrl: ORIGIN,
    delivery: () => ({ kind: "live" }),
    fetch: (input, init) =>
      new Promise<Response>((resolve) => {
        const url = String(input);
        requests.push({
          address: url,
          answer: () => {
            const response = new Response("<!doctype html><p>Version</p>", {
              headers: { "content-type": "text/html" },
            });
            Object.defineProperty(response, "url", { value: url });
            resolve(response);
          },
          signal: init?.signal ?? new AbortController().signal,
        });
      }),
  };
  return { environment, requests };
}

interface Props {
  generations: ComparisonGenerations | undefined;
  rows: readonly ComparisonRowDocuments[];
}

function renderDocuments(environment: ComparisonEnvironment, initial: Props) {
  return renderHook(
    ({ generations, rows }: Props) => useComparisonDocuments(generations, rows),
    {
      initialProps: initial,
      wrapper: ({ children }) => (
        <ShellStoreFixture comparisonEnvironment={environment}>
          {children}
        </ShellStoreFixture>
      ),
    },
  );
}

async function answer(requests: readonly { answer(): void }[]) {
  await act(async () => {
    for (const request of requests) request.answer();
    await flush();
  });
}

test("a change to one row's documents aborts only that row's running presentation", async (t) => {
  GlobalRegistrator.register();
  t.after(unregisterDom);
  const host = documentHost();
  const generations = new Map([
    [ACTION, action],
    [OUTLINE, outline],
  ]);
  const view = renderDocuments(host.environment, {
    generations,
    rows: [
      { addresses: sides(action.url, ACTION), entry: ACTION },
      { addresses: sides(outline.url, OUTLINE), entry: OUTLINE },
    ],
  });
  try {
    await act(flush);
    assert.equal(host.requests.length, 4);
    view.rerender({
      generations,
      rows: [
        { addresses: sides(action.url, ACTION), entry: ACTION },
        { addresses: sides(outline.url, OUTLINE, "dark"), entry: OUTLINE },
      ],
    });
    assert.deepEqual(
      host.requests.slice(0, 4).map(({ signal }) => signal.aborted),
      [false, false, true, true],
    );
    await answer(host.requests.slice(0, 2));
    assert.equal(view.result.current.get(ACTION)?.status, "ready");
  } finally {
    view.unmount();
  }
});

test("a row whose request failed reads failed, also when the rows do not list it", async (t) => {
  GlobalRegistrator.register();
  t.after(unregisterDom);
  const host = documentHost();
  const generations = Object.assign(new Map([[ACTION, action]]), {
    failures: new Map([[OUTLINE, UNAVAILABLE]]),
  });
  const failed = { message: UNAVAILABLE, status: "failed" };
  const view = renderDocuments(host.environment, {
    generations,
    rows: [{ addresses: sides(action.url, ACTION), entry: ACTION }],
  });
  try {
    assert.deepEqual(view.result.current.get(OUTLINE), failed);
    view.rerender({
      generations,
      rows: [
        { addresses: sides(action.url, ACTION), entry: ACTION },
        { addresses: sides(outline.url, OUTLINE), entry: OUTLINE },
      ],
    });
    assert.deepEqual(view.result.current.get(OUTLINE), failed);
    await act(flush);
    assert.deepEqual(
      host.requests.map((request) => request.address),
      sides(action.url, ACTION),
    );
  } finally {
    view.unmount();
  }
});

test("a renewing row loads no new document until its renewal ends, and keeps showing what it accepted", async (t) => {
  GlobalRegistrator.register();
  t.after(unregisterDom);
  const host = documentHost();
  const light = sides(action.url, ACTION);
  const both = [...light, ...sides(action.url, ACTION, "dark")];
  const renewing = Object.assign(new Map([[ACTION, action]]), {
    pending: new Set([ACTION]),
  });
  const view = renderDocuments(host.environment, {
    generations: new Map([[ACTION, action]]),
    rows: [{ addresses: light, entry: ACTION }],
  });
  try {
    await answer(host.requests);
    view.rerender({
      generations: renewing,
      rows: [{ addresses: light, entry: ACTION }],
    });
    assert.equal(view.result.current.get(ACTION)?.status, "ready");
    view.rerender({
      generations: renewing,
      rows: [{ addresses: both, entry: ACTION }],
    });
    await act(flush);
    assert.equal(host.requests.length, 2);
    assert.equal(view.result.current.get(ACTION)?.status, "loading");
    view.rerender({
      generations: new Map([[ACTION, action]]),
      rows: [{ addresses: both, entry: ACTION }],
    });
    assert.deepEqual(
      host.requests.slice(2).map((request) => request.address),
      both.slice(2),
    );
    await answer(host.requests.slice(2));
    assert.equal(view.result.current.get(ACTION)?.status, "ready");
  } finally {
    view.unmount();
  }
});

test("Inspect aborts the running presentations and keeps the accepted ones for the return", async (t) => {
  GlobalRegistrator.register();
  t.after(unregisterDom);
  const host = documentHost();
  const generations = new Map([
    [ACTION, action],
    [OUTLINE, outline],
  ]);
  const rows = [
    { addresses: [address(action.url, "after", ACTION)], entry: ACTION },
    { addresses: [address(outline.url, "after", OUTLINE)], entry: OUTLINE },
  ];
  const view = renderDocuments(host.environment, { generations, rows });
  try {
    await answer(host.requests.slice(0, 1));
    view.rerender({ generations: undefined, rows });
    assert.equal(host.requests[1]!.signal.aborted, true);
    assert.deepEqual(view.result.current.get(ACTION), { status: "idle" });
    view.rerender({ generations, rows });
    assert.equal(view.result.current.get(ACTION)?.status, "ready");
    assert.deepEqual(
      host.requests.slice(2).map((request) => request.address),
      [address(outline.url, "after", OUTLINE)],
    );
  } finally {
    view.unmount();
  }
});
