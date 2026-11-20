/**
 * The stage's drawings beside the build cards, read from the viewer builds
 * contract: the publishing cards at rest and refused with the CI setup guide
 * they offer, and the build address before it resolves a build.
 * `build-drawings.ts` holds the build cards.
 */

import { causes } from "../fixtures/product-states";
import { site } from "../fixtures/site";

/** One publishing card: its title and what its one control reads. */
export interface PublishCard {
  path: string;
  title: string;
  control: string;
  /** The drawing the control opens, or none when it leads nowhere new. */
  opens?: string;
  /** The refusal the request was answered with, when it was. */
  cause?: string;
}

/**
 * The publishing cards, at rest and refused. Each holds its control and the
 * CI setup guide as one fragment; a refusal sets that fragment between the
 * cause and the reference Mokly answered with. A refusal the same request
 * could get past reads the way back, and one it cannot keeps the label.
 */
export const publishCards: readonly PublishCard[] = [
  {
    path: "product/viewer/standalone/publish",
    title: "No publications yet",
    control: "Publish this branch",
    opens: "product/viewer/standalone/build/empty",
  },
  {
    path: "product/viewer/standalone/publish/pull-request",
    title: "No publication yet",
    control: "Publish this pull request",
    opens: "product/viewer/standalone/build/empty",
  },
  {
    path: "product/viewer/standalone/publish-refused",
    title: "No publications yet",
    control: "Try again",
    opens: "product/viewer/standalone/build/empty",
    cause: causes.busy,
  },
  {
    path: "product/viewer/standalone/publish-refused/pull-request",
    title: "No publication yet",
    control: "Publish this pull request",
    cause: causes.buildsUnavailable,
  },
];

/** The CI setup guide every publishing card offers beside its control. */
export const publishGuide = {
  label: "Publish from CI",
  href: site.publishFromCi,
} as const;

/** A build address that has not resolved a build, and what its stage says. */
export const unresolved = [
  {
    path: "product/viewer/standalone/build/loading",
    detail: "Loading",
    stage: "Loading build…",
    actions: [],
  },
  {
    path: "product/viewer/standalone/build/error",
    detail: "Build unavailable",
    stage: "This build is unavailable",
    actions: [["Choose another branch", "firna-button-primary"]],
  },
  {
    path: "product/viewer/standalone/build/unreadable",
    detail: "Build couldn’t load",
    stage: "This build couldn’t load",
    actions: [["Try again", "firna-button-primary"]],
  },
] as const;
