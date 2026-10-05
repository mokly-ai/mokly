import assert from "node:assert/strict";
import test from "node:test";

import type { ComponentReview } from "../packages/viewer/src/review/component_types.js";
import { workspaceData } from "../packages/viewer/src/shell/workspace_data.js";
import { usageHref } from "../packages/viewer/src/shell/workspace_usage.js";

import {
  branchPointShell,
  routedEntry,
  type BranchPointShellSide,
} from "./helpers/branch_point_shell.js";

/** The variant bar's rows: path, removal and status, in bar order. */
function bar(side: BranchPointShellSide, path: string) {
  const entry = routedEntry(side, path);
  const data = workspaceData(side.catalogue, side.context(entry), entry);
  return {
    component: data.component?.path,
    status: data.status,
    rows: data.variants.map(({ value, removed, status }) => [
      value.path,
      removed,
      status,
    ]),
  };
}

test("affected consumers link before-side evidence to the moved destinations", async (t) => {
  const shell = await branchPointShell("moved-consumers");
  t.after(shell.remove);
  for (const side of shell.sides) {
    const badge = routedEntry(side, "library/badge");
    const data = workspaceData(side.catalogue, side.context(badge), badge);
    const rows = [
      ...new Set(
        data.affected.map((link) =>
          JSON.stringify([
            link.entryKind,
            link.entryId,
            link.title,
            link.removed,
            usageHref(link).split("?")[0],
            usageHref(link).includes("comparison=side"),
          ]),
        ),
      ),
    ].map((row) => JSON.parse(row) as unknown);
    assert.deepEqual(
      rows,
      side.name === "served"
        ? [
            [
              "component",
              "library/archive/status/default",
              "Status · default",
              false,
              "/view/library/archive/status/default/",
              false,
            ],
            [
              "screen",
              "shop/archive/receipt",
              "Receipt",
              false,
              "/view/shop/archive/receipt/",
              false,
            ],
          ]
        : [],
      side.name === "served"
        ? "served: each side resolves to the destination its pair names"
        : "public: the public model carries no affected-consumer evidence",
    );
  }
});

test("a case-renamed parent keeps its removed sibling in the variant bar", async (t) => {
  const shell = await branchPointShell("case-renames");
  t.after(shell.remove);
  const rows = [
    ["library/action/primary", false, "Changed"],
    ["library/Action/secondary", true, "Removed"],
  ];
  for (const side of shell.sides) {
    assert.deepEqual(
      bar(side, "library/action/primary"),
      { component: "library/action", status: "Changed", rows },
      side.name,
    );
    assert.deepEqual(
      bar(side, "library/Action/secondary"),
      { component: "library/action", status: "Removed", rows },
      side.name,
    );
  }
  const served = shell.sides[0];
  const primary = routedEntry(served, "library/action/primary");
  const comparison = workspaceData(
    served.catalogue,
    served.context(primary),
    primary,
  ).comparison as ComponentReview | undefined;
  const saved = comparison?.variants.find(
    ({ path }) => path === "library/action/primary",
  );
  assert.deepEqual(
    [saved?.before?.props, saved?.after?.props],
    [{ label: ["string", "Continue"] }, { label: ["string", "Submit"] }],
  );
});

test("a moved parent and a moved variant keep their bars and saved props", async (t) => {
  for (const [name, path, component, rows, props] of [
    [
      "moved-parent",
      "library/action/secondary",
      "library/archive/action",
      [
        ["library/archive/action/primary", false, "Changed"],
        ["library/action/secondary", true, "Removed"],
      ],
      undefined,
    ],
    [
      "moved-variant",
      "library/receiver/primary",
      "library/receiver",
      [
        ["library/receiver/default", false, "Unmodified"],
        ["library/receiver/primary", false, "Changed"],
      ],
      [{ label: ["string", "Continue"] }, { label: ["string", "Submit"] }],
    ],
  ] as const) {
    const shell = await branchPointShell(name);
    t.after(shell.remove);
    for (const side of shell.sides) {
      const shown = bar(side, path);
      assert.equal(shown.component, component, `${name} ${side.name}`);
      assert.deepEqual(shown.rows, rows, `${name} ${side.name}`);
    }
    if (!props) continue;
    const served = shell.sides[0];
    const entry = routedEntry(served, path);
    const comparison = workspaceData(
      served.catalogue,
      served.context(entry),
      entry,
    ).comparison as ComponentReview | undefined;
    const saved = comparison?.variants.find((item) => item.path === path);
    assert.deepEqual([saved?.before?.props, saved?.after?.props], props);
  }
});

test("a removed variant whose former path now names a document stays standalone", async (t) => {
  const shell = await branchPointShell("reused-parent");
  t.after(shell.remove);
  for (const side of shell.sides)
    assert.deepEqual(
      bar(side, "library/action/default"),
      {
        component: undefined,
        status: "Removed",
        rows: [["library/action/default", true, "Removed"]],
      },
      side.name,
    );
});
