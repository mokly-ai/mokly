import { Badge } from "@firna/ui/badge";
import { StatusDot as FirnaStatusDot } from "@firna/ui/status-dot";

import { Action } from "../page-parts";
import { slotBars, slotClass } from "./published-bar";
import type { SlotBar } from "./published-bar";
import { ReferenceTrigger } from "./reference-trigger";
import { StageAccessBlocked } from "./stage-access";

/** The publication facts the cloud-owned package slots render. */
export interface PublishedSubject {
  label: string;
  detail: string;
  sha?: string;
  changes?: boolean;
  github?: boolean;
  latest?: boolean;
}

/** What the published slot calls the reader. */
export interface PublishedAccountLabel {
  label: string;
  whole?: string;
}

/**
 * One cloud action in a package slot: the registered Button through `Action`,
 * compact, on one line and with no catalogue link. The renderer's static
 * control theme reaches it, because the embedded layout renders the slots in
 * the screen's own React tree. The registered Button takes its touch target
 * from the drawing's viewport, not from the composition, because a compact
 * bar also fits a narrow desktop window.
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
  tone?: "quiet" | "secondary";
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
      {!bar.compact && (
        <span
          className="fo-top-slot fo-top-project"
          title={workspace + " / " + project}
        >
          <span className="fo-top-variable-control">
            <SlotButton
              instance="viewer-project"
              label={workspace + " / " + project}
              whole={workspace + " / " + project}
              tone="secondary"
              chevron
              block
            />
          </span>
        </span>
      )}
      <span className="fo-package-publication">
        <ReferenceTrigger bar={bar} reference={subject.label} />
        {!bar.compact && (
          <span className="fo-top-state">
            <FirnaStatusDot tone="primary" size="sm" />
            <span className="fo-top-state-detail">{subject.detail}</span>
            {subject.sha && <code className="mono-value">{subject.sha}</code>}
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
        )}
      </span>
    </div>
  );
}

/**
 * The `topBarStart` slot: the workspace and project switcher, then the
 * reference with its publication state, Changes, GitHub and View latest. The
 * compact bar keeps only the reference's short name.
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

function EndSlot({
  bar,
  account,
}: {
  bar: SlotBar;
  account: PublishedAccountLabel;
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
              tone="secondary"
            />
          </span>
          <span className="fo-top-slot fo-top-fixed">
            <SlotButton instance="viewer-settings" label="Settings" />
          </span>
          <span className="fo-top-slot fo-top-account" title={account.whole}>
            <SlotButton
              instance="viewer-account"
              label={account.label}
              whole={account.whole ?? account.label}
              chevron
              block
            />
          </span>
        </>
      )}
    </div>
  );
}

/**
 * The `topBarEnd` slot: History, Share, Settings and the account on the full
 * bar, and one More menu on the compact bar.
 */
export function PublishedSlotEnd({
  viewport,
  account,
}: {
  viewport: "mobile" | "desktop";
  account: PublishedAccountLabel;
}) {
  return slotBars(viewport).map((bar) => (
    <EndSlot key={bar.part ?? "compact"} bar={bar} account={account} />
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
