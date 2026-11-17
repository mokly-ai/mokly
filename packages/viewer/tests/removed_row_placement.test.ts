import assert from "node:assert/strict";
import test from "node:test";

import { catalogueNavSections } from "../src/shell/nav_model.js";

import {
  publishedCatalogue,
  publishedComponent,
  publishedDocument,
  publishedScreen,
  removedEntry,
} from "./published_entries_fixture.js";
import { outline } from "./removed_row_outline.js";

/** The outline of each section that the catalogue shows, by section id. */
function sections(
  input: Parameters<typeof publishedCatalogue>[0],
): Record<string, unknown[]> {
  return Object.fromEntries(
    catalogueNavSections(publishedCatalogue(input)).map((section) => [
      section.id,
      outline(section.children),
    ]),
  );
}

test("a removed folder page is the first row of its surviving folder", () => {
  assert.deepEqual(
    sections({
      removedEntries: [
        removedEntry(publishedDocument("guide", "Guide", "removed"), []),
      ],
      screens: [publishedScreen("guide/current", "Current")],
      tree: [
        {
          children: [{ kind: "entry", path: "guide/current" }],
          kind: "folder",
          path: "guide",
          title: "Guide",
        },
      ],
    }).specs,
    [{ "folder:guide Guide": ["removed:guide", "entry:guide/current"] }],
  );
});

test("a removed member joins the current screen row of its folder", () => {
  assert.deepEqual(
    sections({
      documents: [publishedDocument("guide/welcome/notes", "Notes")],
      removedEntries: [
        removedEntry(
          publishedDocument("guide/welcome/old", "Old notes", "removed"),
          ["Guide", "Welcome"],
        ),
      ],
      screens: [publishedScreen("guide/welcome", "Welcome")],
      tree: [
        {
          children: [
            {
              children: [{ kind: "entry", path: "guide/welcome/notes" }],
              kind: "entry",
              path: "guide/welcome",
            },
          ],
          kind: "folder",
          path: "guide",
          title: "Guide",
        },
      ],
    }).specs,
    [
      {
        "folder:guide Guide": [
          {
            "entry:guide/welcome": [
              "entry:guide/welcome/notes",
              "removed:guide/welcome/old",
            ],
          },
        ],
      },
    ],
  );
});

test("no folder returns at the path of a current variant row", () => {
  // Welcome was a parent at the branch point and is now a variant of Hub.
  assert.deepEqual(
    sections({
      removedEntries: [
        removedEntry(
          publishedScreen(
            "guide/hub/welcome/error",
            "Save failed",
            "removed",
            "guide/hub/welcome",
          ),
          ["Guide", "Hub"],
          "Welcome",
        ),
      ],
      screens: [
        publishedScreen("guide/hub", "Hub"),
        publishedScreen("guide/hub/welcome", "Welcome", "changed", "guide/hub"),
      ],
      tree: [
        {
          children: [
            {
              children: [{ kind: "entry", path: "guide/hub/welcome" }],
              kind: "entry",
              path: "guide/hub",
            },
          ],
          kind: "folder",
          path: "guide",
          title: "Guide",
        },
      ],
    }).specs,
    [
      {
        "folder:guide Guide": [
          {
            "entry:guide/hub": [
              "entry:guide/hub/welcome",
              "removed:guide/hub/welcome/error",
            ],
          },
        ],
      },
    ],
  );
});

test("a removed component keeps the folder of a screen in another section", () => {
  const badge = publishedComponent("s/welcome/badge", "Badge", "removed");
  assert.deepEqual(
    sections({
      removedEntries: [removedEntry(badge, ["S", "Welcome"])],
      screens: [publishedScreen("s/welcome", "Welcome")],
      tree: [
        {
          children: [{ kind: "entry", path: "s/welcome" }],
          kind: "folder",
          path: "s",
          title: "S",
        },
      ],
    }).components,
    [
      {
        "folder:s S": [
          { "folder:s/welcome Welcome": ["removed:s/welcome/badge"] },
        ],
      },
    ],
  );
});
