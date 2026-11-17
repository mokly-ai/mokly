import type { Viewport } from "@mokly/mokly";

import { membership } from "../../../fixtures/product-states";
import { Action } from "../page-parts";
import { MembersPane } from "./members-pane";
import { SettingsModal } from "./settings-modal";

const person = membership.selected;

/**
 * Losing access is asked over the person it concerns, so the reader keeps
 * sight of who they are answering for while the list stays where it was.
 */
function RemoveModal({ working }: { working: boolean }) {
  return (
    <SettingsModal
      title={"Remove " + person.name + "?"}
      instance="member-remove"
    >
      <span className="fo-note-detail">
        {person.name} loses access to this workspace’s projects.
      </span>
      <div className="review-inline">
        <Action
          label={working ? "Removing…" : "Remove " + person.name}
          instance="confirm-remove-member"
          tone="danger"
          size="md"
          busy={working ? "Removing member" : undefined}
        />
        <Action
          label="Keep access"
          tone="quiet"
          size="md"
          to="product/settings/members"
          disabled={working}
        />
      </div>
    </SettingsModal>
  );
}

export function SettingsMembersRemoveScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <MembersPane
      viewport={viewport}
      state="default"
      screen="product/settings/members/remove"
      modal={<RemoveModal working={false} />}
    />
  );
}

/**
 * The write in flight: the removal is busy with its working word, and Keep
 * access waits disabled, so neither decision can be pressed a second time.
 */
export function SettingsMembersRemoveLoadingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <MembersPane
      viewport={viewport}
      state="default"
      screen="product/settings/members/remove/loading"
      modal={<RemoveModal working />}
    />
  );
}
