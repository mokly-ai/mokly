import type { ReactNode } from "react";

import { displayName } from "../../api/labels";
import type { Project, Session, User } from "../../api/types";
import { StatusBadge } from "../../components/controls";
import { AccountMenu } from "../../viewer/account-menu";
import type { AccountActions, AccountReader } from "../../viewer/account-menu";
import type { BarPlacement } from "../../viewer/bar";
import {
  BarAction,
  ProjectTrigger,
  PullRequestLink,
  Slot,
  ViewLatest,
} from "../../viewer/chrome";
import { ReferenceTriggerWait } from "../../viewer/chrome-wait";
import type { ViewerSlots, ViewerView } from "../../viewer/host";
import {
  PillDot,
  PublicationMeta,
  PublicationPill,
  PublicationTrigger,
} from "../../viewer/pill";
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
 * What the account calls the reader: their whole display name, with their
 * address beneath it in the account rows, or their whole address, once, when
 * they have set no name. Every account is created by email, so a person who
 * has not set a name is named by their address.
 *
 * A reader who has set a name is called by it and nothing else on the avatar:
 * an accessible name that replaced their name with their address would leave
 * the name they chose unheard by a screen reader.
 */
export function accountLabel(user: User): AccountReader {
  const name = displayName(user);
  return name ? { name, address: user.email } : { name: user.email };
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
      detail: "Ready · " + publishedDay(publication.publishedAt),
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
  /** Whether the settings dialog is open, on any pane. */
  settingsOpen: boolean;
  /** Where the bar's composition puts each action, which More's rows follow. */
  placement: BarPlacement;
  /** The menus are controlled above either slot implementation. */
  moreOpen: boolean;
  accountOpen: boolean;
  shareable: boolean;
  refs: SlotRefs;
  /** Each opener names its action, whichever control carried it. */
  onPanel: (panel: ViewerPanel) => void;
  /** What the account rows do, in the account menu and in More. */
  account: AccountActions;
  onLatest?: () => void;
  onMoreOpen: (open: boolean) => void;
  onAccountOpen: (open: boolean) => void;
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
 * The publication pill: one control that draws the compact bar's status dot,
 * the reference's glyph, the reference and the state that the full bar
 * shows, and opens the switcher. Until the address or a read names the
 * reference, the pill holds no control: the reference's placeholder in its
 * own frame, beside the state. Beside the pill, the full bar draws the
 * Changes badge, the pull request on GitHub and View latest, when each
 * applies.
 */
function publicationSlot(input: SlotInput): ReactNode {
  const current = meta(input.subject);
  const detail = attributed(current.detail, input.subject.author);
  const label = input.subject.label;
  const compact = input.placement.compact;
  return (
    <Slot name="switcher" slotRef={input.refs.switcher}>
      {label === undefined ? (
        <PublicationPill waiting>
          {compact && <PillDot state={current.state} />}
          <ReferenceTriggerWait />
          <PublicationMeta
            state={current.state}
            detail={detail}
            sha={current.sha}
          />
        </PublicationPill>
      ) : (
        <PublicationTrigger
          label={label}
          kind={referenceKind(input.subject)}
          state={current.state}
          detail={detail}
          sha={current.sha}
          open={input.panel === "switcher"}
          onOpen={() => input.onPanel("switcher")}
        />
      )}
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
 * The five cloud actions composed into the package's top-bar slots, with the
 * More menu that carries the ones the placement groups. Each trigger and each
 * More row opens exactly one overlay under its action's name, and the control
 * that carries that action when the overlay closes is where focus returns.
 * The avatar and More open menus, whose account rows hold Settings.
 */
export function viewerSlots(input: SlotInput): ViewerSlots {
  const reader = accountLabel(input.session.user);
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
        filled={input.panel === undefined && !input.settingsOpen}
        open={input.panel === "share"}
        disabled={!input.shareable}
        onPress={() => input.onPanel("share")}
        slot="share"
        slotRef={input.refs.share}
      />
    ),
    account: (
      <AccountMenu
        reader={reader}
        open={input.accountOpen}
        onOpenChange={input.onAccountOpen}
        actions={input.account}
        slotRef={input.refs.account}
      />
    ),
    more: <MoreMenu input={input} reader={reader} />,
  };
}
