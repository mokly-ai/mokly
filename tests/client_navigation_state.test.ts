import assert from "node:assert/strict";
import test from "node:test";

import type { CatalogueReadModel } from "../packages/viewer/dist/catalogue/types.js";
import {
  clearTagTerm,
  parseSearchQuery,
  queryConstrains,
  rowMatchesQuery,
  setTagTerm,
} from "../packages/viewer/dist/shell/search_query.js";
import {
  defaultSelection,
  revealSelection,
} from "../packages/viewer/dist/viewer/selection.js";

import { catalogueModel } from "./helpers/viewer_catalogue.js";

const welcome = {
  route: "screens/welcome.html",
  tags: ["forms", "onboarding"],
  text: "Welcome",
};
const details = {
  route: "screens/details.html",
  tags: ["forms"],
  text: "Details",
};
const glossary = {
  route: "docs/glossary.html",
  tags: [],
  text: "Glossary",
};
const transferReady = {
  id: "transactions-list-transfer-ready",
  route: "screens/transfer-ready.html",
  tags: ["operations"],
  text: "Ready to transfer",
};

function selectionModel(detailsChanged: boolean): CatalogueReadModel {
  const model = catalogueModel();
  const template = model.screens[0]!;
  const changes = (included: boolean) => ({
    included,
    kind: included ? ("changed" as const) : ("unmodified" as const),
    status: "ready" as const,
  });
  return {
    ...model,
    screens: [
      {
        ...template,
        changes: changes(false),
        id: "welcome",
        route: welcome.route,
        tags: welcome.tags,
        title: welcome.text,
      },
      {
        ...template,
        changes: changes(detailsChanged),
        id: "details",
        route: details.route,
        tags: details.tags,
        title: details.text,
      },
    ],
  };
}

test("active-row selection clears only constraints that hide it", () => {
  const unchanged = selectionModel(false);
  assert.deepEqual(
    revealSelection(unchanged, {
      ...defaultSelection,
      screenId: "details",
      search: "welcome",
      view: "changes",
    }),
    {
      ...defaultSelection,
      screenId: "details",
      search: "",
      view: "all",
    },
  );
  const changed = selectionModel(true);
  const matching = {
    ...defaultSelection,
    screenId: "details",
    search: "details",
    view: "changes" as const,
  };
  assert.deepEqual(revealSelection(changed, matching), matching);
  const routeMatch = {
    ...defaultSelection,
    screenId: "details",
    search: "screens/details",
  };
  assert.deepEqual(revealSelection(unchanged, routeMatch), routeMatch);
});

test("a tag term clears the query only for a row that lacks the tag", () => {
  const model = selectionModel(false);
  const selected = (
    screenId: string,
    search: string,
    tags: readonly string[],
  ) =>
    revealSelection(model, {
      ...defaultSelection,
      screenId,
      search,
      tags,
    });
  assert.deepEqual(selected("welcome", "", ["onboarding"]), {
    ...defaultSelection,
    screenId: "welcome",
    tags: ["onboarding"],
  });
  assert.deepEqual(selected("details", "", ["onboarding"]), {
    ...defaultSelection,
    screenId: "details",
  });
  assert.deepEqual(selected("details", "details", ["forms"]), {
    ...defaultSelection,
    screenId: "details",
    search: "details",
    tags: ["forms"],
  });
  assert.deepEqual(selected("details", "welcome", ["forms"]), {
    ...defaultSelection,
    screenId: "details",
  });
});

test("only text or tag terms constrain which rows stay visible", () => {
  assert.equal(queryConstrains(parseSearchQuery("")), false);
  assert.equal(queryConstrains(parseSearchQuery("   ")), false);
  assert.equal(queryConstrains(parseSearchQuery("tag:forms")), true);
  assert.equal(queryConstrains(parseSearchQuery("welcome")), true);
  assert.equal(queryConstrains(parseSearchQuery("tag:forms welcome")), true);
});

test("search queries split tag terms from free text in any order", () => {
  assert.deepEqual(parseSearchQuery(""), { freeText: "", tags: [] });
  assert.deepEqual(parseSearchQuery("welcome screen"), {
    freeText: "welcome screen",
    tags: [],
  });
  assert.deepEqual(parseSearchQuery("tag:forms welcome"), {
    freeText: "welcome",
    tags: ["forms"],
  });
  assert.deepEqual(parseSearchQuery("welcome tag:forms"), {
    freeText: "welcome",
    tags: ["forms"],
  });
  assert.deepEqual(parseSearchQuery("tag:forms tag:onboarding"), {
    freeText: "",
    tags: ["forms", "onboarding"],
  });
});

