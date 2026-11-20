import type { Viewport } from "@mokly/mokly";

import type { PublicationState } from "../../../fixtures/publications";
import { SiteLink } from "../page-parts";
import { WaitingDot } from "../placeholder-rows";
import { ControlPlaceholder, TextBar } from "../placeholders";

import { PublicationMeta } from "./chrome";
import { slotBars } from "./published-bar";
import { ReferenceTrigger } from "./reference-trigger";

/** What the middle slot says about the publication or build the stage shows. */
export interface SlotMeta {
  state: PublicationState;
  detail: string;
  sha?: string;
}

/** A pull request as the publication slot names it. */
export interface SlotPullRequest {
  number: string;
  title: string;
  author: string;
  github: string;
}

/**
 * The width of the reference trigger's own frame, in px: its 9rem, in which
 * the bar draws the trigger and its placeholder, as the application does.
 */
const referenceFrameWidth = 144;

/**
 * The reference trigger while nothing names the reference: a placeholder in
 * the reference's own frame, hidden from assistive technology like every
 * placeholder. The frame is the same in both compositions, so one placeholder
 * serves both.
 */
function ReferencePlaceholder() {
  return (
    <span className="fo-top-reference">
      <ControlPlaceholder size="sm" width={referenceFrameWidth} />
    </span>
  );
}

/**
 * The reference trigger of each composition that the drawing's bar can show,
 * each opening the switcher. A phone draws the compact bar only, and a desktop
 * drawing draws both for the switch in `viewer.css` to show one.
 */
function ReferenceTriggers({
  viewport,
  reference,
}: {
  viewport: Viewport;
  reference: string;
}) {
  return slotBars(viewport).map((bar) => (
    <ReferenceTrigger
      key={bar.part ?? "compact"}
      bar={bar}
      reference={reference}
      to="product/viewer/switcher"
    />
  ));
}

/**
 * The branch trigger, which opens the switcher, and what the stage shows of
 * it. Until the address or a read names the reference, the trigger is its
 * placeholder, and the state beside it keeps its words.
 */
export function BranchSlot({
  viewport,
  name,
  meta,
}: {
  viewport: Viewport;
  /** The reference's name, once the address or a read gives it. */
  name?: string;
  meta: SlotMeta;
}) {
  return (
    <>
      {name === undefined ? (
        <ReferencePlaceholder />
      ) : (
        <ReferenceTriggers viewport={viewport} reference={name} />
      )}
      <PublicationMeta state={meta.state} detail={meta.detail} sha={meta.sha} />
    </>
  );
}

/**
 * The publication slot while the route reads the project. The reference and
 * its state are the project's to tell, so the trigger is a placeholder in the
 * reference's own frame and the state is a dot and a bar in its own line, both
 * hidden from assistive technology like every placeholder.
 */
export function SlotPlaceholder() {
  return (
    <>
      <ReferencePlaceholder />
      <span className="fo-top-state" aria-hidden="true">
        <WaitingDot />
        <span className="fo-top-state-detail">
          <TextBar width="6em" />
        </span>
      </span>
    </>
  );
}

/** The pull request trigger with its author and the pull request on GitHub. */
export function PullRequestSlot({
  viewport,
  pull,
  meta,
}: {
  viewport: Viewport;
  pull: SlotPullRequest;
  meta: SlotMeta;
}) {
  return (
    <>
      <ReferenceTriggers
        viewport={viewport}
        reference={pull.number + " " + pull.title}
      />
      <PublicationMeta
        state={meta.state}
        detail={pull.author + " · " + meta.detail}
        sha={meta.sha}
      >
        <SiteLink href={pull.github} label="GitHub" />
      </PublicationMeta>
    </>
  );
}
