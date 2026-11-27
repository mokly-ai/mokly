import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { Action } from "../../components/action";
import { AppLink } from "../../components/app-link";
import { Field } from "../../components/field";
import { formFailure } from "../../components/form-failure";
import { Pending } from "../../components/page-parts";
import {
  readConfiguration,
  sendMagicLink,
  startGitHubSignIn,
} from "../../data/auth";
import { useResource } from "../../data/use-resource";
import { isDesktopShell } from "../../navigation/desktop-shell";
import { alwaysSendable, nothingToDo, useWrite } from "../../settings/write";

import { AccountShell } from "./account-shell";
import type { ShellWait } from "./account-shell";
import { DesktopEntryScreen, DesktopSignInWait } from "./desktop-entry-screen";
import { entryCopy } from "./entry-copy";
import type { EntryMode } from "./entry-copy";
import { PasswordSection } from "./preview-password";

/**
 * Sign in or sign up. The desktop app's window cannot use the browser's
 * sign-ins, so there the entry opens the browser instead of drawing the form.
 */
export function EntryScreen({
  mode,
  returnTo,
}: {
  mode: EntryMode;
  returnTo: string;
}) {
  return isDesktopShell() ? (
    <DesktopEntryScreen mode={mode} returnTo={returnTo} />
  ) : (
    <BrowserEntry mode={mode} returnTo={returnTo} />
  );
}

/**
 * The panel that sign in and sign up draw, loaded or waiting: the title, the
 * GitHub action, the `or` rule, the Email field and the email action, sign
 * in's password section where it has one, then the line under the body that
 * switches to the other entry screen. The screen passes its live controls,
 * and its wait passes their waiting forms.
 */
function EntryLayout({
  mode,
  notice,
  github,
  email,
  submit,
  password,
  wait,
}: {
  mode: EntryMode;
  notice?: ReactNode;
  github: ReactNode;
  email: ReactNode;
  submit: ReactNode;
  password?: ReactNode;
  wait?: ShellWait;
}) {
  const text = entryCopy[mode];
  return (
    <AccountShell
      screen={"account-" + mode}
      title={text.title}
      documentTitle={text.documentTitle}
      identity={{ kind: "none" }}
      wait={wait}
      below={
        <p className="fo-account-switch">
          {text.switchCopy}
          <AppLink href={text.switchTo}>{text.switchLabel}</AppLink>
        </p>
      }
    >
      <div className="fo-account-form">
        {notice}
        {github}
        <div className="or-divider">
          <span>or</span>
        </div>
        {email}
        {submit}
        {password}
      </div>
    </AccountShell>
  );
}

/**
 * Sign in's panel with each control in its waiting form. No place of the
 * panel waits for an answer, so the operation is named for screen readers
 * only. It has no password section, because only the configuration answer
 * says whether there is one, and production has none.
 *
 * A render helper rather than a component, so sign in's own wait is the same
 * `EntryLayout` element as the panel that replaces it: the frame around the
 * panel, with its skip link and header, stays in place, and so does focus.
 */
function signInWaitPanel(): ReactElement {
  return (
    <EntryLayout
      mode="sign-in"
      wait={(panel) => (
        <Pending label="Opening Mokly" labelMode="screen-reader-only">
          {panel(undefined)}
        </Pending>
      )}
      github={
        <Action
          label="Continue with GitHub"
          tone="secondary"
          icon="github"
          block
          disabled
        />
      }
      email={<Field label="Email" name="sign-in-email" type="email" waiting />}
      submit={
        <Action label="Continue with email" tone="primary" block disabled />
      }
    />
  );
}

/**
 * The sign-in screen's wait, which the session guard draws while it sends a
 * signed-out reader here, and sign in draws while it reads the configuration
 * answer: the same panel with each control in its waiting form, so nothing
 * moves when sign in replaces it and nothing the reader could type is lost on
 * the way. In the desktop app's window, sign in is the window's own entry, so
 * the guard draws its wait.
 */
