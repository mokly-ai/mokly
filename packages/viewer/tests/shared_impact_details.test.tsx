/**
 * Details of an entry that only changed components affect, on the live
 * path: the published index and the entry detail.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { detailKey } from "../src/catalogue/detail_fences.js";
import type {
  CatalogueReadModel,
  EntryDetailV4,
} from "../src/catalogue/types.js";
import { WorkspaceEvidence } from "../src/shell/workspace_evidence.js";
import { viewerCatalogue } from "../src/viewer/projection.js";
import { publicWorkspace } from "../src/viewer/public_workspace.js";

import {
  detailPairs,
  rawDetailFixtures,
  rawIndexFixture,
  shellModelFixture,
} from "./catalogue_v9_fixture.js";

const SCREEN = "product/browse/home/empty";
const SHARED = "Changed components that this screen uses affect its preview.";
const NO_CHANGES = "No changes to this screen.";
const ACTION = { path: "components/action", title: "Action" } as const;

/** The routed screen's Details after one edit of its index record and detail. */
function details(edit: {
  changes?: CatalogueReadModel["screens"][number]["changes"];
  detail?: (detail: EntryDetailV4) => void;
}): string {
  const index = rawIndexFixture();
  const record = index.screens.find(({ path }) => path === SCREEN)!;
  if (edit.changes) record.changes = edit.changes;
  const fixtures = rawDetailFixtures();
  edit.detail?.(fixtures.current[SCREEN]!);
  const model = shellModelFixture(
    index,
    new Map(
      detailPairs(undefined, fixtures).map(([request, detail]) => [
        detailKey(request),
        detail,
      ]),
    ),
  );
  const catalogue = viewerCatalogue(model);
  const entry = catalogue.byPath.get(SCREEN);
  assert.ok(entry?.kind === "screen");
  const data = publicWorkspace(
    catalogue,
    model,
    entry,
    true,
    undefined,
    "main",
  );
  return renderToStaticMarkup(<WorkspaceEvidence data={data} />);
}

/** The detail of a screen that uses changed Action. */
function usesAction(detail: EntryDetailV4) {
  detail.workspace!.relatedComponents = [ACTION];
}

/** A view rule that changed Action owns, which the screen keeps. */
function keepsActionRule(detail: EntryDetailV4) {
  detail.views[0]!.resourceEvidence = {
    rules: [
      {
        stylesheet: "mockups/action.css",
        selector: ".action",
        status: "matched",
        owner: { kind: "component", path: ACTION.path },
      },
    ],
    resources: [],
  };
}

test("an affected-only screen explains the shared change in place of its no-changes line", () => {
  const markup = details({
    detail: (detail) => {
      usesAction(detail);
      keepsActionRule(detail);
    },
  });
  assert.ok(markup.includes(`<p class="mbk-reset">${SHARED}</p>`), markup);
  assert.ok(!markup.includes(NO_CHANGES), markup);
  assert.match(
    markup,
    /Changed component: <a class="mbk-reset" href="[^"]*">Action<\/a>/,
  );
  assert.match(markup, /Changed styles that apply to this screen:/);
});

test("the explanation needs no stylesheet when the screen uses a changed component", () => {
  const markup = details({ detail: usesAction });
  assert.ok(markup.includes(`<p class="mbk-reset">${SHARED}</p>`), markup);
  assert.ok(!markup.includes(NO_CHANGES), markup);
});

test("a component-owned record alone explains the shared change", () => {
  const rule = details({ detail: keepsActionRule });
  assert.ok(rule.includes(`<p class="mbk-reset">${SHARED}</p>`), rule);
  const resource = details({
    detail: (detail) => {
      detail.views[1]!.resourceEvidence = {
        rules: [],
        resources: [
          {
            path: "static/icons/action.svg",
            owner: { kind: "component", path: ACTION.path },
          },
        ],
      };
    },
  });
  assert.ok(resource.includes(`<p class="mbk-reset">${SHARED}</p>`), resource);
});

test("an excluded component rule explains nothing", () => {
  const markup = details({
    detail: (detail) => {
      detail.views[0]!.resourceEvidence = {
        rules: [
          {
            stylesheet: "mockups/action.css",
            selector: "",
            status: "excluded",
            owner: { kind: "component", path: ACTION.path },
          },
        ],
        resources: [],
      };
    },
  });
  assert.ok(!markup.includes(SHARED), markup);
  assert.ok(
    markup.endsWith(`<p class="mbk-reset">${NO_CHANGES}</p></section>`),
    markup,
  );
});

test("an entry with its own Changes row, or before Changes is ready, keeps the explanation out", () => {
  const listed = details({
    changes: { status: "ready", kind: "changed", included: true },
    detail: usesAction,
  });
  assert.ok(!listed.includes(SHARED), listed);
  const pending = details({
    changes: { status: "pending" },
    detail: usesAction,
  });
  assert.ok(!pending.includes(SHARED), pending);
});

test("an unaffected unchanged screen keeps its no-changes line", () => {
  const markup = details({});
  assert.ok(!markup.includes(SHARED), markup);
  assert.ok(
    markup.endsWith(`<p class="mbk-reset">${NO_CHANGES}</p></section>`),
    markup,
  );
});
