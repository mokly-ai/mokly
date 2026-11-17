import assert from "node:assert/strict";
import { test } from "node:test";

import { expectedProductScreens } from "../../../../../docs/mockups/src/_tests_/product-inventory";
import { wayBack } from "../../settings/write";
import type { RequestControl } from "../../viewer/request-controls";
import {
  bodyProblems,
  cardProblems,
  refusalCases,
  refusalProblems,
  shownBodies,
  undrawn,
  without,
} from "./stage-problems";
import type {
  ActionCase,
  CardCase,
  LabelRule,
  LineCase,
  RefusalCase,
} from "./stage-problems";
import type { ReferenceKind } from "./stage-cases";

/**
 * Every card the empty stage chooses, every body a build card shows and every
 * way a request control reads after a refusal has a drawing, as the
 * application parity rule of `mockup-verification.md` requires. The
 * catalogue's own parity suite reads from each drawing to the application;
 * this reads the other way, from what the application can show to the drawing
 * that shows it, so a card, a body or a refusal the application gains without
 * a drawing fails here instead of shipping undrawn.
 *
 * A drawing is a screen or a variant that the authored product inventory
 * declares. The mockups stage proves that the built catalogue holds every one
 * of them in each viewport and scheme, so this test reads no build output and
 * runs before the catalogue is built.
 */

/** Every drawing the authored product inventory declares: each screen and its variants. */
const inventory: ReadonlySet<string> = new Set(
  expectedProductScreens().flatMap(({ path, variants }) => [path, ...variants]),
);

/**
 * The drawing of each card, for each kind of reference that reaches it. Keyed
 * by every card the decision can return, so a card it gains fails to compile
 * here until it names its drawing. The card that waits on the workspace read
 * is the stage's waiting card, titled with that read. The workspace's own
 * cards name no reference, so a pull request's maps to the one drawing of
 * each.
 */
const cardDrawings = {
  "pull-request": { "pull-request": "product/viewer/pull-request/empty" },
  "closed-pull-request closed": {
    "pull-request": "product/viewer/pull-request/closed",
  },
  "closed-pull-request merged": {
    "pull-request": "product/viewer/pull-request/closed/merged",
  },
  "fork-pull-request": { "pull-request": "product/viewer/pull-request/fork" },
  "pending-workspace": {
    branch: "product/viewer/standalone/plan-loading",
    "pull-request": "product/viewer/standalone/plan-loading",
  },
  "unreadable-workspace": {
    branch: "product/viewer/standalone/workspace-unreadable",
    "pull-request": "product/viewer/standalone/workspace-unreadable",
  },
  "plan-required owner": {
    branch: "product/viewer/standalone/plan",
    "pull-request": "product/viewer/pull-request/plan",
  },
  "plan-required reader": {
    branch: "product/viewer/standalone/plan-reader",
    "pull-request": "product/viewer/pull-request/plan/reader",
  },
  publish: {
    branch: "product/viewer/standalone/publish",
    "pull-request": "product/viewer/standalone/publish/pull-request",
  },
  "publish-reader": {
    branch: "product/viewer/standalone/publish/reader",
    "pull-request": "product/viewer/standalone/publish/reader-pull-request",
  },
  "set-up administrator": { branch: "product/viewer/standalone/empty" },
  "set-up reader": { branch: "product/viewer/standalone/reader" },
} as const satisfies Record<CardCase, Partial<Record<ReferenceKind, string>>>;

/**
 * The drawing of each body a build card shows: what its action place holds
 * and the kind of line beneath its title. Keyed by every action, by the
 * owner's action as a placeholder and by none, so an action the card gains
 * fails to compile here until it names a drawing. Bodies that differ by state
 * or by reader stay apart: the reviewer's failed, queued and running builds,
 * the plan refusal for everyone but an owner and the plan refusal while the
 * workspace read runs each have their own drawing.
 */
const bodyDrawings = {
  cancel: {
    waiting: "product/viewer/standalone/build/empty",
    none: "product/viewer/standalone/build",
  },
  "open-catalogue": { none: "product/viewer/standalone/build/published" },
  "open-newer": { none: "product/viewer/standalone/build/superseded" },
  "open-billing": { none: "product/viewer/standalone/build/failed/plan" },
  "publish-from-ci": { cause: "product/viewer/standalone/build/lockfile" },
  "try-again": {
    cause: "product/viewer/standalone/build/failed",
    none: "product/viewer/standalone/build/superseded/cancelled",
  },
  placeholder: { none: "product/viewer/standalone/build/reader/plan-loading" },
  none: {
    cause: "product/viewer/standalone/build/reader",
    plan: "product/viewer/standalone/build/reader/plan",
    none: "product/viewer/standalone/build/reader/running",
    waiting: "product/viewer/standalone/build/reader/queued",
  },
} as const satisfies Record<ActionCase, Partial<Record<LineCase, string>>>;

/**
 * The drawing of each way a refused request reads, for each control the
 * application's cards offer that sends one. Keyed by every such control, so a
 * control the cards gain fails to compile here until it names its drawings.
 * The publishing card's control reads the way back where the same request
 * could succeed and keeps its own label where it would be refused again; a
 * build card's Try again reads Try again either way, so one drawing shows
 * both; and Cancel keeps Cancel after every refusal and failure.
 */