export function SignInWait() {
  if (isDesktopShell()) return <DesktopSignInWait />;
  return signInWaitPanel();
}

/**
 * Sign in and sign up share one composition and one process: an address, a
 * one-use link, and the same GitHub action beside it.
 *
 * Both actions write, so each holds its own write: a refused GitHub connect is
 * reported beside Continue with GitHub and never relabels Continue with email,
 * marks the Email field or hangs a disclosure under the email form. While a
 * write runs, its own control is busy with its working word and the form
 * inserts nothing; Continue with GitHub stays busy until the page leaves for
 * GitHub.
 *
 * Sign in also reads the configuration answer, and draws its wait until the
 * answer comes. Where the answer names a shared account, the password section
 * follows the email form. A failed read draws the form without it.
 */
function BrowserEntry({
  mode,
  returnTo,
}: {
  mode: EntryMode;
  returnTo: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const signsIn = mode === "sign-in";
  const configuration = useResource(
    readConfiguration,
    "configuration",
    signsIn,
  ).state;

  const sent = useCallback(() => {
    router.push(
      `/auth/email?email=${encodeURIComponent(email.trim())}&returnTo=${encodeURIComponent(returnTo)}`,
    );
  }, [email, returnTo, router]);
  const link = useWrite(sent, email.trim().length > 0);
  const github = useWrite(nothingToDo, alwaysSendable);

  const submit = useCallback(
    () => link.run(() => sendMagicLink({ email: email.trim(), returnTo })),
    [link, email, returnTo],
  );
  const authorize = useCallback(
    () =>
      github.run(async () => {
        const connection = await startGitHubSignIn(returnTo);
        github.leave("sign-in", connection);
      }),
    [github, returnTo],
  );

  // GitHub sign-in is not open yet, and that answer is a notice rather than a
  // refused write: there is no request to send again, so the fragment is never
  // handed it and the control keeps its own label. It is still reported beside
  // Continue with GitHub, as every other refusal of that control is.
  const opensSoon = github.error?.reason === "operation-unavailable";
  const connection = formFailure(
    { pending: github.pending, error: opensSoon ? undefined : github.error },
    {},
  );
  // Only an address the API refused belongs on the Email field, and what it
  // says there is the sentence the registered input's invalid variant draws.
  // Everything else about sending the link — a rate limit, a service that is
  // busy — is reported beside the control that sent it.
  const failure = formFailure(link, {
    "validation-failed": {
      field: "email",
      says: "Enter a complete email address.",
    },
  });
  if (signsIn && configuration.status === "loading") return signInWaitPanel();
  const account =
    signsIn && configuration.status === "ready"
      ? configuration.value.previewPassword?.account
      : undefined;
  return (
    <EntryLayout
      mode={mode}
      notice={
        opensSoon && (
          // Everything said about a control is said beside it, so this sits
          // where a cause for Continue with GitHub would. It is its own flush
          // composition and it is polite: nothing failed, there is no request
          // to send again, and no reference worth reporting.
          <section className="fo-notice" role="status">
            GitHub sign-in opens soon. Continue with your email address.
          </section>
        )
      }
      github={connection.around(
        <Action
          label={connection.label(
            "Continue with GitHub",
            "Connecting…",
            "Try again",
          )}
          tone="secondary"
          icon="github"
          block
          write={github}
          operation="Connecting to GitHub"
          onPress={() => void authorize()}
          testID="github-entry"
        />,
      )}
      email={
        <Field
          label="Email"
          name={mode + "-email"}
          type="email"
          value={email}
          onChange={setEmail}
          disabled={link.working}
          error={failure.on("email")}
        />
      }
      submit={failure.around(
        <Action
          label={failure.label("Continue with email", "Sending…", "Try again")}
          tone="primary"
          block
          write={link}
          operation="Sending sign-in link"
          onPress={() => void submit()}
          testID="email-entry"
        />,
      )}
      password={
        account !== undefined && (
          <PasswordSection account={account} returnTo={returnTo} />
        )
      }
    />
  );
}
