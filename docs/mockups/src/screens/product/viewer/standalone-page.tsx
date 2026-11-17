import type { ReactNode } from "react";

import type { Viewport } from "@mokly/mokly";

import { sample } from "../../../fixtures/product";
import type { ScreenState } from "../../../fixtures/product-states";
import { publication } from "../../../fixtures/publications";

import type { AccountLabel } from "./chrome";
import { ViewerScreen, isPublishedPath } from "./screen";
import type { SlotMeta } from "./slots";
import { BranchSlot } from "./slots";
import { stageBody } from "./stage";
import { StageUnpublished } from "./unpublished-stage";

const meta = {
  default: {
    state: "ready",
    detail: publication.published,
    sha: publication.sha,
  },
  empty: { state: "none", detail: "Not published" },
  loading: { state: "none", detail: "Loading" },
  error: { state: "failed", detail: "Publication unavailable" },
} as const satisfies Record<ScreenState, SlotMeta>;

/** A failed attempt is named for what it tried; it still has its commit. */
export const failedMeta = {
  state: "failed",
  detail: "Unable to publish",
  sha: publication.sha,
} as const satisfies SlotMeta;

/**
 * The standalone entry: the chrome names the branch, or waits for a read to
 * name it, and the stage holds its publication, or the one card a situation
 * without one draws.
 */
export function StandalonePage({
  state,
  viewport,
  screen,
  unpublished = <StageUnpublished />,
  stage,
  latest = false,
  publicationMeta,
  account,
  workspace,
  project,
  subject = publication.branch,
  reference,
  unnamed = false,
  comparisonBlocked,
}: {
  state: ScreenState;
  viewport: Viewport;
  screen?: string;
  unpublished?: ReactNode;
  /** A card the stage owns for a situation the four states do not describe. */
  stage?: ReactNode;
  /**
   * Whether a newer publication has arrived, so that the chrome offers View
   * latest beside the publication it is already showing.
   */
  latest?: boolean;
  /** What the chrome says about a publication no state above describes. */
  publicationMeta?: SlotMeta;
  /** Who the bar calls the reader, when it is not their own display name. */
  account?: AccountLabel;
  workspace?: string;
  project?: string;
  /**
   * The branch the page is about, when it is not the one Cal is reading, or
   * what the address named while no branch has resolved.
   */
  subject?: string;
  /** What the chrome calls the reference, when the read never reached one. */
  reference?: string;
  /**
   * Whether nothing names the reference yet: the address names none, as a
   * publication's address does, and no read has answered. The trigger waits
   * as its placeholder, and the heading names the project alone.
   */
  unnamed?: boolean;
  /** Recovery the published viewer reports over its own stage. */
  comparisonBlocked?: boolean;
}) {
  const current: SlotMeta = publicationMeta ?? meta[state];
  const name = reference ?? subject;
  const body = stage ?? stageBody(state, unpublished);
  const shared = {
    id: "product/viewer/standalone",
    state,
    screen,
    viewport,
    heading: unnamed ? sample.project : sample.project + " · " + subject,
    account,
    workspace,
    project,
  };
  if (isPublishedPath(state, body))
    return (
      <ViewerScreen
        {...shared}
        published
        comparisonBlocked={comparisonBlocked}
        publishedSubject={{
          label: name,
          detail: current.detail,
          sha: current.sha,
          latest,
        }}
      />
    );
  return (
    <ViewerScreen
      {...shared}
      publication={
        <BranchSlot
          viewport={viewport}
          name={unnamed ? undefined : name}
          meta={current}
        />
      }
    >
      {body}
    </ViewerScreen>
  );
}
