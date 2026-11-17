import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import type { ReactNode } from "react";

import { Action } from "../../components/action";
import { AppLink } from "../../components/app-link";
import { Field } from "../../components/field";
import { formFailure } from "../../components/form-failure";
import { Pending } from "../../components/page-parts";
import { unexpectedError } from "../../api/errors";
import { sendMagicLink, startGitHubSignIn } from "../../data/auth";
import { storeGitHubFlow } from "../../navigation/github-flow";
import { alwaysSendable, nothingToDo, useWrite } from "../../settings/write";
import { AccountShell } from "./account-shell";
import type { ShellWait } from "./account-shell";

/** The two logged-out entry screens; every difference between them lives here. */
export type EntryMode = "sign-in" | "sign-up";

const copy = {
  "sign-in": {
    title: "Sign in to Mokly",
    documentTitle: "Sign in",
    switchCopy: "New to Mokly? ",
    switchLabel: "Create an account",
    switchTo: "/sign-up",
  },
  "sign-up": {
    title: "Create your account",
    documentTitle: "Create your account",
    switchCopy: "Already have an account? ",
    switchLabel: "Sign in",
    switchTo: "/sign-in",
  },
} as const;

/**
 * The panel that sign in and sign up draw, loaded or waiting: the title, the
 * GitHub action, the `or` rule, the Email field and the email action, then the
 * line under the body that switches to the other entry screen. The screen
 * passes its live controls, and its wait passes their waiting forms.
 */
function EntryLayout({
  mode,
  notice,
  github,
  email,
  submit,
  wait,
}: {
  mode: EntryMode;
  notice?: ReactNode;
  github: ReactNode;
  email: ReactNode;
  submit: ReactNode;
  wait?: ShellWait;
}) {
  const text = copy[mode];
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
      </div>
    </AccountShell>
  );
}

/**
 * The sign-in screen's wait, which the session guard draws while it sends a
 * signed-out reader here: the same panel with each control in its waiting
 * form, so nothing moves when sign in replaces it and nothing the reader could
 * type is lost on the way. No place of the panel waits for an answer, so the
 * guard's operation is named for screen readers only.
 */
export function SignInWait() {
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
 * Sign in and sign up share one composition and one process: an address, a
 * one-use link, and the same GitHub action beside it.
 *
 * Both actions write, so each holds its own write: a refused GitHub connect is
 * reported beside Continue with GitHub and never relabels Continue with email,
 * marks the Email field or hangs a disclosure under the email form. While a
 * write runs, its own control is busy with its working word and the form
 * inserts nothing; Continue with GitHub stays busy until the page leaves for
 * GitHub.
 */
export function EntryScreen({
  mode,
  returnTo,
}: {
  mode: EntryMode;
  returnTo: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");

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
        if (!storeGitHubFlow("sign-in", connection)) throw unexpectedError();
        github.leave(connection.authorizeUrl);
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
          disabled={github.disabled}
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
          disabled={link.disabled}
          onPress={() => void submit()}
          testID="email-entry"
        />,
      )}
    />
  );
}
