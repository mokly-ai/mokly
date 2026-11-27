import { Badge } from "@firna/ui/badge";

import { Action } from "../page-parts";

import { AccountTrigger } from "./account-trigger";
import type { AccountLabel } from "./account-trigger";
import { HistoryTrigger, MoreTrigger, ShareTrigger } from "./bar-actions";
import type { CheckedPullRequest } from "./check-panel";
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
  /** The pull request whose Mokly check the Changes tab shows. */
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
 * The `topBarStart` slot: the quiet workspace and project switcher on the full
 * bar. The compact bar carries the project in More and draws nothing here, so
 * a phone leaves the slot empty and the package gives the centre column the
 * room after the mark. A desktop drawing still holds the full bar's switcher
 * there, hidden on its compact bar.
 */
export function PublishedSlotStart({
  viewport,
  workspace,
  project,
}: {
  viewport: "mobile" | "desktop";
  workspace: string;
  project: string;
}) {
  return slotBars(viewport)
    .filter((bar) => !bar.compact)
    .map((bar) => (
      <div
        key={bar.part ?? "full"}
        className={slotClass("fo-package-slot-start", bar)}
      >
        <span className="fo-top-slot fo-top-project">
          <ProjectTrigger workspace={workspace} project={project} />
        </span>
      </div>
    ));
}

/**
 * The `topBarCenter` slot: the publication pill, in the middle of the full bar
 * and right after the mark on the compact bar. The published viewer always
 * shows a ready publication. The full bar draws the publication's Changes
 * badge, GitHub and View latest beside the pill.
 */
export function PublishedSlotCenter({
  viewport,
  subject,
}: {
  viewport: "mobile" | "desktop";
  subject: PublishedSubject;
}) {
  return slotBars(viewport).map((bar) => (
    <div
      key={bar.part ?? "compact"}
      className={slotClass("fo-package-slot-center", bar)}
    >
      <span className="fo-package-publication">
        <ReferenceTrigger
          bar={bar}
          kind={subject.kind}
          reference={subject.label}
          meta={{ state: "ready", detail: subject.detail, sha: subject.sha }}
        />
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
          <span className="fo-top-slot fo-top-fixed fo-bar-label-only">
            <HistoryTrigger />
          </span>
          <span className="fo-top-slot fo-top-fixed fo-bar-glyph-only">
            <HistoryTrigger iconOnly />
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
 * bar, with History's label or its clock alone as the bar's width holds, and
 * one More menu on the compact bar.
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
 * cannot authenticate in-page: the stage's blocked-access card, which offers
 * no action.
 */
export function ComparisonOverlay() {
  return (
    <div className="fo-viewer-overlay fo-stage-canvas">
      <StageAccessBlocked />
    </div>
  );
}
