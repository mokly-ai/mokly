import type { Viewport } from "@mokly/mokly";

import { githubAccounts } from "../../../fixtures/product";
import { Action } from "../page-parts";
import { GitHubPane } from "./github-pane";
import { SettingsModal } from "./settings-modal";

const account = githubAccounts[0];

/**
 * Removing an account is asked over the row it belongs to. It disconnects the
 * account from this workspace only: the App stays installed on GitHub, and
 * the projects and publications made from its repositories stay, so the one
 * line names what stops and what does not.
 */
function RemoveModal({ working }: { working: boolean }) {
  return (
    <SettingsModal
      title={"Remove " + account.name + "?"}
      instance="github-account-remove"
    >
      <span className="fo-note-detail">
        Mokly stops reading its repositories. Its projects and publications
        stay.
      </span>
      <div className="review-inline">
        <Action
          label={working ? "Removing…" : "Remove"}
          instance="confirm-remove-github-account"
          tone="danger"
          size="md"
          busy={working ? "Removing GitHub account" : undefined}
        />
        <Action
          label="Cancel"
          instance="cancel-remove-github-account"
          tone="quiet"
          size="md"
          to="product/settings/github"
          disabled={working}
        />
      </div>
    </SettingsModal>
  );
}

export function SettingsGitHubRemoveScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <GitHubPane
      viewport={viewport}
      state="default"
      screen="product/settings/github/remove"
      modal={<RemoveModal working={false} />}
    />
  );
}

/**
 * The write in flight: neither decision can be pressed a second time. Remove
 * says what it is doing on its busy control, so the operation is named to
 * assistive technology alone rather than said twice on screen.
 */
export function SettingsGitHubRemoveLoadingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <GitHubPane
      viewport={viewport}
      state="default"
      screen="product/settings/github/remove/loading"
      modal={<RemoveModal working />}
    />
  );
}
