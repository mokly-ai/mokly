import { MockLink } from "@mokly/mokly";

import { Button } from "../../../entries/design/button.mockup";
import { Input } from "../../../entries/design/input.mockup";
import { WriteFailure } from "../../../entries/design/write-failure.mockup";
import {
  causes,
  failureReference,
  fieldRefusals,
  notices,
  onboarding,
} from "../../../fixtures/product-states";
import { Action } from "../page-parts";

import type { EntryMode, EntrySituation } from "./entry-layout";

/** What the email control reads in each situation these two screens draw. */
const submitLabel: Record<EntrySituation, string> = {
  default: "Continue with email",
  empty: "Continue with email",
  loading: "Sending…",
  error: "Try again",
  // Nothing was asked of this control in these, so it is at rest.
  "github-connecting": "Continue with email",
  "github-refused": "Continue with email",
  "github-opens-soon": "Continue with email",
  // Sending the same text again would be refused again, so the way back is
  // editing the address and this control keeps its own label.
  "address-refused": "Continue with email",
};

/** What the Email field holds: nothing, the whole address, or the refused one. */
function address(situation: EntrySituation): string {
  if (situation === "empty") return "";
  return situation === "address-refused"
    ? onboarding.incompleteEmail
    : onboarding.email;
}

/** Shared entry controls; static mockups intentionally end before submission. */
export function AccountEntry({
  mode,
  situation,
}: {
  mode: EntryMode;
  situation: EntrySituation;
}) {
  const pending = situation === "loading";
  const connecting = situation === "github-connecting";
  const refusedGitHub = situation === "github-refused";
  const opensSoon = situation === "github-opens-soon";
  const refusedAddress = situation === "address-refused";
  // Sending the link is a write, so a refusal is reported beside the control
  // that made it and the control is the way back. The address the reader typed
  // is retained and unmarked: it is not what this refusal was about. While it
  // sends, the control carries the wait itself and the form inserts nothing.
  const submit = (
    <Action
      instance="account-email"
      label={submitLabel[situation]}
      tone="primary"
      block
      disabled={situation === "empty"}
      busy={pending ? "Sending sign-in link" : undefined}
    />
  );
  // Connecting GitHub is the screen's other write, so its own refusal is
  // reported here and never through the email control: this one becomes the
  // way back, and the other keeps its resting label.
  const connect = (
    <Button
      moklyInstance="account-github"
      label={refusedGitHub ? "Try again" : "Continue with GitHub"}
      tone="secondary"
      icon="github"
      block
    />
  );
  return (
    <div className="fo-account-form">
      {opensSoon && (
        // Everything said about a control is said beside it, so this sits
        // where a cause for Continue with GitHub would. Nothing failed, there
        // is no request to send again and no reference worth reporting, so it
        // is a notice rather than a refused write: flush, and polite.
        <section className="fo-notice" role="status">
          {notices.githubOpensSoon}
        </section>
      )}
      {connecting ? (
        // Connecting is a write that leaves the page for GitHub, so the
        // control carries the wait until the page leaves and the form inserts
        // nothing.
        <Action
          instance="account-github"
          label="Connecting…"
          tone="secondary"
          icon="github"
          block
          busy="Connecting to GitHub"
        />
      ) : refusedGitHub ? (
        <WriteFailure
          moklyInstance="account-github-failure"
          cause={causes.busy}
          reference={failureReference}
          control={connect}
        />
      ) : opensSoon ? (
        // A drawing never offers what its own copy refuses, so the one page
        // whose subject is that this way in is closed does not open it. The
        // running screen is a button in every situation; here so is this.
        connect
      ) : (
        <MockLink asChild to="product/account/create-workspace">
          {connect}
        </MockLink>
      )}
      <div className="or-divider">
        <span>or</span>
      </div>
      <Input
        label="Email"
        name={mode + "-email"}
        type="email"
        value={address(situation)}
        disabled={pending}
        // Only an address the API refused belongs on this field, and what it
        // says there is the sentence the registered input's invalid variant
        // draws rather than the copy every other form's field would show. A
        // registered wrapper refuses an `undefined` prop, so every other
        // situation leaves the error out.
        {...(refusedAddress ? { error: fieldRefusals.email } : {})}
      />
      {situation === "error" || refusedAddress ? (
        <WriteFailure
          moklyInstance="account-email-failure"
          // The field already says what was wrong with a refused address, so
          // the fragment names no cause and leaves the prop out.
          {...(refusedAddress ? {} : { cause: causes.busy })}
          reference={failureReference}
          control={submit}
        />
      ) : (
        submit
      )}
    </div>
  );
}
