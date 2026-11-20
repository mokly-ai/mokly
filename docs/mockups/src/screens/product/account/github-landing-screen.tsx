import type { Viewport } from "@mokly/mokly";

import { failureReference } from "../../../fixtures/product-states";
import { Action, Pending, StateMessage } from "../page-parts";
import { StatePlaceholder } from "../placeholders";

import { AccountShell } from "./account-shell";

/**
 * The one way on from a GitHub installation landing: back to the install
 * step. A refusal carries the retry glyph, as every callback recovery does; a
 * request waiting for approval failed nothing, so it carries none.
 */
function BackToInstall({ refused }: { refused: boolean }) {
  return (
    <div className="fo-account-actions">
      <Action
        label="Back to install"
        to="product/account/install-app"
        tone="primary"
        icon={refused ? "retry" : undefined}
        block
      />
    </div>
  );
}

/**
 * A GitHub installation landing while it completes the installation. Its
 * success leaves for GitHub's authorization or for the install step, so it
 * waits as one state card in placeholder form. Its title does not name the
 * operation, so the card's title does.
 */
function InstallLanding({ id, title }: { id: string; title: string }) {
  return (
    <AccountShell id={id} title={title} identity={{ kind: "signed-in" }}>
      <Pending label="Completing installation">
        {(name) => <StatePlaceholder title={name} />}
      </Pending>
    </AccountShell>
  );
}

/**
 * The setup landing, where GitHub returns from the installation, while it
 * completes it and opens GitHub's authorization.
 */
export function InstallSetupScreen(_props: { viewport: Viewport }) {
  return (
    <InstallLanding
      id="product/account/callback/install-setup"
      title="Install the Mokly app"
    />
  );
}

/**
 * The authorization callback of an installation while it proves that the
 * reader administers the account and connects it to the workspace.
 */
export function InstallAuthorizeScreen(_props: { viewport: Viewport }) {
  return (
    <InstallLanding
      id="product/account/callback/install-authorize"
      title="GitHub installation"
    />
  );
}

/**
 * The setup landing when a member of a GitHub organization asked for the App
 * rather than installing it. Nothing reached Mokly, so there is no reference;
 * the line says who finishes the job.
 */
export function InstallRequestedScreen(_props: { viewport: Viewport }) {
  return (
    <AccountShell
      id="product/account/callback/install-requested"
      title="Installation requested"
      detail="An owner of the GitHub organization approves it on GitHub."
      identity={{ kind: "signed-in" }}
    >
      <BackToInstall refused={false} />
    </AccountShell>
  );
}

/**
 * The authorization callback when another workspace already holds the
 * account. Only that workspace can let it go, so the line says where.
 */
export function InstallConflictScreen(_props: { viewport: Viewport }) {
  return (
    <AccountShell
      id="product/account/callback/install-conflict"
      title="This GitHub account is connected to another workspace"
      identity={{ kind: "signed-in" }}
    >
      <StateMessage error reference={failureReference}>
        Remove it from that workspace first.
      </StateMessage>
      <BackToInstall refused />
    </AccountShell>
  );
}

/**
 * The authorization callback when GitHub could not prove the reader
 * administers the account. The heading is the whole message, so the state
 * announces it without a second visible title.
 */
export function InstallDeniedScreen(_props: { viewport: Viewport }) {
  return (
    <AccountShell
      id="product/account/callback/install-denied"
      title="You don’t administer this GitHub account"
      identity={{ kind: "signed-in" }}
    >
      <StateMessage
        announcement="You don’t administer this GitHub account"
        error
        reference={failureReference}
      />
      <BackToInstall refused />
    </AccountShell>
  );
}
