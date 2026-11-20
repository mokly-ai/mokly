import type { Viewport } from "@mokly/mokly";

import { token } from "../../../fixtures/product";
import { Action } from "../page-parts";

import { SettingsModal } from "./settings-modal";
import { TokensPane } from "./tokens-pane";

/**
 * Revoking is asked over the row it belongs to, so the reader keeps sight of
 * which token they are answering for. The token stays in the list afterwards,
 * marked as revoked, because what published with it is worth reading.
 */
function RevokeModal({ working }: { working: boolean }) {
  return (
    <SettingsModal title={"Revoke " + token.name + "?"} instance="token-revoke">
      <span className="fo-note-detail">
        Publishing with this token stops. Create a replacement first.
      </span>
      <div className="review-inline">
        <Action
          label={working ? "Revoking…" : "Revoke token"}
          tone="danger"
          size="md"
          busy={working ? "Revoking token" : undefined}
        />
        <Action
          label="Keep token"
          tone="quiet"
          size="md"
          to="product/settings/tokens"
          disabled={working}
        />
      </div>
    </SettingsModal>
  );
}

export function SettingsTokensRevokeScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <TokensPane
      viewport={viewport}
      state="default"
      screen="product/settings/tokens/revoke"
      modal={<RevokeModal working={false} />}
    />
  );
}

/**
 * The write in flight: Revoke token is busy with its working word, and Keep
 * token waits disabled, so neither decision can be pressed a second time.
 */
export function SettingsTokensRevokeLoadingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <TokensPane
      viewport={viewport}
      state="default"
      screen="product/settings/tokens/revoke/loading"
      modal={<RevokeModal working />}
    />
  );
}
