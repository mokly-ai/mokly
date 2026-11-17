import { Action } from "../../components/action";

import { AccountShell } from "./account-shell";

/**
 * The email landing in a browser when the desktop app requested the link. It
 * holds the one-use token until the reader chooses where to finish signing
 * in: Open Mokly hands it to the app through the `mokly` scheme in this tab,
 * and Continue in browser exchanges it here. The page never opens the scheme
 * on its own and draws no part of the token.
 */
export function CallbackHandoff({
  address,
  onContinue,
}: {
  /** The scheme address that carries the token to the desktop app. */
  address: string;
  /** Exchange the token in this browser instead. */
  onContinue: () => void;
}) {
  return (
    <AccountShell
      screen="account-callback-desktop"
      title="Finish signing in"
      detail="You requested this link from the Mokly app."
      identity={{ kind: "none" }}
    >
      <div className="fo-account-actions">
        <Action
          label="Open Mokly"
          tone="primary"
          icon="external"
          block
          href={address}
          testID="open-mokly"
        />
        <Action
          label="Continue in browser"
          tone="secondary"
          block
          onPress={onContinue}
          testID="continue-in-browser"
        />
      </div>
    </AccountShell>
  );
}
