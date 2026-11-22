import type { ReactNode } from "react";

import { displayName } from "../../api/labels";
import type { Project, Session, User } from "../../api/types";
import { StatusBadge } from "../../components/controls";
import { AccountTrigger } from "../../viewer/account-trigger";
import type { BarPlacement } from "../../viewer/bar";
import {
  BarAction,
  ProjectTrigger,
  PublicationMeta,
  PublicationTrigger,
  PullRequestLink,
  Slot,
  ViewLatest,
} from "../../viewer/chrome";
import { ReferenceTriggerWait } from "../../viewer/chrome-wait";
import type { ViewerSlots, ViewerView } from "../../viewer/host";
import { PillDot, PillGlyph, PublicationPill } from "../../viewer/pill";
import type { ReferenceKind } from "../../viewer/pill";
import type { PublicationState } from "../../viewer/resolution";
import {
  publicationState,
  publishedDay,
  shortSha,
} from "../../viewer/resolution";
import type { ViewerPanel } from "../../viewer/selection";

import type { SlotRefs } from "./carriers";
import { MoreMenu } from "./more-menu";
import type { ChromeSubject } from "./subject";

/**
 * What the account slot calls the reader, and the whole value behind it when
 * the label is a shortened form.
 *
 * Every account is created by email, so a person who has not set a name is
 * named by their address, which is wider than the compact bar's first row and
 * pushes the publication row off a 320px screen. The local part is the part
 * that identifies them, and the whole address stays reachable as the control's
 * title and accessible name.
 *
 * A reader who has set a name is called by it and nothing else: an accessible
 * name that replaced their name with their address would leave the one word on
 * screen unsayable to voice control and unheard by a screen reader.
 */
export function accountLabel(
  user: User,
  compact: boolean,
): { label: string; whole?: string } {
  const name = displayName(user);
  if (name) return { label: name };
  const email = user.email;
  if (!compact) return { label: email };
  return { label: email.split("@")[0] ?? email, whole: email };
}

/** What the state beside the publication trigger says, in the reader's terms. */
function meta(subject: ChromeSubject): {
  state: PublicationState;
  detail: string;
  sha?: string;
} {
  if (subject.status) return subject.status;
  if (subject.resolving) return { state: "none", detail: "Loading" };
  if (subject.missing) {
    return { state: "failed", detail: "Publication unavailable" };
  }
  const publication = subject.publication;
  if (!publication) return { state: "none", detail: "Not published" };
  const state = publicationState(publication);
  const sha = shortSha(publication.headSha);
  if (state === "ready") {
    return {
      state,
      detail: "Published " + publishedDay(publication.publishedAt),
      sha,
    };
  }
  if (state === "failed") return { state, detail: "Unable to publish", sha };
  if (state === "publishing") return { state, detail: "Publishing now", sha };
  return { state: "none", detail: "No longer kept", sha };
}

/** What the viewer screen hands each slot; every value comes from the API. */
export interface SlotInput {
  session: Session;
  project: Project;
  workspace?: string;
  subject: ChromeSubject;
  /** Which of the package's two views the address selected. */
  view: ViewerView;
  panel?: ViewerPanel;
  /** Which settings pane is open, so the trigger that opened it says so. */
  settingsOpen?: "sections" | "account";
  /** Where the bar's composition puts each action, which More's rows follow. */
  placement: BarPlacement;
  /** The compact menu is controlled above either slot implementation. */
  moreOpen: boolean;
  shareable: boolean;
  refs: SlotRefs;
  /** Each opener names its action, whichever control carried it. */
  onPanel: (panel: ViewerPanel) => void;
  onSettings: () => void;
  onAccount: () => void;
  onLatest?: () => void;
  onMoreOpen: (open: boolean) => void;
}

/** A pull request's publication is also somebody's, so its author leads. */
function attributed(detail: string, author?: string): string {
  return author ? author + " · " + detail : detail;
}

