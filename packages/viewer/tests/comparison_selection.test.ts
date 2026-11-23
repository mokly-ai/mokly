import assert from "node:assert/strict";
import { test } from "node:test";

import type { ComparedEntry, ReviewView } from "../src/review/types.js";
import type { LoadedComparison } from "../src/shell/comparison_request.js";
import {
  selectedComparisonDocuments,
  selectedComparisonViews,
} from "../src/shell/comparison_selection.js";
import type { ComparisonPresentation } from "../src/shell/use_comparison.js";

const GENERATION = "https://catalogue.test/mokly-viewer/diffs/generations/one/";

function comparison(generation = GENERATION): LoadedComparison {
  return { url: generation };
}

function view(
  viewport: "desktop" | "mobile",
  colorScheme: "dark" | "light",
  sides: readonly ("after" | "before")[] = ["before", "after"],
): ReviewView {
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

function compared(views: readonly ReviewView[]): ComparedEntry {
  return {
    path: "home",
    basePath: "home",
    reasons: [{ kind: "material" }],
    views,
  };
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

test("selected views resolve both sides beneath the comparison generation", () => {
  const loaded = comparison();
  const entry = compared([
    view("mobile", "light"),
    view("desktop", "light"),
    view("desktop", "dark", ["before"]),
  ]);
  const both = selectedComparisonViews(loaded, presentation(), entry);
  assert.deepEqual(selectedComparisonDocuments(both), [
    `${GENERATION}snapshots/before/mokly-generated/home/index.mobile.html`,
    `${GENERATION}snapshots/after/mokly-generated/home/index.mobile.html`,
    `${GENERATION}snapshots/before/mokly-generated/home/index.desktop.html`,
    `${GENERATION}snapshots/after/mokly-generated/home/index.desktop.html`,
  ]);
  const dark = selectedComparisonViews(
    loaded,
    presentation({ colorScheme: "dark", viewport: "desktop" }),
    entry,
  );
  assert.equal(dark?.[0]?.mode, "side");
  assert.deepEqual(selectedComparisonDocuments(dark), [
    `${GENERATION}snapshots/before/mokly-generated/home/index.desktop.dark.html`,
  ]);
  const fallback = selectedComparisonViews(
    loaded,
    presentation({ colorScheme: "dark", viewport: "mobile" }),
    entry,
  );
  assert.equal(fallback?.[0]?.view.colorScheme, "light");
  assert.equal(
    selectedComparisonViews(loaded, presentation(), undefined),
    undefined,
  );
  const moved = selectedComparisonViews(
    loaded,
    presentation({ viewport: "mobile" }),
    { ...entry, basePath: "Earlier/Home" },
  );
  assert.deepEqual(selectedComparisonDocuments(moved), [
    `${GENERATION}snapshots/before/mokly-generated/Earlier/Home/index.mobile.html`,
    `${GENERATION}snapshots/after/mokly-generated/home/index.mobile.html`,
  ]);
});
