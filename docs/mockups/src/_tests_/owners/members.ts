import { shared } from "../app-regions";
import type { Owner } from "../app-regions";

export const memberOwners = {
  "product/settings/members": {
    region: "pane",
    files: [
      "settings/panes/members-pane.tsx",
      "settings/panes/member-rows.tsx",
      "settings/panes/member-invite.tsx",
      "settings/panes/member-details.tsx",
      ...shared,
    ],
  },
  // The pane asked for by its address while the settings scope loads. The
  // scope's wait names the scope read, and the pane's own waiting parts draw
  // its rows, the invite form and their controls.
  "product/settings/members/scope-loading": {
    region: "pane",
    files: [
      "settings/panes/member-rows.tsx",
      "settings/panes/member-invite.tsx",
      "settings/scope-wait.tsx",
    ],
  },
  // The pane's three writes, each on its own control. The rows, the invite
  // form and the person the reader manages each write their own labels, the
  // pressed control's working word and the operation it names among them.
  "product/settings/members/invitation-sending": {
    region: "pane",
    files: [
      "settings/panes/member-rows.tsx",
      "settings/panes/member-invite.tsx",
      "settings/panes/member-details.tsx",
    ],
  },
  "product/settings/members/invitation-revoking": {
    region: "pane",
    files: [
      "settings/panes/member-rows.tsx",
      "settings/panes/member-invite.tsx",
      "settings/panes/member-details.tsx",
    ],
  },
  "product/settings/members/role-saving": {
    region: "pane",
    files: [
      "settings/panes/member-rows.tsx",
      "settings/panes/member-invite.tsx",
      "settings/panes/member-details.tsx",
    ],
  },
  // One member's own row, opened. Nothing on it has failed to load and no
  // write has been refused, so neither shared answer is drawn here.
  "product/settings/members/identity": {
    region: "pane",
    files: [
      "settings/panes/member-rows.tsx",
      "settings/panes/member-invite.tsx",
      "settings/panes/member-details.tsx",
    ],
  },
} as const satisfies Record<string, Owner>;
