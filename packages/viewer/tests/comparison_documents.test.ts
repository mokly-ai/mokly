import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  SnapshotPresentation,
  SnapshotPresentationLoader,
} from "../src/previews/presentation.js";
import type { ReviewResult, ViewReview } from "../src/review/types.js";
import { createComparisonDocuments } from "../src/shell/comparison_documents.js";
import type { LoadedComparison } from "../src/shell/comparison_request.js";
import {
  selectedComparisonDocuments,
  selectedComparisonViews,
} from "../src/shell/comparison_selection.js";
import type { ComparisonPresentation } from "../src/shell/use_comparison.js";

const GENERATION = "https://catalogue.test/__mokly/diffs/__generations/one/";

function view(
  viewport: "desktop" | "mobile",
  colorScheme: "dark" | "light",
  sides: readonly ("after" | "before")[] = ["before", "after"],
): ViewReview {
  return {
    colorScheme,
    ignoredIds: [],
    state:
      sides.length === 2
        ? "changed"
        : sides.includes("before")
          ? "removed"
          : "added",
    viewport,
  };
}

function comparison(
  views: readonly ViewReview[],
  generation = GENERATION,
): LoadedComparison {
  const address = { path: "home", title: "Home" };
  const result: ReviewResult = {
    baseCommit: "a".repeat(40),
    baseRef: "origin/main",
    changedPaths: [],
    ignoredImpact: [],
    schemaVersion: 5 as const,
    screens: [
      {
        after: address,
        before: address,
        path: "home",
        state: "changed",
        title: "Home",
        views,
      },
    ],

    components: [],
    changes: [
      {
        after: address,
        before: address,
        kind: "screen",
        reasons: [{ kind: "material" }],
      },
    ],
    affectedConsumers: [],
  };
  return { result, url: `${generation}review.json` };
}

function presentation(
  fields: Partial<ComparisonPresentation> = {},
): ComparisonPresentation {
  return {
    colorScheme: "light",
    mode: "overlay",
    requestedColorScheme: "light",
    viewport: "both",
    ...fields,
  };
}

function fakeLoader(fail?: (address: string) => boolean) {
  const loads: string[] = [];
  const loader: SnapshotPresentationLoader = {
    async load(address, signal) {
      loads.push(address);
      signal.throwIfAborted();
      if (fail?.(address)) throw new Error("The comparison is unavailable.");
      return { snapshotAddress: address, srcdoc: `<p>${address}</p>` };
    },
  };
  return { loader, loads };
}

test("selected views resolve both sides beneath the comparison generation", () => {
  const loaded = comparison([
    view("mobile", "light"),
    view("desktop", "light"),
    view("desktop", "dark", ["before"]),
  ]);
  const both = selectedComparisonViews(
    loaded,
    presentation(),
    "screen",
    "home",
  );
  assert.deepEqual(selectedComparisonDocuments(both), [
    `${GENERATION}snapshots/before/home/index.mobile.html`,
    `${GENERATION}snapshots/after/home/index.mobile.html`,
    `${GENERATION}snapshots/before/home/index.desktop.html`,
    `${GENERATION}snapshots/after/home/index.desktop.html`,
  ]);
  const dark = selectedComparisonViews(
    loaded,
    presentation({ colorScheme: "dark", viewport: "desktop" }),
    "screen",
    "home",
  );
  assert.equal(dark?.[0]?.mode, "side");
  assert.deepEqual(selectedComparisonDocuments(dark), [
    `${GENERATION}snapshots/before/home/index.desktop.dark.html`,
  ]);
  const fallback = selectedComparisonViews(
    loaded,
    presentation({ colorScheme: "dark", viewport: "mobile" }),
    "screen",
    "home",
  );
  assert.equal(fallback?.[0]?.view.colorScheme, "light");
  assert.equal(
    selectedComparisonViews(loaded, presentation(), "screen", "other"),
    undefined,
  );
});

