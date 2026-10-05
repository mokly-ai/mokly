import assert from "node:assert/strict";
import test from "node:test";

import {
  persistHydrationDisclosures,
  setDisclosureOpen,
} from "../src/standalone/early_disclosures.js";

function documentFixture(kind: "folder" | "list") {
  const saved = new Map<string, string>();
  const key = kind === "list" ? "variants:home" : "folder:specs:home";
  const attributes = new Map([
    ["data-nav-disclosure", key],
    ["data-nav-has-rows", "false"],
    ["data-nav-saved-open", "true"],
  ]);
  if (kind === "list") attributes.set("data-nav-variants", "");
  const doc = {
    defaultView: {
      localStorage: {
        setItem: (key: string, value: string) => saved.set(key, value),
      },
    },
    querySelector: () => null,
    querySelectorAll: (selector: string) =>
      selector === "[data-nav-disclosure]" ? [group] : [],
  } as unknown as Document;
  const group = {
    id: "list",
    hidden: true,
    open: false,
    ownerDocument: doc,
    getAttribute: (name: string) => attributes.get(name) ?? null,
    hasAttribute: (name: string) => attributes.has(name),
    setAttribute: (name: string, value: string) => attributes.set(name, value),
  } as unknown as HTMLElement & { open: boolean };
  const persisted = () =>
    JSON.parse(saved.get("mokly:nav-disclosure:v4") ?? "{}")[key] as boolean;
  return { attributes, doc, group, persisted };
}

for (const kind of ["folder", "list"] as const) {
  test(`hydration retains a saved open ${kind} while it has no visible row`, () => {
    const { doc, group, persisted } = documentFixture(kind);
    setDisclosureOpen(group, true);
    assert.equal(kind === "list" ? !group.hidden : group.open, false);
    persistHydrationDisclosures(doc);
    assert.equal(persisted(), true);
    setDisclosureOpen(group, false);
    persistHydrationDisclosures(doc);
    assert.equal(persisted(), false);
  });

  test(`hydration opens a saved ${kind} once its rows are visible`, () => {
    const { attributes, doc, group, persisted } = documentFixture(kind);
    attributes.set("data-nav-has-rows", "true");
    setDisclosureOpen(group, true);
    assert.equal(kind === "list" ? !group.hidden : group.open, true);
    persistHydrationDisclosures(doc);
    assert.equal(persisted(), true);
  });
}
