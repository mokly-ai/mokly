import type { Viewport } from "@mokly/mokly";

import type { PublicationState } from "../../../fixtures/publications";
import { SiteLink } from "../page-parts";
import { WaitingDot } from "../placeholder-rows";
import { ControlPlaceholder, TextBar } from "../placeholders";

import { Pill, PillChevron, PillDot, PillGlyph, PillState } from "./pill";
import type { ReferenceKind } from "./pill";
import { slotBars } from "./published-bar";
import { ReferenceTrigger, switcherPath } from "./reference-trigger";

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
 * The width of the reference trigger's placeholder, in px: the 9rem frame
 * that `viewer.css` gives the trigger, which a branch name such as the one
 * Cal reads fills.
 */
const referenceFrameWidth = 144;

/**
 * The class that shows a part in the compact bar only. A phone draws the
 * compact bar alone, so its parts need none.
 */
function compactPart(viewport: Viewport) {
  return viewport === "mobile" ? undefined : ("fo-compact-bar-only" as const);
}

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
      to={switcherPath}
    />
  ));
}

/**
 * The publication pill of the cloud's bar: the compact bar's dot, the glyph
 * of the reference's kind, the trigger of each composition and the state
 * that the full bar shows. A glyph is drawn only once a branch or pull
 * request names the reference.
 */
function SlotPill({
  viewport,
  kind,
  reference,
  meta,
}: {
  viewport: Viewport;
  kind?: ReferenceKind;
  reference: string;
  meta: SlotMeta;
}) {
  return (
    <Pill>
      <PillDot state={meta.state} part={compactPart(viewport)} />
      {kind && <PillGlyph kind={kind} />}
      <ReferenceTriggers viewport={viewport} reference={reference} />
      <PillState state={meta.state} detail={meta.detail} sha={meta.sha} />
    </Pill>
  );
}

/**
 * The branch trigger, which opens the switcher, and what the stage shows of
 * it, in the pill. Until the address or a read names the reference, the
 * trigger is its placeholder, and the state beside it keeps its words. A
 * name that stands in for a reference no read has reached, such as This
 * build, draws no branch glyph.
 */
export function BranchSlot({
  viewport,
  name,
  meta,
  glyph = true,
}: {
  viewport: Viewport;
  /** The reference's name, once the address or a read gives it. */
  name?: string;
  meta: SlotMeta;
  /** Whether the name is a branch's, so the pill draws the branch glyph. */
  glyph?: boolean;
}) {
  if (name === undefined)
    return (
      <Pill waiting>
        <PillDot state={meta.state} part={compactPart(viewport)} />
        <ReferencePlaceholder />
        <PillState state={meta.state} detail={meta.detail} sha={meta.sha} />
      </Pill>
    );
  return (
    <SlotPill
      viewport={viewport}
      kind={glyph ? "branch" : undefined}
      reference={name}
      meta={meta}
    />
  );
}

/**
 * The publication slot while the route reads the project. The reference and
 * its state are the project's to tell, so the trigger is a placeholder in the
 * reference's own frame and the state is a dot and a bar in its own line, both
 * hidden from assistive technology like every placeholder. The pill keeps its
 * frame, its hairline and its chevron around them.
 */
export function SlotPlaceholder({ viewport }: { viewport: Viewport }) {
  return (
    <Pill waiting>
      <PillDot part={compactPart(viewport)} />
      <ReferencePlaceholder />
      <span className="fo-top-state" aria-hidden="true">
        <span className="fo-canvas-pill-rule" />
        <WaitingDot />
        <span className="fo-top-state-detail">
          <TextBar width="6em" />
        </span>
        <PillChevron />
      </span>
    </Pill>
  );
}

/**
 * The pull request trigger in the pill, with its author beside the state, and
 * the pull request on GitHub beside the pill in the full bar.
 */
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
      <SlotPill
        viewport={viewport}
        kind="pullRequest"
        reference={pull.number + " " + pull.title}
        meta={{ ...meta, detail: pull.author + " · " + meta.detail }}
      />
      {viewport === "desktop" && (
        <span className="fo-canvas-pill-extra fo-full-bar-only">
          <SiteLink href={pull.github} label="GitHub" />
        </span>
      )}
    </>
  );
}