test("ready waits for every selected document and reuses accepted ones", async () => {
  const { loader, loads } = fakeLoader();
  const documents = createComparisonDocuments(() => loader);
  const loaded = comparison([
    view("mobile", "light"),
    view("desktop", "light"),
  ]);
  const desktop = [
    `${GENERATION}snapshots/before/d`,
    `${GENERATION}snapshots/after/d`,
  ];
  const both = [...desktop, `${GENERATION}snapshots/before/m`];
  assert.deepEqual(documents.state(loaded, desktop), { status: "loading" });
  await documents.present(loaded, desktop, new AbortController().signal);
  const ready = documents.state(loaded, desktop);
  assert.equal(ready.status, "ready");
  assert.deepEqual(
    ready.status === "ready" ? [...ready.presentations.keys()] : [],
    desktop,
  );
  assert.deepEqual(documents.state(loaded, both), { status: "loading" });
  await documents.present(loaded, both, new AbortController().signal);
  assert.equal(documents.state(loaded, both).status, "ready");
  assert.deepEqual(loads, both);
});

test("another loaded comparison discards the accepted presentations", async () => {
  const created: LoadedComparison[] = [];
  const { loader, loads } = fakeLoader();
  const documents = createComparisonDocuments((loaded) => {
    created.push(loaded);
    return loader;
  });
  const addresses = [`${GENERATION}snapshots/after/d`];
  const first = comparison([view("desktop", "light")]);
  const refreshed = comparison([view("desktop", "light")]);
  await documents.present(first, addresses, new AbortController().signal);
  assert.deepEqual(documents.state(refreshed, addresses), {
    status: "loading",
  });
  await documents.present(refreshed, addresses, new AbortController().signal);
  assert.equal(documents.state(refreshed, addresses).status, "ready");
  assert.deepEqual(created, [first, refreshed]);
  assert.deepEqual(loads, [...addresses, ...addresses]);
});

test("a failed document shows the comparison failure and is reported", async () => {
  const reported: unknown[] = [];
  const { loader } = fakeLoader((address) => address.endsWith("/after/d"));
  const documents = createComparisonDocuments(
    () => loader,
    (error) => reported.push(error),
  );
  const loaded = comparison([view("desktop", "light")]);
  const addresses = [
    `${GENERATION}snapshots/before/d`,
    `${GENERATION}snapshots/after/d`,
  ];
  await documents.present(loaded, addresses, new AbortController().signal);
  assert.deepEqual(documents.state(loaded, addresses), {
    status: "failed",
    message: "The comparison is unavailable.",
  });
  assert.equal(reported.length, 1);
});

test("cancelled work records neither presentations nor failures", async () => {
  const reported: unknown[] = [];
  const pending: ((value: SnapshotPresentation) => void)[] = [];
  const documents = createComparisonDocuments(
    () => ({
      load: (address) =>
        new Promise<SnapshotPresentation>((resolve) =>
          pending.push(resolve),
        ).then(() => ({ snapshotAddress: address, srcdoc: "" })),
    }),
    (error) => reported.push(error),
  );
  const loaded = comparison([view("desktop", "light")]);
  const addresses = [`${GENERATION}snapshots/after/d`];
  const controller = new AbortController();
  const work = documents.present(loaded, addresses, controller.signal);
  controller.abort();
  pending[0]?.({ snapshotAddress: addresses[0]!, srcdoc: "" });
  await work;
  assert.deepEqual(documents.state(loaded, addresses), { status: "loading" });
  assert.deepEqual(reported, []);
});

test("an unusable generation fails with the loader's copy", async () => {
  const documents = createComparisonDocuments(() => {
    throw new Error("The comparison is unavailable.");
  });
  const loaded = comparison([view("desktop", "light")]);
  await documents.present(loaded, ["x"], new AbortController().signal);
  assert.deepEqual(documents.state(loaded, ["x"]), {
    status: "failed",
    message: "The comparison is unavailable.",
  });
});
