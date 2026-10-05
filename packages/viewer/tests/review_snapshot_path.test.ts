import assert from "node:assert/strict";
import test from "node:test";

import { reviewSnapshotViewPath } from "../src/data.js";

test("review snapshots use each recorded side and keep its case", () => {
  const record = {
    path: "billing",
    previousPath: "unrelated",
    before: { path: "Billing" },
    after: { path: "billing" },
  };
  for (const viewport of ["mobile", "desktop"] as const)
    for (const colorScheme of ["light", "dark"] as const)
      for (const side of ["before", "after"] as const)
        assert.equal(
          reviewSnapshotViewPath(side, record, { viewport, colorScheme }),
          `snapshots/${side}/${record[side].path}/index.${viewport}${colorScheme === "dark" ? ".dark" : ""}.html`,
        );
});

test("review snapshots never fall back to another address for a missing side", () => {
  const view = { viewport: "mobile", colorScheme: "light" } as const;
  const afterOnly = { path: "invoice", after: { path: "invoice" } };
  const beforeOnly = { path: "invoice", before: { path: "invoice" } };
  assert.throws(() => reviewSnapshotViewPath("before", afterOnly, view));
  assert.throws(() => reviewSnapshotViewPath("after", beforeOnly, view));
  assert.equal(
    reviewSnapshotViewPath("before", beforeOnly, view),
    "snapshots/before/invoice/index.mobile.html",
  );
  assert.equal(
    reviewSnapshotViewPath("after", afterOnly, view),
    "snapshots/after/invoice/index.mobile.html",
  );
});

test("review snapshots validate the selected address and axes only", () => {
  const record = { before: { path: "../unsafe" }, after: { path: "invoice" } };
  const view = { viewport: "desktop", colorScheme: "dark" } as const;
  assert.throws(() => reviewSnapshotViewPath("before", record, view));
  assert.equal(
    reviewSnapshotViewPath("after", record, view),
    "snapshots/after/invoice/index.desktop.dark.html",
  );
  assert.throws(() =>
    reviewSnapshotViewPath("after", record, {
      ...view,
      viewport: "tablet" as "desktop",
    }),
  );
  assert.throws(() =>
    reviewSnapshotViewPath("after", record, {
      ...view,
      colorScheme: "sepia" as "dark",
    }),
  );
});