test("search query parsing lowercases tags and collapses whitespace", () => {
  assert.deepEqual(parseSearchQuery("  TAG:Forms   Welcome  Screen  "), {
    freeText: "Welcome Screen",
    tags: ["forms"],
  });
  assert.deepEqual(parseSearchQuery("Tag:ONBOARDING"), {
    freeText: "",
    tags: ["onboarding"],
  });
  assert.deepEqual(parseSearchQuery("welcome\ttag:forms\nscreen"), {
    freeText: "welcome screen",
    tags: ["forms"],
  });
});

test("a tag prefix without a value stays free text verbatim", () => {
  assert.deepEqual(parseSearchQuery("tag: welcome"), {
    freeText: "tag: welcome",
    tags: [],
  });
  assert.deepEqual(parseSearchQuery("TAG:"), { freeText: "TAG:", tags: [] });
});

test("rows match only when every tag term is declared on the row", () => {
  assert.equal(rowMatchesQuery(parseSearchQuery(""), glossary), true);
  assert.equal(rowMatchesQuery(parseSearchQuery("tag:forms"), welcome), true);
  assert.equal(rowMatchesQuery(parseSearchQuery("tag:forms"), details), true);
  assert.equal(rowMatchesQuery(parseSearchQuery("tag:forms"), glossary), false);
  assert.equal(
    rowMatchesQuery(parseSearchQuery("tag:forms tag:onboarding"), welcome),
    true,
  );
  assert.equal(
    rowMatchesQuery(parseSearchQuery("tag:forms tag:onboarding"), details),
    false,
  );
});

test("row tags lowercase defensively though authoring can never emit them", () => {
  assert.equal(
    rowMatchesQuery(parseSearchQuery("TAG:Forms"), {
      route: "screens/legacy.html",
      tags: ["Forms"],
      text: "Legacy",
    }),
    true,
  );
});

test("an unmatched tag term hides a row free text alone would match", () => {
  assert.equal(rowMatchesQuery(parseSearchQuery("details"), details), true);
  assert.equal(
    rowMatchesQuery(parseSearchQuery("tag:onboarding details"), details),
    false,
  );
});

test("free text matches row text or route regardless of term order", () => {
  assert.equal(rowMatchesQuery(parseSearchQuery("WELCOME"), welcome), true);
  assert.equal(
    rowMatchesQuery(parseSearchQuery("screens/welcome"), welcome),
    true,
  );
  assert.equal(rowMatchesQuery(parseSearchQuery("glossary"), welcome), false);
  assert.equal(
    rowMatchesQuery(parseSearchQuery("welcome screen"), welcome),
    false,
  );
  assert.equal(
    rowMatchesQuery(parseSearchQuery("tag:forms welcome"), welcome),
    true,
  );
  assert.equal(
    rowMatchesQuery(parseSearchQuery("welcome tag:forms"), welcome),
    true,
  );
  assert.equal(
    rowMatchesQuery(parseSearchQuery("tag:forms welcome"), details),
    false,
  );
});

test("free text matches a structured page id", () => {
  assert.equal(
    rowMatchesQuery(
      parseSearchQuery("transactions-list-transfer-ready"),
      transferReady,
    ),
    true,
  );
  assert.equal(
    rowMatchesQuery(parseSearchQuery("TRANSACTIONS-LIST-TRANSFER-READY"), {
      ...transferReady,
      text: "Unrelated title",
    }),
    true,
  );
});

test("setting a tag term keeps free text and leaves exactly one tag", () => {
  assert.equal(
    setTagTerm("tag:onboarding welcome", "forms"),
    "welcome tag:forms",
  );
  assert.equal(setTagTerm("", "forms"), "tag:forms");
  assert.equal(setTagTerm("   ", "forms"), "tag:forms");
  assert.equal(setTagTerm("welcome", "forms"), "welcome tag:forms");
  assert.equal(setTagTerm("welcome", "Forms"), "welcome tag:forms");
  assert.equal(setTagTerm("tag:forms", "forms"), "tag:forms");
  assert.equal(
    setTagTerm("  TAG:Onboarding  Welcome   Screen tag:forms ", "onboarding"),
    "Welcome Screen tag:onboarding",
  );
});

test("clearing a tag term removes only that tag term", () => {
  assert.equal(clearTagTerm("welcome tag:forms", "forms"), "welcome");
  assert.equal(
    clearTagTerm("tag:onboarding welcome tag:forms", "forms"),
    "tag:onboarding welcome",
  );
  assert.equal(
    clearTagTerm("  welcome   TAG:Forms  details ", "forms"),
    "welcome details",
  );
  assert.equal(
    clearTagTerm("welcome tag:forms", "onboarding"),
    "welcome tag:forms",
  );
  assert.equal(
    clearTagTerm("welcome tag:forms-wide", "forms"),
    "welcome tag:forms-wide",
  );
  assert.equal(clearTagTerm("tag:forms", "forms"), "");
  assert.equal(
    clearTagTerm(setTagTerm("welcome", "forms"), "forms"),
    "welcome",
  );
});
