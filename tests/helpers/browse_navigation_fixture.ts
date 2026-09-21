import assert from "node:assert/strict";

import type { NavPreferenceStorage } from "../../packages/viewer/dist/client/browse_navigation.js";

import { FakeNode } from "./fake_dom.js";

export const BROWSE_BASE = "http://127.0.0.1:4173/view/screens/welcome.html";

/** One catalogue column with filters, tagged rows, and a saved-variant list. */
export interface NavFixture {
  changed: FakeNode;
  details: FakeNode;
  docs: FakeNode;
  glossary: FakeNode;
  pages: FakeNode;
  root: FakeNode;
  screens: FakeNode;
  search: FakeNode;
  welcome: FakeNode;
  welcomeLeaf: FakeNode;
  welcomeEmpty: FakeNode;
  welcomeList: FakeNode;
  welcomeToggle: FakeNode;
}

export function navFixture(): NavFixture {
  const search = new FakeNode("input", { "data-mokly-search": "" });
  const welcome = navRow(
    "screens/welcome.html",
    "Welcome",
    "forms onboarding",
    "welcome",
  );
  const details = navRow(
    "screens/details.html",
    "Details",
    "forms",
    "transactions-list-transfer-ready",
  );
  const glossary = navRow("docs/glossary.html", "Glossary");
  const welcomeEmpty = navRow(
    "screens/welcome.variants/empty.html",
    "Empty workspace",
    "forms onboarding",
    "welcome-empty",
  );
  const welcomeToggle = variantToggle("mb-nav-variants-pages-welcome");
  const welcomeList = variantList(
    "variants:pages:welcome",
    "mb-nav-variants-pages-welcome",
    welcomeEmpty,
  );
  const welcomeLeaf = new FakeNode("div", { class: "mbk-nav-leaf" }).append(
    welcome,
    welcomeToggle,
  );
  const screens = navGroup(
    "collection:screens",
    welcomeLeaf,
    welcomeList,
    details,
  );
  const docs = navGroup("collection:docs", glossary);
  const changed = filterOption("changed", "false");
  const pages = navGroup("section:pages", screens, docs);
  const root = new FakeNode("div").append(
    search,
    filterOption("all", "true"),
    changed,
    pages,
  );
  return {
    changed,
    details,
    welcomeEmpty,
    welcomeList,
    welcomeToggle,
    docs,
    glossary,
    pages,
    root,
    screens,
    search,
    welcome,
    welcomeLeaf,
  };
}

/** A deleted variant retained under a surviving parent's disclosed list. */
export function removedVariantRow(): FakeNode {
  return new FakeNode(
    "a",
    {
      "data-changed": "true",
      "data-entry-id": "welcome-gone",
      "data-nav-removed": "",
      "data-nav-row": "",
      "data-removed-variant": "",
      "data-route": "screens/welcome.variants/gone.html",
      href: "/view/screens/welcome.variants/gone.html",
    },
    "Workspace deleted \u00b7 Removed",
  );
}

export function disclosureGroup(
  key: string,
  open: boolean,
): HTMLDetailsElement {
  return {
    getAttribute(name: string) {
      return name === "data-nav-disclosure" ? key : null;
    },
    open,
  } as HTMLDetailsElement;
}

export function disclosureDocument(...groups: HTMLDetailsElement[]): Document {
  return {
    querySelectorAll(selector: string) {
      assert.equal(selector, "[data-nav-disclosure]");
      return groups;
    },
  } as unknown as Document;
}

export class FakeStorage implements NavPreferenceStorage {
  constructor(public value: string | null = null) {}

  getItem(): string | null {
    return this.value;
  }

  setItem(_key: string, value: string): void {
    this.value = value;
  }
}

function navRow(
  route: string,
  label: string,
  tags?: string,
  id?: string,
): FakeNode {
  return new FakeNode(
    "a",
    {
      "data-nav-row": "",
      "data-route": route,
      href: `/view/${route}`,
      ...(id === undefined ? {} : { "data-entry-id": id }),
      ...(tags === undefined ? {} : { "data-tags": tags }),
    },
    label,
  );
}

function navGroup(key: string, ...rows: readonly FakeNode[]): FakeNode {
  return new FakeNode("details", {
    "data-nav-disclosure": key,
    ...(key.startsWith("collection:") ? { "data-nav-collection": key } : {}),
  }).append(...rows);
}

function variantToggle(listId: string): FakeNode {
  return new FakeNode("button", {
    "aria-controls": listId,
    "aria-expanded": "false",
    "aria-label": "Show variants of Welcome",
    "data-nav-variants-label": "Welcome",
    "data-nav-variants-toggle": listId,
  });
}

function variantList(
  key: string,
  listId: string,
  ...rows: readonly FakeNode[]
): FakeNode {
  const list = new FakeNode("div", {
    "data-nav-disclosure": key,
    "data-nav-variants": "",
    id: listId,
  }).append(...rows);
  list.hidden = true;
  return list;
}

function filterOption(name: string, pressed: string): FakeNode {
  return new FakeNode("button", {
    "aria-pressed": pressed,
    "data-filter": name,
  });
}
