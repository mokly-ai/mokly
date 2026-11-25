import { Input } from "../../../entries/design/input.mockup";
import { WriteFailure } from "../../../entries/design/write-failure.mockup";
import {
  causes,
  failureReference,
  previewPassword,
  stateScreenPath,
} from "../../../fixtures/product-states";
import { Action } from "../page-parts";

/**
 * What became of the password section's one control: at rest, its password
 * refused on the field, its write running, or its write refused beside it.
 */
export type PasswordSituation =
  "default" | "password-refused" | "signing-in" | "failure";

/** The page that draws the section at rest; every other situation is beneath it. */
const sectionPath = "product/account/sign-in/preview-password";

/** The page that draws the password section in one situation. */
export function passwordScreenPath(situation: PasswordSituation): string {
  return stateScreenPath(sectionPath, situation);
}

/**
 * What sign in adds under the email form when the configuration answer names
 * a shared account: a second `or` rule, the Password field and one action
 * named for that account. The panel allows one `primary` action and Continue
 * with email keeps it, so this one is `secondary`. Its write is its own: a
 * password the API refused is said on the field, every other refusal beside
 * this control, and nothing about it reaches the email form.
 */
export function PasswordSection({
  situation,
}: {
  situation: PasswordSituation;
}) {
  const signingIn = situation === "signing-in";
  const refusedPassword = situation === "password-refused";
  // Sending the same password again would be refused again, so the way back
  // from a refused password is editing it and the control keeps its label.
  // Any other refusal can succeed on the same request, so the control reads
  // the way back. While it signs in, the control carries the wait itself.
  const label = signingIn
    ? "Signing in…"
    : situation === "failure"
      ? "Try again"
      : "Continue as " + previewPassword.account;
  const submit = (
    <Action
      instance="account-password"
      label={label}
      tone="secondary"
      block
      busy={signingIn ? "Signing you in" : undefined}
    />
  );
  return (
    <>
      <div className="or-divider">
        <span>or</span>
      </div>
      <Input
        moklyInstance="account-password-field"
        label="Password"
        name="sign-in-password"
        type="password"
        value={previewPassword.typed}
        disabled={signingIn}
        // A registered wrapper refuses an `undefined` prop, so every other
        // situation leaves the error out.
        {...(refusedPassword ? { error: previewPassword.refused } : {})}
      />
      {refusedPassword || situation === "failure" ? (
        <WriteFailure
          moklyInstance="account-password-failure"
          // The field already says what was wrong with a refused password, so
          // the fragment names no cause and leaves the prop out.
          {...(refusedPassword ? {} : { cause: causes.busy })}
          reference={failureReference}
          control={submit}
        />
      ) : (
        submit
      )}
    </>
  );
}