const refusalDrawings = {
  publish: {
    "way-back": "product/viewer/standalone/publish-refused",
    "own-label": "product/viewer/standalone/publish-refused/pull-request",
  },
  "try-again": {
    "way-back": "product/viewer/standalone/build/refused",
    "own-label": "product/viewer/standalone/build/refused",
  },
  cancel: { "own-label": "product/viewer/standalone/build/refused/cancel" },
} as const satisfies Record<
  RequestControl,
  Partial<Record<RefusalCase, string>>
>;

test("every empty-stage card has a drawing for each reference kind that reaches it", () => {
  assert.deepEqual(cardProblems(inventory, cardDrawings), []);
});

test("a plan-refused pull request's Team card has its own drawing for each reader", () => {
  for (const card of ["plan-required owner", "plan-required reader"] as const) {
    const drawing = cardDrawings[card]["pull-request"];
    assert.deepEqual(cardProblems(without(inventory, drawing), cardDrawings), [
      drawing + " is not a drawing in the product inventory",
    ]);
    const { "pull-request": removed, ...kept } = cardDrawings[card];
    assert.ok(removed);
    assert.deepEqual(
      cardProblems(inventory, { ...cardDrawings, [card]: kept }),
      [card + " for a pull-request has no drawing"],
    );
  }
});

test("every build-card body has a drawing", () => {
  assert.deepEqual(bodyProblems(inventory, bodyDrawings), []);
});

test("every way a refused request reads has a drawing", () => {
  assert.deepEqual(refusalProblems(inventory, refusalDrawings), []);
  // Losing either publishing refusal's drawing, or one of its mappings, is
  // reported.
  for (const lost of ["way-back", "own-label"] as const) {
    const drawing = refusalDrawings.publish[lost];
    assert.deepEqual(
      refusalProblems(without(inventory, drawing), refusalDrawings),
      [drawing + " is not a drawing in the product inventory"],
    );
    const { [lost]: removed, ...kept } = refusalDrawings.publish;
    assert.ok(removed);
    assert.deepEqual(
      refusalProblems(inventory, { ...refusalDrawings, publish: kept }),
      ["publish refused with its " + lost + " has no drawing"],
    );
  }
});

test("a refused Cancel keeps its label, as its own drawing shows", () => {
  const drawing = refusalDrawings.cancel["own-label"];
  assert.deepEqual([...refusalCases("cancel")], ["own-label"]);
  assert.deepEqual(
    refusalProblems(without(inventory, drawing), refusalDrawings),
    [drawing + " is not a drawing in the product inventory"],
  );
  assert.deepEqual(
    refusalProblems(inventory, { ...refusalDrawings, cancel: {} }),
    ["cancel refused with its own-label has no drawing"],
  );
  // A Cancel that read the shared way back where the same request could
  // succeed would draw a body no drawing shows: a control a reader takes for
  // a new build.
  const shared: LabelRule = () => wayBack;
  assert.deepEqual(refusalProblems(inventory, refusalDrawings, shared), [
    "cancel refused with its way-back has no drawing",
  ]);
});

test("a body that depends on its reader is a body of its own", () => {
  const shown = shownBodies();
  for (const body of [
    "none|cause",
    "none|plan",
    "none|none",
    "none|waiting",
    "placeholder|none",
  ])
    assert.ok(shown.has(body), body);
  // Removing any of the reader's drawings leaves its body unmapped, and losing
  // one from the inventory is reported.
  for (const line of ["cause", "plan", "none", "waiting"] as const) {
    const { [line]: removed, ...kept } = bodyDrawings.none;
    assert.ok(removed);
    assert.deepEqual(bodyProblems(inventory, { ...bodyDrawings, none: kept }), [
      "none|" + line + " is shown but has no drawing",
    ]);
    assert.deepEqual(bodyProblems(without(inventory, removed), bodyDrawings), [
      removed + " is not a drawing in the product inventory",
    ]);
  }
  // The plan refusal's wait draws the owner's action as a placeholder, so it
  // is a body apart from every card that offers no action and has no line.
  const wait = bodyDrawings.placeholder.none;
  assert.deepEqual(
    bodyProblems(inventory, { ...bodyDrawings, placeholder: {} }),
    ["placeholder|none is shown but has no drawing"],
  );
  assert.deepEqual(bodyProblems(without(inventory, wait), bodyDrawings), [
    wait + " is not a drawing in the product inventory",
  ]);
});

test("a drawing the inventory does not declare is reported", () => {
  assert.deepEqual(undrawn("product/viewer/standalone/build", inventory), []);
  assert.deepEqual(
    undrawn("product/viewer/standalone/build/failed/plan", inventory),
    [],
    "a variant is a drawing",
  );
  assert.deepEqual(undrawn("product/viewer/standalone/undrawn", inventory), [
    "product/viewer/standalone/undrawn is not a drawing in the product inventory",
  ]);
  const card = cardDrawings["fork-pull-request"]["pull-request"];
  assert.deepEqual(cardProblems(without(inventory, card), cardDrawings), [
    card + " is not a drawing in the product inventory",
  ]);
});

test("a mapped drawing that no case reaches is reported", () => {
  assert.deepEqual(
    cardProblems(inventory, {
      ...cardDrawings,
      "set-up reader": {
        ...cardDrawings["set-up reader"],
        "pull-request": cardDrawings["set-up reader"].branch,
      },
    }),
    ["set-up reader for a pull-request is mapped but no reference reaches it"],
  );
  assert.deepEqual(
    bodyProblems(inventory, {
      ...bodyDrawings,
      cancel: { ...bodyDrawings.cancel, cause: bodyDrawings.cancel.none },
    }),
    ["cancel|cause is mapped but no card shows it"],
  );
});
