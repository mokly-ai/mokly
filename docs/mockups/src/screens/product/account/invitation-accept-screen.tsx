import type { Viewport } from "@mokly/mokly";

import { recipient } from "../../../fixtures/emails";
import { members } from "../../../fixtures/product";
import {
  failureReference,
  stateScreenPath,
} from "../../../fixtures/product-states";
import { Action, Pending, StateMessage } from "../page-parts";
import { StatePlaceholder } from "../placeholders";

import { AccountShell } from "./account-shell";

type State =
  "default" | "empty" | "loading" | "error" | "expired" | "open-error";

function InvitationAcceptPage({ state }: { state: State }) {
  const expired = state === "expired";
  const missing = state === "empty";
  const failed = state === "error";
  const openFailed = state === "open-error";
  const opening = state === "loading";
  const signedIn = missing ? members[0] : recipient;
  return (
    <AccountShell
      id={
        expired
          ? "product/account/invitation-accept/expired"
          : stateScreenPath("product/account/invitation-accept", state)
      }
      title={
        openFailed || opening
          ? "Invitation accepted"
          : expired
            ? "This invitation has expired"
            : missing
              ? "This invitation isn’t available for this account"
              : failed
                ? "We couldn’t accept your invitation"
                : "Joining the workspace"
      }
      identity={{
        kind: "signed-in",
        person: { name: signedIn.email, initials: signedIn.initials },
      }}
    >
      {openFailed ? (
        <StateMessage
          title="We couldn’t open your workspace"
          error
          reference={failureReference}
          action={
            <Action
              label="Try again"
              tone="primary"
              to="product/account/invitation-accept/loading"
            />
          }
        />
      ) : expired ? (
        <StateMessage
          title="Ask for a new invitation"
          error
          reference={failureReference}
          action={<Action label="Open dashboard" tone="primary" />}
        />
      ) : missing ? (
        <StateMessage
          title="Sign in with the invited address"
          error
          reference={failureReference}
          action={
            <Action
              label="Sign in with another email"
              tone="primary"
              to="product/account/sign-in"
            />
          }
        >
          If you’re already using that address, ask for a new invitation.
        </StateMessage>
      ) : failed ? (
        <StateMessage
          announcement="We couldn’t accept your invitation"
          error
          reference={failureReference}
          action={<Action label="Try again" tone="primary" />}
        />
      ) : opening ? (
        // Its heading says the invitation is accepted, so the card's title is
        // the place that names what the reader waits for now.
        <Pending label="Opening your workspace">
          {(name) => <StatePlaceholder title={name} />}
        </Pending>
      ) : (
        // "Joining the workspace" already names the acceptance, so the card's
        // title is a bar and screen readers hear the name.
        <Pending label="Accepting invitation" labelMode="screen-reader-only">
          <StatePlaceholder />
        </Pending>
      )}
    </AccountShell>
  );
}

/** The pending acceptance handoff, shown in the invitation journey. */
export function InvitationAcceptScreen(_props: { viewport: Viewport }) {
  return <InvitationAcceptPage state="default" />;
}

/** A link that this signed-in account cannot accept. */
export function InvitationAcceptEmptyScreen(_props: { viewport: Viewport }) {
  return <InvitationAcceptPage state="empty" />;
}

/** Acceptance succeeded while the workspace read is pending. */
export function InvitationAcceptLoadingScreen(_props: { viewport: Viewport }) {
  return <InvitationAcceptPage state="loading" />;
}

/** A temporary acceptance failure with a retry. */
export function InvitationAcceptErrorScreen(_props: { viewport: Viewport }) {
  return <InvitationAcceptPage state="error" />;
}

/** An expired invitation needs its sender to issue another. */
export function InvitationAcceptExpiredScreen(_props: { viewport: Viewport }) {
  return <InvitationAcceptPage state="expired" />;
}

/** Acceptance succeeded, but the workspace's current address did not load. */
export function InvitationAcceptOpenErrorScreen(_props: {
  viewport: Viewport;
}) {
  return <InvitationAcceptPage state="open-error" />;
}
