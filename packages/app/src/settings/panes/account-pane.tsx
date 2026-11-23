import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";

import type { Session } from "../../api/types";
import { Action } from "../../components/action";
import type { ActionIcon } from "../../components/action";
import { StatusBadge } from "../../components/controls";
import { Field } from "../../components/field";
import { formFailure } from "../../components/form-failure";
import { Facts, Section } from "../../components/page-parts";
import { ControlPlaceholder, TextBar } from "../../components/placeholders";
import { connectGitHub, updateAccount } from "../../data/auth";
import { isDesktopShell } from "../../navigation/desktop-shell";
import { settingsPath } from "../../navigation/paths";
import { currentReturnTo } from "../../navigation/return-to";
import { openOnWeb } from "../../navigation/web-setup";
import { useSession } from "../../session/context";
import {
  forgetSignOutFailure,
  signOutFailure,
} from "../../session/sign-out-failure";
import { useSettings } from "../context";
import { useDraft } from "../dirty";
import { draftKey } from "../drafts";
import { alwaysSendable, nothingToDo, useWrite } from "../write";

import { BadgePlaceholder } from "./row-placeholders";

/** Disconnect GitHub's width in px, with its icon, at a page action's size. */
const disconnectWidth = 175;

/** The width in px of the Connected badge with its dot. */
const connectedWidth = 96;

/**
 * Whether Connect GitHub opens this pane on the web: in the desktop app's
 * window, for a reader whose account has no GitHub connection yet.
 */
function connectsOnWeb(connected: boolean): boolean {
  return isDesktopShell() && !connected;
}

/** The glyph the GitHub control carries: the external glyph where it leaves. */
function connectIcon(connected: boolean): ActionIcon {
  return connectsOnWeb(connected) ? "external" : "github";
}

/**
 * The Account pane's layout, which the pane and its wait both draw: the name
 * with what Mokly knows of the reader, their GitHub connection, and the way out
 * of the session. Every text here is the session's own, so a wait for the
 * settings scope changes only the controls. While the session read runs, its
 * texts wait too: the email as a bar, and the connection, which `connected`
 * then leaves unknown, with its status as a placeholder.
 */
function AccountLayout({
  email,
  connected,
  name,
  save,
  connect,
  signOut,
}: {
  email: ReactNode;
  connected: boolean | undefined;
  name: ReactNode;
  save: ReactNode;
  connect: ReactNode;
  signOut: ReactNode;
}) {
  return (
    <div className="fo-stack">
      <section className="fo-section fo-section-flush">
        <div className="fo-form">
          {name}
          <Facts rows={[["Email", email]]} />
          {save}
        </div>
      </section>
      <Section
        title="GitHub"
        description="Mokly publishes from the repositories this account can read."
      >
        <div className="fo-note">
          <div className="fo-note-head">
            <span className="fo-note-title">GitHub account</span>
            {connected === undefined ? (
              <BadgePlaceholder width={connectedWidth} />
            ) : (
              <StatusBadge
                label={connected ? "Connected" : "Not connected"}
                tone={connected ? "success" : "neutral"}
                dot
              />
            )}
          </div>
          {connected === false && (
            <span className="fo-note-detail">
              Connect GitHub to publish from your repositories.
            </span>
          )}
          {connect}
        </div>
      </Section>
      <Section title="Session">{signOut}</Section>
    </div>
  );
}

/**
 * Connect GitHub. In a browser tab it leaves for GitHub's authorization and
 * comes back to this pane; the write is done when the page leaves, so the
 * control stays busy until then. In the desktop app's window it opens this
 * pane on the web instead, where the reader connects the account the browser
 * is signed in to, so it carries the external glyph there and starts no trip
 * of its own.
 */
