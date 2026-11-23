/**
 * The shown frames whose rows compare, under the screen controls of the
 * Changes controls contract: a row compares when its shown views are
 * eligible, or when a shown Unmodified view uses a changed component that
 * the row's own detail names.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  CatalogueComponent,
  CatalogueReadModel,
  ChangeKind,
  ComparisonSelection,
} from "@mokly/model";

import { detailKey } from "../src/catalogue/detail_fences.js";
import { workspaceFrames } from "../src/shell/canvas_frames.js";
import { createCatalogue } from "../src/shell/catalogue.js";
import { comparisonFrames } from "../src/shell/comparison_eligible_frames.js";
import { publicWorkspace } from "../src/shell/public_workspace.js";

import {
  detailPairs,
  rawDetailFixtures,
  rawIndexFixture,
  shellModelFixture,
  type DetailFixtures,
} from "./catalogue_v9_fixture.js";

const PARENT = "components/action";
/** The fixture's saved variant, which changed Card affects. */
const AFFECTED = "components/action/default";
const ADDED = "components/action/added";
const CHANGED = "components/action/changed";
/** A saved variant whose Dark view alone changed. */
const DUSK = "components/action/dusk";
/** A saved variant whose Mobile view alone changed, which its set does not show. */
const NARROW = "components/action/narrow";
const HOME = "product/browse/home";
const CARD = "components/card";
const BADGE = "components/badge";

function ready(
  kind: ChangeKind,
): Extract<ComparisonSelection, { status: "ready" }> {
  return { status: "ready", kind, eligible: kind === "changed" };
}

/**
 * A saved variant of the parent, after the fixture's, with the state of its
 * Mobile and Desktop Light views, and of its Desktop Dark view if it has one.
 */
function variant(
  template: CatalogueComponent,
  path: string,
  [mobile, light, dark]: [ChangeKind, ChangeKind, ChangeKind?],
): CatalogueComponent {
  const views = template.views.map((view) => ({
    ...view,
    comparison: ready(view.viewport === "mobile" ? mobile : light),
  }));
  const desktop = views.find((view) => view.viewport === "desktop")!;
  const kind = [mobile, light, dark].includes("changed") ? "changed" : light;
  return {
    ...structuredClone(template),
    changes: { status: "ready", kind, included: kind !== "unmodified" },
    colorSchemes: dark ? ["light", "dark"] : ["light"],
    comparison: ready(kind),
    path,
    title: path.split("/").at(-1)!,
    views: dark
      ? [...views, { ...desktop, colorScheme: "dark", comparison: ready(dark) }]
      : views,
  };
}

/**
 * The entry's own detail names a changed component and lets it compare, and
 * the usage of the entry's views holds `used`.
 */
function names(
  fixtures: DetailFixtures,
  path: string,
  component: string,
  used?: string,
) {
  const detail = fixtures.current[path]!;
  detail.workspace!.comparisonEligible = true;
  detail.workspace!.relatedComponents = [{ path: component, title: component }];
  for (const view of detail.views)
    view.usage = {
      status: "ready",
      instances: used
        ? [
            {
              key: "a1".repeat(32),
              id: "instance",
              componentId: used,
              owner: { kind: "entry" },
              order: 0,
              props: {},
              propsKey: "b2".repeat(32),
            },
          ]
        : [],
      slots: [],
      ranges: [],
    };
}

/** The frames that compare among the frames of one routed entry's canvas. */
function shown(
  path: string,
  viewport: "both" | "desktop",
  edit: (raw: CatalogueReadModel, fixtures: DetailFixtures) => void = () => {},
) {
  const raw = rawIndexFixture();
  const fixtures = rawDetailFixtures();
  edit(raw, fixtures);
  const model = shellModelFixture(
    raw,
    new Map(
      detailPairs(undefined, fixtures).map(([request, detail]) => [
        detailKey(request),
        detail,
      ]),
    ),
  );
  const catalogue = createCatalogue(model);
  const entry = catalogue.byPath.get(path);
  assert.ok(entry?.kind === "screen" || entry?.kind === "component");
  const data = publicWorkspace(catalogue, model, entry, true, undefined, "");
  return comparisonFrames(data, model.details, workspaceFrames(data, viewport));
}

test("a variant set compares its Changed rows and the rows that changed components affect, and keeps the others current", () => {
  const frames = shown(PARENT, "both", (raw, fixtures) => {
    const template = raw.components.find(({ path }) => path === AFFECTED)!;
    raw.components.push(
      variant(template, ADDED, ["added", "added"]),
      variant(template, CHANGED, ["changed", "changed"]),
      variant(template, DUSK, ["unmodified", "unmodified", "changed"]),
      variant(template, NARROW, ["changed", "unmodified"]),
    );
    for (const path of [ADDED, CHANGED, DUSK, NARROW])
      fixtures.current[path] = {
        ...structuredClone(fixtures.current[AFFECTED]!),
        entry: { kind: "component", path },
      };
    // The routed parent's detail names Badge, which none of its views uses.
    names(fixtures, PARENT, BADGE, CARD);
    names(fixtures, AFFECTED, CARD, CARD);
  });
  const desktop = (path: string, scheme: "dark" | "light") => ({
    entry: { path },
    key: `${path}:${scheme}`,
    scheme,
    viewport: "desktop",
  });
  assert.deepEqual(frames, [
    desktop(AFFECTED, "light"),
    desktop(CHANGED, "light"),
    desktop(DUSK, "light"),
    desktop(DUSK, "dark"),
  ]);
});

test("a screen compares its shown frames and leaves out the frames that the viewport hides", () => {
  assert.deepEqual(shown(HOME, "desktop"), [
    {
      entry: { path: HOME },
      key: "desktop-light",
      scheme: "light",
      viewport: "desktop",
    },
  ]);
});
