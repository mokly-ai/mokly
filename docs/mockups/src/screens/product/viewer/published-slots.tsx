import { Badge } from "@firna/ui/badge";

import { Action } from "../page-parts";

import { AccountTrigger } from "./account-trigger";
import type { AccountLabel } from "./account-trigger";
import { Pill, PillDot, PillGlyph, PillState } from "./pill";
import type { ReferenceKind } from "./pill";
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
}

/**
 * One cloud action in a package slot: the registered Button through `Action`,
 * compact, on one line and with no catalogue link, so it stays the button
 * that the application draws. The renderer's static control theme reaches
 * it, because the embedded layout renders the slots in the screen's own React
 * tree. The registered Button takes its touch target from the drawing's
 * viewport, not from the composition, because a compact bar also fits a
 * narrow desktop window.
 */
function SlotButton({
  instance,
  label,
  tone = "quiet",
  chevron,
  whole,
  block,
}: {
  instance: string;
  label: string;
  tone?: "primary" | "quiet" | "secondary";
  chevron?: boolean;
  whole?: string;
  block?: boolean;
}) {
  return (
    <Action
      instance={instance}
      label={label}
      whole={whole}
      tone={tone}
      size="sm"
      chevron={chevron}
      block={block}
      singleLine
    />
  );
}

/**
 * One composition's start: the quiet workspace and project switcher, then the
 * publication pill, with the publication's Changes badge, GitHub and View
 * latest beside it. The compact bar keeps only the pill, with the status dot
 * and the reference's compact name. The published viewer always shows a
 * ready publication.
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
  const named = workspace + " / " + project;
  return (
    <div className={slotClass("fo-package-slot-start", bar)}>
      {!bar.compact && (
        <span className="fo-top-slot fo-top-project" title={named}>
          <span className="fo-top-variable-control">
            <SlotButton
              instance="viewer-project"
              label={named}
              whole={named}
              chevron
              block
            />
          </span>
        </span>
      )}
      <span className="fo-package-publication">
        <Pill>
          {bar.compact && <PillDot state="ready" />}
          <PillGlyph kind={subject.kind} />
          <ReferenceTrigger bar={bar} reference={subject.label} />
          {!bar.compact && (
            <PillState
              state="ready"
              detail={subject.detail}
              sha={subject.sha}
            />
          )}
        </Pill>
        {!bar.compact && subject.changes && (
          <span className="fo-top-badge">
            <Badge tone="neutral" size="sm">
              Changes
            </Badge>
          </span>
        )}
        {!bar.compact && subject.github && (
          <SlotButton instance="viewer-github" label="GitHub" />
        )}
        {!bar.compact && subject.latest && (
          <SlotButton
            instance="viewer-view-latest"
            label="View latest"
            tone="secondary"
          />
        )}
      </span>
    </div>
  );
}

/**
 * The `topBarStart` slot: the workspace and project switcher and the
 * publication pill on the full bar, and the pill alone on the compact bar.
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
        <SlotButton instance="viewer-more" label="More" chevron />
      ) : (
        <>
          <span className="fo-top-slot fo-top-fixed">
            <SlotButton instance="viewer-history" label="History" />
          </span>
          <span className="fo-top-slot fo-top-fixed">
            <SlotButton
              instance="viewer-share"
              label="Share"
              tone={layered ? "secondary" : "primary"}
            />
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
