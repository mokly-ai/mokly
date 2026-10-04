import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import type { ManifestEntry, ManifestV8 } from "../src/registry/types.js";
import { createCatalogue } from "../src/shell/catalogue.js";
import { branchPoints } from "../src/shell/catalogue_branch_point.js";
import type { ShellContext } from "../src/shell/context.js";
import { EntryDetailsBody } from "../src/shell/details.js";
import { catalogueNavSections } from "../src/shell/nav_model.js";
import { navRowPresentation } from "../src/shell/nav_moves.js";
import type { NavLeafNode, NavNode } from "../src/shell/nav_tree.js";

const entry = (
  kind: "document" | "screen",
  path: string,
  title: string,
  variantOf?: string,
): ManifestEntry =>
  ({
    colorSchemes: ["light"],
    declaredDependencies: [],
    description: title,
    kind,
    path,
    relatedDocs: [],
    sourcePath: `specs/${path}.${kind === "document" ? "md" : "mockup.tsx"}`,
    tags: [],
    title,
    ...(kind === "screen" ? { useCasePaths: [] } : { resources: [] }),
    ...(variantOf ? { variantOf } : {}),
  }) as unknown as ManifestEntry;

/** Billing moved under Account; its Paid variant was deleted on the way. */
const manifest: ManifestV8 = {
  entries: [
    entry("screen", "account/billing/invoice", "Invoice"),
    entry(
      "screen",
      "account/billing/invoice/overdue",
      "Overdue",
      "account/billing/invoice",
    ),
    entry("screen", "account/billing/receipt", "Receipt"),
    entry("document", "account/billing/payment-terms", "Payment terms"),
    entry("screen", "home", "Home"),
  ],
  folders: [],
  generatedBy: "mokly",
  schemaVersion: 8,
  sourceFiles: [],
};
const paid = entry("screen", "billing/invoice/paid", "Paid", "billing/invoice");
const catalogue = createCatalogue(
  manifest,
  [{ entry: paid, folderTitles: ["Billing"], parentTitle: "Invoice" }],
  [
    { path: "account/billing/invoice", previousPath: "billing/invoice" },
    {
      path: "account/billing/invoice/overdue",
      previousPath: "billing/invoice/overdue",
    },
    { path: "account/billing/receipt", previousPath: "billing/receipt" },
    {
      path: "account/billing/payment-terms",
      previousPath: "billing/payment-terms",
    },
    { path: "gone", previousPath: "old/gone" },
  ],
);

function leaves(nodes: readonly NavNode[]): NavLeafNode[] {
  return nodes.flatMap((node) =>
    node.kind === "group"
      ? leaves(node.children)
      : [node, ...(node.variants ?? []), ...leaves(node.members ?? [])],
  );
}
const rows = leaves(
  catalogueNavSections(catalogue).flatMap((section) => section.children),
);
const row = (id: string) => {
  const found = rows.find((candidate) => candidate.entryId === id);
  assert.ok(found, id);
  return found;
};

test("a removed variant joins its moved parent and keeps its baseline variantOf", () => {
  const invoice = row("account/billing/invoice");
  assert.deepEqual(
    invoice.variants?.map((variant) => [
      variant.entryId,
      variant.movedFrom,
      variant.removedVariant,
    ]),
    [
      ["account/billing/invoice/overdue", "billing/invoice/overdue", undefined],
      ["billing/invoice/paid", undefined, true],
    ],
  );
  assert.equal(
    rows.filter((candidate) => candidate.entryId === "billing/invoice/paid")
      .length,
    1,
  );
  const removed = catalogue.removedEntries[0]?.entry;
  assert.ok(removed && "variantOf" in removed);
  assert.equal(removed.variantOf, "billing/invoice");
  const lookup = branchPoints(catalogue);
  const parent = lookup.parentOf(removed);
  assert.equal(
    parent && parent.source !== "title" ? parent.entry.path : undefined,
    "account/billing/invoice",
  );
  assert.equal(
    lookup.resolve({ side: "before", kind: "screen", path: "billing/invoice" })
      ?.entry.path,
    "account/billing/invoice",
  );
  assert.equal(
    lookup.resolve({ side: "before", kind: "screen", path: "old/gone" }),
    undefined,
  );
});

/** Changes lists every move; only Invoice changed beyond its move. */
const context = {
  base: "main",
  changedEntries: [
    "account/billing/invoice",
    "account/billing/invoice/overdue",
    "account/billing/receipt",
    "account/billing/payment-terms",
    "billing/invoice/paid",
  ],
  materialEntries: ["account/billing/invoice", "billing/invoice/paid"],
  updateVersion: 0,
} satisfies ShellContext;

test("Changes labels a moved row Moved in place of its changed mark", () => {
  const invoice = row("account/billing/invoice");
  assert.deepEqual(navRowPresentation(invoice, true, context), {
    changed: false,
    changedVariants: false,
    label: "Invoice · Moved",
  });
  assert.deepEqual(navRowPresentation(invoice, false, context), {
    changed: true,
    changedVariants: true,
    label: "Invoice",
  });
  assert.equal(
    navRowPresentation(row("account/billing/payment-terms"), true, context)
      .label,
    "Payment terms · Moved",
  );
  assert.deepEqual(navRowPresentation(row("home"), true, context), {
    changed: false,
    changedVariants: false,
    label: "Home",
  });
  assert.equal(row("billing/invoice/paid").label, "Paid · Removed");
});

test("All marks a moved row only when its entry changed beyond the move", () => {
  for (const path of [
    "account/billing/invoice/overdue",
    "account/billing/receipt",
    "account/billing/payment-terms",
  ])
    assert.deepEqual(navRowPresentation(row(path), false, context), {
      changed: false,
      changedVariants: false,
      label: row(path).label,
    });
  const server = {
    ...context,
    materialEntries: undefined,
    componentChanges: {
      baseline: { entries: [] },
      changedEntries: ["account/billing/invoice"],
    },
  } as unknown as ShellContext;
  assert.equal(
    navRowPresentation(row("account/billing/receipt"), false, server).changed,
    false,
  );
  assert.equal(
    navRowPresentation(row("account/billing/invoice"), false, server).changed,
    true,
  );
});

test("Details name the path a moved entry came from, after its source", () => {
  const details = (path: string) => {
    const shown = catalogue.byPath.get(path);
    assert.ok(shown, path);
    return renderToStaticMarkup(
      <EntryDetailsBody catalogue={catalogue} entry={shown} />,
    );
  };
  for (const [path, previous] of [
    ["account/billing/invoice", "billing/invoice"],
    ["account/billing/payment-terms", "billing/payment-terms"],
  ] as const)
    assert.match(
      details(path),
      new RegExp(
        `Source</span>.*?</div><div class="mbk-meta-row"><span class="mbk-meta-k">Moved from</span><span class="mbk-meta-v"><code class="mbk-code">${previous}</code>`,
        "u",
      ),
    );
  assert.doesNotMatch(details("home"), /Moved from/u);
  assert.doesNotMatch(details("billing/invoice/paid"), /Moved from/u);
});
