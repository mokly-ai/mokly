import type { Viewport } from "@mokly/mokly";
import type { ReactNode } from "react";

import type { ScreenState } from "../../../fixtures/product-states";
import {
  failureReference,
  membership,
  unnamedMember,
} from "../../../fixtures/product-states";
import type { SectionTitle } from "../navigation";
import { Action, Pending, Section, StateMessage } from "../page-parts";
import {
  InviteForm,
  Invitations,
  ManagedMember,
  People,
} from "./members-sections";
import type { Managed } from "./members-sections";
import { SettingsSurface } from "./surface";

/** The workspace's name in the pane's headings, which the settings scope supplies. */
const workspaceName = "Mokly";

/**
 * The pane's write that is running: Send invitation, Revoke invitation on the
 * pending invitation's row, or Save role for the person the reader manages.
 */
type MembersWrite = "invite" | "revoke" | "role";

/**
 * The pane's layout: the people beside the invitations, then the invite form
 * beside the person the reader manages. While the members are read, every
 * part draws its waiting form in its own place, and nobody is managed, because
 * the pane selects nobody until the reader asks. While the settings scope
 * loads too, the workspace's name is not known yet, so each heading that
 * names it keeps its known words beside a bar. While one of the pane's writes
 * runs, its control is busy and the parts around it stay where they were.
 */
function Members({
  state,
  page,
  managed,
  scopeLoading = false,
  writing,
}: {
  state: ScreenState;
  page: string;
  managed?: Managed;
  scopeLoading?: boolean;
  writing?: MembersWrite;
}) {
  const waits = state === "loading";
  const named = (words: string): SectionTitle =>
    scopeLoading ? { before: words, bar: "3em" } : words + " " + workspaceName;
  return (
    <div className="fo-stack">
      <div className="fo-two-columns">
        <Section title={named("People in")}>
          <People page={page} waiting={waits} />
        </Section>
        <Section title="Invitations">
          <Invitations state={state} revoking={writing === "revoke"} />
        </Section>
      </div>
      <div className="fo-two-columns">
        <Section title={named("Invite to")}>
          <InviteForm waiting={waits} sending={writing === "invite"} />
        </Section>
        {managed && (
          <Section title={"Manage " + managed.name}>
            <ManagedMember person={managed} saving={writing === "role"} />
          </Section>
        )}
      </div>
    </div>
  );
}

export function MembersPane({
  state,
  viewport,
  managed = membership.selected,
  modal,
  screen,
  scopeLoading = false,
  writing,
}: {
  state: ScreenState;
  viewport: Viewport;
  managed?: Managed;
  /** A question the pane asked over itself, drawn above the frame. */
  modal?: ReactNode;
  screen?: string;
  /** The pane was asked for by its address while the settings scope loads. */
  scopeLoading?: boolean;
  /** The pane's own write, while it runs. */
  writing?: MembersWrite;
}) {
  const page = screen ?? "product/settings/members";
  return (
    <SettingsSurface
      pane="members"
      state={state}
      screen={screen}
      modal={modal}
      viewport={viewport}
      title="Members"
    >
      {scopeLoading ? (
        // The scope read has no text place of its own in the pane: the bar in
        // each heading stands for the workspace's name, not the read's, so
        // screen readers hear the read alone.
        <Pending label="Loading settings" labelMode="screen-reader-only">
          <Members state="loading" page={page} scopeLoading />
        </Pending>
      ) : state === "loading" ? (
        <Pending label="Loading members" labelMode="screen-reader-only">
          <Members state={state} page={page} />
        </Pending>
      ) : state === "error" ? (
        <StateMessage
          title="Members couldn’t load"
          error
          reference={failureReference}
          action={
            <Action
              label="Try again"
              to="product/settings/members"
              tone="primary"
              size="md"
              icon="retry"
            />
          }
        />
      ) : (
        <Members
          state={state}
          page={page}
          managed={managed}
          writing={writing}
        />
      )}
    </SettingsSurface>
  );
}

export function SettingsMembersScreen({ viewport }: { viewport: Viewport }) {
  return <MembersPane viewport={viewport} state="default" />;
}

export function SettingsMembersEmptyScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <MembersPane viewport={viewport} state="empty" />;
}

export function SettingsMembersLoadingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <MembersPane viewport={viewport} state="loading" />;
}

export function SettingsMembersErrorScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <MembersPane viewport={viewport} state="error" />;
}

/**
 * The same pane managing someone who is listed by their address. The panel's
 * column is narrower than the identity, so the role label carries the full
 * address and the removal control says Remove alone; removing them is asked in
 * a modal over the pane.
 */
export function SettingsMembersIdentityScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <MembersPane
      viewport={viewport}
      state="default"
      managed={unnamedMember}
      screen="product/settings/members/identity"
    />
  );
}

/**
 * The pane asked for by its address while the settings scope loads: the rail
 * draws the sections that the address's scope gives an owner, and the pane
 * draws its own wait, whose headings keep their known words beside a bar for
 * the workspace's name, which the scope supplies.
 */
export function SettingsMembersScopeLoadingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <MembersPane
      viewport={viewport}
      state="loading"
      scopeLoading
      screen="product/settings/members/scope-loading"
    />
  );
}

/** Send invitation's write: the address and role it sends wait disabled. */
export function SettingsMembersInvitationSendingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <MembersPane
      viewport={viewport}
      state="default"
      writing="invite"
      screen="product/settings/members/invitation-sending"
    />
  );
}

/** Revoke invitation's write, busy on the pending invitation's own row. */
export function SettingsMembersInvitationRevokingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <MembersPane
      viewport={viewport}
      state="default"
      writing="revoke"
      screen="product/settings/members/invitation-revoking"
    />
  );
}

/**
 * Save role's write for the person the reader manages: the role they chose
 * and the removal wait disabled while it runs.
 */
export function SettingsMembersRoleSavingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <MembersPane
      viewport={viewport}
      state="default"
      writing="role"
      screen="product/settings/members/role-saving"
    />
  );
}
