import type { Owner } from "../app-regions";

export const memberRemovalOwners = {
  // Losing access is asked in a modal over the person it concerns, so the page
  // draws the pane beneath and the modal's own two decisions.
  "product/settings/members/remove": {
    region: "pane",
    files: [
      "settings/panes/member-rows.tsx",
      "settings/panes/member-invite.tsx",
      "settings/panes/member-details.tsx",
      "settings/panes/member-remove.tsx",
    ],
  },
} as const satisfies Record<string, Owner>;
