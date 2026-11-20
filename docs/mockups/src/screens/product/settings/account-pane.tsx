import type { Viewport } from "@mokly/mokly";

import { Input } from "../../../entries/design/input.mockup";
import { WriteFailure } from "../../../entries/design/write-failure.mockup";
import type { ScreenState } from "../../../fixtures/product-states";
import {
  causes,
  failureReference,
  placeholders,
  profile,
} from "../../../fixtures/product-states";
import type { Host } from "../host";
import { Action, Facts, Pending, Section } from "../page-parts";
import { factPlaceholder } from "../placeholders";

import type { AccountWait } from "./account-github";
import { GithubSection } from "./account-github";
import { SettingsSurface } from "./surface";

/**
 * The pane's layout, which its loaded drawings and its waits all draw: the
 * name with what Mokly knows of the reader, their GitHub connection, and the
 * way out of the session. Every text here is the session's own, so while the
 * settings scope loads, only the controls wait: the name waits in its frame,
 * and each control, whose label the session decides, draws itself, disabled.
 * While the session loads, its texts wait too: the email is a bar, and the
 * GitHub connection waits in its note.
 */
function AccountPane({
  state,
  viewport,
  wait,
  connecting = false,
  screen,
  host = "browser",
}: {
  state: ScreenState;
  viewport: Viewport;
  /** What the pane asked for by its address waits for, while it waits. */
  wait?: AccountWait;
  /** Connect GitHub's write is running. */
  connecting?: boolean;
  screen?: string;
  /**
   * The window's drawing is of a reader without GitHub, the reader its
   * Connect GitHub serves, and its Sign out returns to the window's entry.
   */
  host?: Host;
}) {
  const saving = state === "loading";
  // A save in flight shows its working word on the busy control, which
  // refuses a second press; nothing is inserted or replaced, so the name the
  // reader typed is still on screen.
  const save = (
    <Action
      label={
        saving ? "Saving…" : state === "error" ? "Try again" : "Save changes"
      }
      tone="primary"
      size="md"
      disabled={wait !== undefined}
      busy={saving ? "Saving your name" : undefined}
    />
  );
  const layout = (
    <div className="fo-stack">
      <section className="fo-section fo-section-flush">
        <div className="fo-form">
          {/* Someone who has not set a name reads their own account by
              its address, with the field waiting for one. */}
          <Input
            label="Name"
            name="account-name"
            type="text"
            {...(wait !== undefined
              ? { waiting: true }
              : {
                  value: state === "empty" ? "" : profile.name,
                  placeholder: placeholders.name,
                  disabled: saving,
                })}
          />
          <Facts
            rows={[
              wait === "session"
                ? factPlaceholder("Email", "12em")
                : ["Email", profile.email],
            ]}
          />
          {/* The pane reads the session it is already inside, so it has no
              load of its own to fail: what it can refuse is the name the
              reader asked it to save. */}
          {state === "error" ? (
            <WriteFailure
              moklyInstance="account-save-failure"
              cause={causes.busy}
              reference={failureReference}
              control={save}
            />
          ) : (
            <div>{save}</div>
          )}
        </div>
      </section>
      <GithubSection
        state={state}
        wait={wait}
        connecting={connecting}
        host={host}
      />
      <Section title="Session">
        <div>
          <Action
            label="Sign out"
            to={
              host === "window"
                ? "product/account/sign-in/desktop"
                : "product/account/sign-in"
            }
            tone="quiet"
            size="md"
            icon="signOut"
            disabled={wait !== undefined}
          />
        </div>
      </Section>
    </div>
  );
  return (
    <SettingsSurface
      pane="account"
      state={state}
      screen={screen}
      viewport={viewport}
      title="Account"
    >
      {wait !== undefined ? (
        // Settings has no text place of its own in the pane for the session
        // read or the scope read, so screen readers hear the wait alone.
        <Pending label="Loading settings" labelMode="screen-reader-only">
          {layout}
        </Pending>
      ) : (
        layout
      )}
    </SettingsSurface>
  );
}

export function SettingsAccountScreen({ viewport }: { viewport: Viewport }) {
  return <AccountPane viewport={viewport} state="default" />;
}

export function SettingsAccountEmptyScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <AccountPane viewport={viewport} state="empty" />;
}

export function SettingsAccountLoadingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <AccountPane viewport={viewport} state="loading" />;
}

export function SettingsAccountErrorScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <AccountPane viewport={viewport} state="error" />;
}

/**
 * The pane asked for by its address while the settings scope loads: the rail
 * draws the sections that the address's scope gives an owner, and the pane
 * draws its own layout from the session, with the name waiting in its frame
 * and each control drawn disabled.
 */
export function SettingsAccountScopeLoadingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <AccountPane
      viewport={viewport}
      state="default"
      wait="scope"
      screen="product/settings/account/scope-loading"
    />
  );
}

/**
 * The pane asked for by its address while the session loads, before the
 * settings scope is read: the rail draws the sections that the address's scope
 * gives an owner, and the pane draws its own layout with the session's texts
 * waiting as well: the name in its frame, the email as a bar, and the GitHub
 * connection in its most common form, with its account, status and control as
 * placeholders. Save changes and Sign out draw themselves, disabled.
 */
export function SettingsAccountSessionLoadingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <AccountPane
      viewport={viewport}
      state="default"
      wait="session"
      screen="product/settings/account/session-loading"
    />
  );
}

/**
 * Connect GitHub's write: it leaves for GitHub's authorization, so the control
 * keeps its place with Connecting… and the busy spinner until the page leaves,
 * and the pane around it stays as it was.
 */
export function SettingsAccountGitHubConnectingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <AccountPane
      viewport={viewport}
      state="empty"
      connecting
      screen="product/settings/account/github-connecting"
    />
  );
}

/**
 * The pane in the desktop app's window for a reader without GitHub: Connect
 * GitHub keeps its label and opens this pane on the web.
 */
export function SettingsAccountDesktopScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <AccountPane
      viewport={viewport}
      state="default"
      host="window"
      screen="product/settings/account/desktop"
    />
  );
}
