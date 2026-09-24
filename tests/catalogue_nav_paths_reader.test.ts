import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { readCatalogue } from "../packages/viewer/src/catalogue/reader.js";
import { ComponentValidationError } from "../packages/viewer/src/components/data.js";

interface Node {
  kind: "folder" | "entry";
  label?: string;
  id?: string;
  children?: Node[];
}

interface Entry {
  id: string;
  title: string;
  navPath: string[];
}

interface Fixture {
  tree: { pages: Node[]; components: Node[] };
  screens: Entry[];
  pages: Entry[];
  useCases: Entry[];
  removedEntries: Array<{ entry: Entry }>;
}

async function fixture(): Promise<Fixture> {
  return JSON.parse(
    await readFile("docs/protocol/fixtures/catalogue-v2.json", "utf8"),
  ) as Fixture;
}

function moveTourToSiblingFolder(value: Fixture, label: string): void {
  const existing = value.tree.pages[0]!;
  const tour = existing.children!.pop()!;
  const sibling: Node = { kind: "folder", label, children: [tour] };
  const folders = [existing, sibling].sort((left, right) =>
    left.label!.localeCompare(right.label!, "en"),
  );
  value.tree.pages = [...folders, value.tree.pages[1]!];
  value.useCases[0]!.navPath = [label];
}

const cases: Array<{
  name: string;
  mutate: (value: Fixture) => void;
  reason?: string;
}> = [
  {
    name: "case-conflicting sibling folders",
    mutate: (value) => {
      moveTourToSiblingFolder(value, "product");
    },
    reason: "invalid navigation paths",
  },
  {
    name: "spacing-conflicting sibling folders",
    mutate: (value) => {
      moveTourToSiblingFolder(value, "Pro duct");
    },
    reason: "invalid navigation paths",
  },
  ...["", " Product", "Product/More"].map((label) => ({
    name: `invalid current label ${JSON.stringify(label)}`,
    mutate: (value: Fixture) => {
      value.useCases[0]!.navPath = [label];
      value.tree.pages[0]!.children!.pop();
    },
    reason:
      label === ""
        ? "expected a nonempty navPath label"
        : "invalid navigation paths",
  })),
  {
    name: "leaf title conflicts with a sibling folder",
    mutate: (value) => {
      value.pages[0]!.title = "Product";
      value.tree.pages.pop();
    },
    reason: "invalid navigation paths",
  },
  {
    name: "incorrect folder-before-leaf sibling order",
    mutate: (value) => {
      value.tree.pages.reverse();
    },
    reason: "tree must project the navigation paths",
  },
  {
    name: "variant with a different path from its parent",
    mutate: (value) => {
      value.screens[1]!.navPath = ["Product"];
    },
    reason: "variant path must match parent",
  },
  {
    name: "missing tree entry",
    mutate: (value) => {
      value.tree.pages[0]!.children!.pop();
    },
    reason: "tree must project the navigation paths",
  },
  {
    name: "duplicated tree entry",
    mutate: (value) => {
      value.tree.pages[0]!.children!.push({ kind: "entry", id: "tour" });
    },
    reason: "tree must project the navigation paths",
  },
  {
    name: "entry at the wrong path",
    mutate: (value) => {
      value.tree.pages[0]!.children!.splice(1, 0, value.tree.pages.pop()!);
    },
    reason: "tree must project the navigation paths",
  },
  {
    name: "empty folder",
    mutate: (value) => {
      value.tree.pages.splice(1, 0, {
        kind: "folder",
        label: "Zzz",
        children: [],
      });
    },
    reason: "tree must project the navigation paths",
  },
  {
    name: "missing section array",
    mutate: (value) => {
      Reflect.deleteProperty(value.tree, "components");
    },
    reason: "expected an array",
  },
  {
    name: "historical removed labels need not follow current rules",
    mutate: (value) => {
      value.removedEntries[0]!.entry.navPath = ["a/b", " x"];
    },
  },
  {
    name: "historical removed labels must be non-empty",
    mutate: (value) => {
      value.removedEntries[0]!.entry.navPath = [""];
    },
    reason: "expected a nonempty navPath label",
  },
];

for (const { name, mutate, reason } of cases) {
  test(`read model v2 ${reason === undefined ? "accepts" : "rejects"} ${name}`, async () => {
    const value = await fixture();
    mutate(value);
    if (reason === undefined)
      assert.equal(readCatalogue(value).schemaVersion, 2);
    else
      assert.throws(
        () => readCatalogue(value),
        (error: unknown) => {
          assert.ok(error instanceof ComponentValidationError);
          assert.equal(error.path, "$catalogue");
          assert.equal(error.detail, reason);
          assert.equal(
            error.message,
            `[mokly/components] $catalogue: ${reason}`,
          );
          return true;
        },
      );
  });
}
