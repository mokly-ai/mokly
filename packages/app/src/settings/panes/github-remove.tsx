import { useCallback } from "react";

import type { Installation } from "../../api/types";
import { Action } from "../../components/action";
import { disconnectInstallation } from "../../data/installations";
import { SettingsModal } from "../modal";
import { alwaysSendable, useWrite } from "../write";

/**
 * Removing an account, asked over the row it belongs to. It disconnects the
 * account from this workspace only: the App stays installed on GitHub, and
 * the projects and publications made from its repositories stay, so the one
 * line names what stops and what does not. Remove says what it is doing while
 * it works, so the operation is named to assistive technology alone rather
 * than said twice on screen.
 */
export function RemoveInstallation({
  installation,
  onClose,
  onRemoved,
}: {
  installation: Installation;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const removal = useWrite(
    useCallback(() => {
      onClose();
      onRemoved();
    }, [onClose, onRemoved]),
    alwaysSendable,
  );
  return (
    <SettingsModal
      title={"Remove " + installation.account + "?"}
      onClose={onClose}
      dismissible={!removal.working}
      testID="remove-github-account-modal"
    >
      <span className="fo-note-detail">
        Mokly stops reading its repositories. Its projects and publications
        stay.
      </span>
      {removal.around(
        <div className="review-inline">
          <Action
            label={removal.label("Remove", "Removing…")}
            tone="danger"
            size="md"
            write={removal}
            operation="Removing GitHub account"
            onPress={() =>
              void removal.run(() => disconnectInstallation(installation.id))
            }
            testID="confirm-remove-github-account"
          />
          <Action
            label="Cancel"
            tone="quiet"
            size="md"
            disabled={removal.working}
            onPress={onClose}
            testID="cancel-remove-github-account"
          />
        </div>,
      )}
    </SettingsModal>
  );
}
