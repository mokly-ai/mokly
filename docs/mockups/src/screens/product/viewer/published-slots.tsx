import { Badge } from "@firna/ui/badge";

import { Action } from "../page-parts";

import { AccountTrigger } from "./account-trigger";
import type { AccountLabel } from "./account-trigger";
import { HistoryTrigger, MoreTrigger, ShareTrigger } from "./bar-actions";
import type { CheckedPullRequest } from "./check-panel";
import { Pill, PillDot, PillGlyph, PillState } from "./pill";
import type { ReferenceKind } from "./pill";
import { ProjectTrigger } from "./project-trigger";
import { slotBars, slotClass } from "./published-bar";
import type { SlotBar } from "./published-bar";
import { ReferenceTrigger } from "./reference-trigger";
import { StageAccessBlocked } from "./stage-access";

/** The publication facts the cloud-owned package slots render. */
export interface PublishedSubject {
  label: string;
  detail: string;
  sha?: string;
  /** The kind of reference the label names, which the pill's glyph shows. */
  kind: ReferenceKind;
  changes?: boolean;
  github?: boolean;
  latest?: boolean;
  /** The pull request whose Mokly check the side panel shows. */
  check?: CheckedPullRequest;
}

/**
 * One cloud action in a package slot that has no part of its own: the
 * registered Button through `Action`, compact, on one line and with no
 * catalogue link, so it stays the button that the application draws. The
 * renderer's static control theme reaches it, because the embedded layout
 * renders the slots in the screen's own React tree. The registered Button
 * takes its touch target from the drawing's viewport, not from the
 * composition, because a compact bar also fits a narrow desktop window. The
 * bar's own controls are the parts of `project-trigger.tsx`,
 * `reference-trigger.tsx`, `bar-actions.tsx` and `account-trigger.tsx`, which
 * the cloud's fallback bar draws too.
 */
function SlotButton({
  instance,
  label,
  tone = "quiet",
}: {
  instance: string;
  label: string;
  tone?: "quiet" | "secondary";
}) {
  return (
    <Action
      instance={instance}
      label={label}
      tone={tone}
      size="sm"
      singleLine
    />
  );
}

/**
 * The publication pill of one composition. The full pill holds the glyph, the
 * whole reference and the publication's state, and the compact pill the
 * status dot, the glyph and the reference's compact name. The published
 * viewer always shows a ready publication.
 */
function PublishedPill({
  bar,
  subject,
}: {
  bar: SlotBar;
  subject: PublishedSubject;
}) {
  return (
    <Pill>
      {bar.compact && <PillDot state="ready" />}
      <PillGlyph kind={subject.kind} />
      <ReferenceTrigger bar={bar} reference={subject.label} />
      {!bar.compact && (
        <PillState state="ready" detail={subject.detail} sha={subject.sha} />
      )}
    </Pill>
  );
}

/**
 * One composition's start, after the package's mark: the quiet workspace and
 * project switcher on the full bar, and the publication pill on the compact
 * bar, whose centre stays empty.
 */
function StartSlot({
  bar,
  subject,
  workspace,
  project,
}: {
  bar: SlotBar;
  subject: PublishedSubject;
  workspace: string;
  project: string;
}) {
  return (
    <div className={slotClass("fo-package-slot-start", bar)}>
      {bar.compact ? (
        <span className="fo-package-publication">
          <PublishedPill bar={bar} subject={subject} />
        </span>
      ) : (
        <span className="fo-top-slot fo-top-project">
          <ProjectTrigger workspace={workspace} project={project} />
        </span>
      )}
    </div>
  );
}

/**
 * The `topBarStart` slot: the workspace and project switcher on the full bar,
 * and the publication pill on the compact bar.
 */
export function PublishedSlotStart({
  viewport,
  subject,
  workspace,
  project,
}: {
  viewport: "mobile" | "desktop";
  subject: PublishedSubject;
  workspace: string;
  project: string;
}) {
  return slotBars(viewport).map((bar) => (
    <StartSlot
      key={bar.part ?? "compact"}
      bar={bar}
      subject={subject}
      workspace={workspace}
      project={project}
    />
  ));
}

/**
 * The `topBarCenter` slot of the full bar: the publication pill in the middle
 * of the bar, with the publication's Changes badge, GitHub and View latest
 * beside it. A phone draws the compact bar only, so its centre stays empty.
 */
export function PublishedSlotCenter({
  viewport,
  subject,
}: {
  viewport: "mobile" | "desktop";
  subject: PublishedSubject;
}) {
  return slotBars(viewport)
    .filter((bar) => !bar.compact)
    .map((bar) => (
      <div
        key={bar.part ?? "full"}
        className={slotClass("fo-package-slot-center", bar)}
      >
        <span className="fo-package-publication">
          <PublishedPill bar={bar} subject={subject} />
          {subject.changes && (
            <span className="fo-top-badge">
              <Badge tone="neutral" size="sm">
                Changes
              </Badge>
            </span>
          )}
          {subject.github && (
            <SlotButton instance="viewer-github" label="GitHub" />
          )}
          {subject.latest && (
            <SlotButton
              instance="viewer-view-latest"
              label="View latest"
              tone="secondary"
            />
          )}
        </span>
      </div>
    ));
}

/**
 * One composition's end. Share takes the signal fill as the screen's one
 * primary action; under a panel or a sheet it keeps the secondary tone,
 * because the layer owns the screen's filled action.
 */
function EndSlot({
  bar,
  account,
  layered,
}: {
  bar: SlotBar;
  account: AccountLabel;
  layered: boolean;
}) {
  return (
    <div className={slotClass("fo-package-slot-end", bar)}>
      {bar.compact ? (
        <MoreTrigger />
      ) : (
        <>
          <span className="fo-top-slot fo-top-fixed">
            <HistoryTrigger />
          </span>
          <span className="fo-top-slot fo-top-fixed">
            <ShareTrigger tone={layered ? "secondary" : "primary"} />
          </span>
          <span className="fo-top-slot fo-top-fixed">
            <AccountTrigger account={account} />
          </span>
        </>
      )}
    </div>
  );
}

/**
 * The `topBarEnd` slot: History, Share and the account's avatar on the full
 * bar, and one More menu on the compact bar.
 */
export function PublishedSlotEnd({
  viewport,
  account,
  layered,
}: {
  viewport: "mobile" | "desktop";
  account: AccountLabel;
  layered: boolean;
}) {
  return slotBars(viewport).map((bar) => (
    <EndSlot
      key={bar.part ?? "compact"}
      bar={bar}
      account={account}
      layered={layered}
    />
  ));
}

/**
 * The `stageOverlay` content of a private comparison the published viewer
 * cannot authenticate in-page: the blocked-access card with its action. A
 * drawing places the message twice, so each placement names its action.
 */
export function ComparisonOverlay({ instance }: { instance: string }) {
  return (
    <div className="fo-viewer-overlay fo-stage-canvas">
      <StageAccessBlocked
        action={
          <SlotButton
            instance={instance}
            label="Open catalogue in a new tab"
            tone="secondary"
          />
        }
      />
    </div>
  );
}