/**
 * The kind of reference the subject names, which the pill's glyph shows: the
 * pull request a publication came from, else its reference. A name that
 * stands in for a reference that no read has reached names neither.
 */
function referenceKind(subject: ChromeSubject): ReferenceKind | undefined {
  if (subject.pullRequestUrl || subject.ref?.kind === "pull-request")
    return "pullRequest";
  return subject.ref?.kind === "branch" ? "branch" : undefined;
}

/**
 * The publication pill: the compact bar's status dot, the reference's glyph,
 * the reference trigger and the state that the full bar shows. Until the
 * address or a read names the reference, the trigger draws its placeholder in
 * its own frame. Beside the pill, the full bar draws the Changes badge, the
 * pull request on GitHub and View latest, when each applies.
 */
function publicationSlot(input: SlotInput): ReactNode {
  const current = meta(input.subject);
  const label = input.subject.label;
  const compact = input.placement.compact;
  const kind = label === undefined ? undefined : referenceKind(input.subject);
  return (
    <Slot
      name="switcher"
      slotRef={input.refs.switcher}
      title={compact ? label : undefined}
    >
      <PublicationPill waiting={label === undefined}>
        {compact && <PillDot state={current.state} />}
        {kind && <PillGlyph kind={kind} />}
        {label === undefined ? (
          <ReferenceTriggerWait />
        ) : (
          <PublicationTrigger
            label={label}
            open={input.panel === "switcher"}
            onOpen={() => input.onPanel("switcher")}
          />
        )}
        <PublicationMeta
          state={current.state}
          detail={attributed(current.detail, input.subject.author)}
          sha={current.sha}
        />
      </PublicationPill>
      {!compact && input.view === "changes" && (
        <span className="fo-top-badge">
          <StatusBadge label="Changes" />
        </span>
      )}
      {!compact && input.subject.pullRequestUrl && (
        <span className="fo-canvas-pill-extra">
          <PullRequestLink url={input.subject.pullRequestUrl} />
        </span>
      )}
      {!compact && input.onLatest && <ViewLatest onOpen={input.onLatest} />}
    </Slot>
  );
}

/**
 * The six cloud actions composed into the package's two top-bar slots, with
 * the More menu that carries the ones the placement groups. Each trigger and
 * each More row opens exactly one overlay under its action's name, and the
 * control that carries that action when the overlay closes is where focus
 * returns.
 */
export function viewerSlots(input: SlotInput): ViewerSlots {
  const reader = accountLabel(input.session.user, true);
  return {
    project: (
      <ProjectTrigger
        workspace={input.workspace}
        project={input.project.name}
        open={input.panel === "projects"}
        onOpen={() => input.onPanel("projects")}
        slotRef={input.refs.projects}
      />
    ),
    publication: publicationSlot(input),
    history: (
      <BarAction
        label="History"
        testID="viewer-history"
        icon="history"
        open={input.panel === "history"}
        onPress={() => input.onPanel("history")}
        slot="history"
        slotRef={input.refs.history}
      />
    ),
    share: (
      <BarAction
        label="Share"
        testID="viewer-share"
        tone="secondary"
        filled={input.panel === undefined && input.settingsOpen === undefined}
        open={input.panel === "share"}
        disabled={!input.shareable}
        onPress={() => input.onPanel("share")}
        slot="share"
        slotRef={input.refs.share}
      />
    ),
    settings: (
      <BarAction
        label="Settings"
        testID="viewer-settings"
        open={input.settingsOpen === "sections"}
        onPress={input.onSettings}
        slot="settings"
        slotRef={input.refs.settings}
      />
    ),
    account: (
      <AccountTrigger
        {...accountLabel(input.session.user, input.placement.compact)}
        testID="viewer-account"
        open={input.settingsOpen === "account"}
        onPress={input.onAccount}
        slotRef={input.refs.account}
      />
    ),
    more: <MoreMenu input={input} reader={reader.whole ?? reader.label} />,
  };
}
