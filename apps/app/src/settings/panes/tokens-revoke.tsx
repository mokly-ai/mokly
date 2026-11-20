import { useCallback } from "react";

import type { Project, Token } from "../../api/types";
import { Action } from "../../components/action";
import { revokeToken } from "../../data/tokens";
import { SettingsModal } from "../modal";
import { alwaysSendable, useWrite } from "../write";

/**
 * Revoking asked over the row it belongs to, so the reader keeps sight of which
 * token they are answering for. The token stays in the list afterwards, marked
 * as revoked, because what published with it is worth reading.
 */
export function RevokeToken({
  token,
  project,
  onClose,
  onRevoked,
}: {
  token: Token;
  project: Project;
  onClose: () => void;
  onRevoked: () => void;
}) {
  const revoke = useWrite(
    useCallback(() => {
      onClose();
      onRevoked();
    }, [onClose, onRevoked]),
    alwaysSendable,
  );
  return (
    <SettingsModal
      title={"Revoke " + token.name + "?"}
      onClose={onClose}
      dismissible={!revoke.working}
      testID="revoke-token-modal"
    >
      <span className="fo-note-detail">
        Publishing with this token stops. Create a replacement first.
      </span>
      {revoke.around(
        <div className="review-inline">
          <Action
            label={revoke.label("Revoke token", "Revoking…")}
            tone="danger"
            size="md"
            write={revoke}
            operation="Revoking token"
            disabled={revoke.disabled}
            onPress={() =>
              void revoke.run(() => revokeToken(project.id, token.id))
            }
            testID="confirm-revoke"
          />
          <Action
            label="Keep token"
            tone="quiet"
            size="md"
            disabled={revoke.working}
            onPress={onClose}
          />
        </div>,
      )}
    </SettingsModal>
  );
}
