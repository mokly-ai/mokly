import { MockLink } from "@mokly/mokly";

import { stateScreenPath } from "../../../fixtures/product-states";

import { AccountEntry } from "./account-entry";
import { AccountShell } from "./account-shell";
import { entryCopy } from "./entry-layout";
import type { EntryMode, EntrySituation } from "./entry-layout";
import { passwordScreenPath } from "./preview-password";
import type { PasswordSituation } from "./preview-password";

/**
 * What one artboard draws: a situation of the GitHub and email form, or, on
 * sign in only, a situation of its password section with that form at rest.
 */
type EntryDrawing =
  | { mode: EntryMode; situation: EntrySituation; password?: undefined }
  | { mode: "sign-in"; situation?: undefined; password: PasswordSituation };

/** One account-entry artboard; each screen entry names its own situation. */
export function EntryPage({
  mode,
  situation = "default",
  password,
}: EntryDrawing) {
  const copy = entryCopy[mode];
  return (
    <AccountShell
      id={
        password === undefined
          ? stateScreenPath("product/account/" + mode, situation)
          : passwordScreenPath(password)
      }
      title={copy.title}
      identity={copy.identity}
      below={
        <p className="fo-account-switch">
          {copy.switchCopy}
          <MockLink to={copy.switchTo}>{copy.switchLabel}</MockLink>
        </p>
      }
    >
      <AccountEntry mode={mode} situation={situation} password={password} />
    </AccountShell>
  );
}
