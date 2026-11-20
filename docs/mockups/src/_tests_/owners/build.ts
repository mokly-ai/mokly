import type { Owner } from "../app-regions";

export const buildOwners = {
  // A build's titles and action labels come from `build-copy.ts`. The build
  // address's read, unknown and unreadable states also use the switcher and
  // retry labels that `stage.tsx` writes.
  "product/viewer/standalone/build": {
    region: "stage",
    files: ["viewer/build-copy.ts", "viewer/stage.tsx"],
  },
  "product/viewer/standalone/build/published": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  "product/viewer/standalone/build/failed": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  "product/viewer/standalone/build/failed/timed-out": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  "product/viewer/standalone/build/failed/infrastructure": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  // A plan refusal takes the Team card's title, and the owner's way on is the
  // shared role rule's Open billing.
  "product/viewer/standalone/build/failed/plan": {
    region: "stage",
    files: ["viewer/build-copy.ts", "components/plan-consequence.tsx"],
  },
  "product/viewer/standalone/build/failed/version": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  "product/viewer/standalone/build/superseded": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  "product/viewer/standalone/build/superseded/cancelled": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  "product/viewer/standalone/build/unreadable": {
    region: "stage",
    files: ["viewer/build-copy.ts", "viewer/stage.tsx"],
  },
  // A lockfile builds cannot install: the title and the line are chosen in
  // `build-copy.ts`. The card's one action is a link, which the label
  // comparison does not read, so the line is held to the product as a
  // declared sentence below.
  "product/viewer/standalone/build/lockfile": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  // A Try again the API refused keeps the card's title and its own label;
  // the refusal above it is a fixture cause read from `api/form-error.ts`.
  "product/viewer/standalone/build/refused": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  // A Cancel the API refused keeps the card's title and Cancel, both written
  // in `build-copy.ts`. The refusal above it is a fixture cause read from
  // `api/form-error.ts`.
  "product/viewer/standalone/build/refused/cancel": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  // Cancel and Try again while their requests run: the card's title, each
  // control's working word and the operation screen readers hear are all
  // written in `build-copy.ts`.
  "product/viewer/standalone/build/cancel-busy": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  "product/viewer/standalone/build/try-again-busy": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  // A body that depends on its reader offers no action, so the title chosen
  // in `build-copy.ts` is all a label can compare; the plan refusal's line
  // for everyone but an owner, and the line of a queued build a reviewer
  // cannot cancel, are held to the product as declared sentences.
  "product/viewer/standalone/build/reader": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  "product/viewer/standalone/build/reader/plan": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  // While the workspace read runs, `build-card.tsx` draws the owner's action
  // as a placeholder and names that read for screen readers.
  "product/viewer/standalone/build/reader/plan-loading": {
    region: "stage",
    files: ["viewer/build-copy.ts", "viewer/build-card.tsx"],
  },
  "product/viewer/standalone/build/reader/queued": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  "product/viewer/standalone/build/reader/running": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  // A reference showing its running build draws the same card.
  "product/viewer/standalone/publish/publishing": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  "product/viewer/pull-request/publishing": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  // The publishing card takes its labels from `build-copy.ts`. The reviewer's
  // waiting card keeps the switcher `stage.tsx` writes.
  "product/viewer/standalone/publish": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  "product/viewer/standalone/publish/pull-request": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  "product/viewer/standalone/publish/reader": {
    region: "stage",
    files: ["viewer/build-copy.ts", "viewer/stage.tsx"],
  },
  "product/viewer/standalone/publish/reader-pull-request": {
    region: "stage",
    files: ["viewer/build-copy.ts", "viewer/stage.tsx"],
  },
  // A refused publish request keeps the card's labels from `build-copy.ts`.
  // Where the same request could succeed, the control reads the shared way
  // back, which `settings/write.ts` writes; otherwise it keeps its own label.
  "product/viewer/standalone/publish-refused": {
    region: "stage",
    files: ["viewer/build-copy.ts", "settings/write.ts"],
  },
  "product/viewer/standalone/publish-refused/pull-request": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  // Publish this branch while its request runs keeps the card's title; its
  // working word and the operation screen readers hear are in
  // `build-copy.ts` too.
  "product/viewer/standalone/publish-busy": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
} as const satisfies Record<string, Owner>;