function GitHubConnect({ connected }: { connected: boolean }) {
  const authorize = useWrite(nothingToDo, alwaysSendable);
  const onWeb = connectsOnWeb(connected);
  const connect = useCallback(
    () =>
      authorize.run(async () => {
        const connection = await connectGitHub(currentReturnTo());
        authorize.leave("connect", connection);
      }),
    [authorize],
  );
  return authorize.around(
    <div>
      <Action
        label={
          connected
            ? "Disconnect GitHub"
            : authorize.label("Connect GitHub", "Connecting…")
        }
        tone={connected ? "quiet" : "secondary"}
        size="md"
        icon={connectIcon(connected)}
        write={authorize}
        operation="Connecting to GitHub"
        disabled={connected}
        onPress={() =>
          onWeb ? openOnWeb(settingsPath({ pane: "account" })) : void connect()
        }
        testID="settings-connect-github"
      />
    </div>,
  );
}

/** Name, email, the GitHub connection and the way out of the session. */
export function AccountPane() {
  const { session, reload, leaveBy } = useSettings();
  const { signOut, reload: reloadSession } = useSession();
  const saved =
    session.user.name === session.user.email ? "" : session.user.name;
  const [name, setName] = useDraft(
    draftKey("account", session.user.id, "name"),
    saved,
  );
  const renaming = useWrite(
    reload,
    name.trim().length > 0 && name.trim() !== saved,
  );

  const save = useCallback(
    () =>
      renaming.run(async () => {
        await updateAccount(name.trim());
        // The name is the session's, so the session is what has to be asked
        // again before the field can measure itself against what was stored.
        await reloadSession();
      }),
    [name, renaming, reloadSession],
  );
  // Sign out has its own write, so a failed attempt and its retry stay beside
  // the control that sent it. A sign-out that the account menu sent and that
  // failed opens this pane, which shows that failure as its own, once.
  const [menuFailure] = useState(signOutFailure);
  useEffect(forgetSignOutFailure, []);
  const signingOut = useWrite(nothingToDo, alwaysSendable, menuFailure);

  const failure = formFailure(renaming, { "validation-failed": "name" });
  return (
    <AccountLayout
      email={session.user.email}
      connected={session.user.githubConnected}
      name={
        <Field
          label="Name"
          name="account-name"
          type="text"
          value={name}
          onChange={setName}
          placeholder="Your name"
          disabled={renaming.working}
          error={failure.on("name")}
        />
      }
      save={failure.around(
        <div>
          <Action
            label={failure.label("Save changes", "Saving…")}
            tone="primary"
            size="md"
            write={renaming}
            operation="Saving your name"
            onPress={() => void save()}
            testID="save-account"
          />
        </div>,
      )}
      connect={<GitHubConnect connected={session.user.githubConnected} />}
      signOut={signingOut.around(
        <div>
          <Action
            label={signingOut.label("Sign out", "Signing out…")}
            tone="quiet"
            size="md"
            icon="signOut"
            write={signingOut}
            operation="Signing you out"
            onPress={() => leaveBy(() => void signingOut.run(signOut))}
            testID="sign-out"
          />
        </div>,
      )}
    />
  );
}

/**
 * The pane while settings loads. It needs nothing from the scope, but every
 * control in the waiting region draws its waiting form, so a failed read takes
 * nothing the reader typed: the name waits in its frame, and each control
 * whose label is known draws itself, disabled. `session` is nothing while the
 * session read runs: the email is then a bar, and the GitHub connection, which
 * the session decides, draws its most common form, a connected account, with
 * its status and its control as placeholders.
 */
export function AccountWait({ session }: { session: Session | undefined }) {
  const connected = session?.user.githubConnected;
  return (
    <AccountLayout
      email={session ? session.user.email : <TextBar width="12em" />}
      connected={connected}
      name={<Field label="Name" name="account-name" type="text" waiting />}
      save={
        <div>
          <Action label="Save changes" tone="primary" size="md" disabled />
        </div>
      }
      connect={
        <div>
          {connected === undefined ? (
            <ControlPlaceholder size="md" width={disconnectWidth} />
          ) : (
            <Action
              label={connected ? "Disconnect GitHub" : "Connect GitHub"}
              tone={connected ? "quiet" : "secondary"}
              size="md"
              icon={connectIcon(connected)}
              disabled
            />
          )}
        </div>
      }
      signOut={
        <div>
          <Action
            label="Sign out"
            tone="quiet"
            size="md"
            icon="signOut"
            disabled
          />
        </div>
      }
    />
  );
}
