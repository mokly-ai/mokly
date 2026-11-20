import { shared } from "../app-regions";
import type { Owner } from "../app-regions";

export const projectOwners = {
  "product/settings/project": {
    region: "pane",
    files: ["settings/panes/project-pane.tsx", ...shared],
  },
  // A write in flight in the modal the pane opened: the modal writes the label
  // its control reads while it works, and nothing here offers the way back a
  // refusal would.
  "product/settings/project/visibility": {
    region: "pane",
    files: [
      "settings/panes/project-pane.tsx",
      "settings/panes/project-visibility.tsx",
    ],
  },
  // The same modal, refused by the plan. Its implementation writes the refusal
  // and both decisions; the shared role rule owns the way on to Billing.
  "product/settings/project/visibility/plan": {
    region: "pane",
    files: [
      "settings/panes/project-pane.tsx",
      "settings/panes/project-visibility.tsx",
      "components/plan-consequence.tsx",
    ],
  },
  // The refusal an admin reads, whose way on is a sentence rather than a
  // control; the pane beneath and its visibility modal own every label.
  "product/settings/project/visibility/plan-admin": {
    region: "pane",
    files: [
      "settings/panes/project-pane.tsx",
      "settings/panes/project-visibility.tsx",
    ],
  },
  // The visibility write in flight towards private: the modal writes the
  // label its control reads while it works and the operation it names, and
  // the pane beneath writes its own controls.
  "product/settings/project/visibility/private": {
    region: "pane",
    files: [
      "settings/panes/project-pane.tsx",
      "settings/panes/project-visibility.tsx",
    ],
  },
  "product/settings/project/slug": {
    region: "pane",
    files: ["settings/panes/slug-editor.tsx"],
  },
  "product/settings/project/slug/conflict": {
    region: "pane",
    files: ["settings/panes/slug-editor.tsx"],
  },
  // The pane of a project that cannot build says one sentence where the
  // Automatic builds switch would be. The pane chooses between the two, and a
  // switch draws no label the comparison reads, so the pane answers for the
  // page and the sentence it says is declared below.
  "product/settings/project/no-builds": {
    region: "pane",
    files: ["settings/panes/project-pane.tsx"],
  },
  // The Automatic builds switch while its own write runs. The pane draws
  // around it, and the switch's own module names the write.
  "product/settings/project/builds-saving": {
    region: "pane",
    files: [
      "settings/panes/project-pane.tsx",
      "settings/panes/project-builds.tsx",
    ],
  },
  // The pane asked for by its address while the settings scope loads. Every
  // control of the pane's wait is a placeholder or a switch, which draw no
  // label the comparison reads, so the scope's wait, which names the read,
  // answers for the page alone.
  "product/settings/project/scope-loading": {
    region: "pane",
    files: ["settings/scope-wait.tsx"],
  },
  "product/settings/tokens": {
    region: "pane",
    files: ["settings/panes/tokens-pane.tsx", ...shared],
  },
  // Naming a token and taking its secret are one modal, because the reader is
  // still inside the operation they started. The reveal and the browser that
  // would not copy it are two drawings of that modal's second half.
  "product/settings/tokens/create": {
    region: "pane",
    files: [
      "settings/panes/tokens-pane.tsx",
      "settings/panes/tokens-create.tsx",
    ],
  },
  "product/settings/tokens/create/reveal": {
    region: "pane",
    files: [
      "settings/panes/tokens-pane.tsx",
      "settings/panes/tokens-create.tsx",
    ],
  },
  "product/settings/tokens/create/copy": {
    region: "pane",
    files: [
      "settings/panes/tokens-pane.tsx",
      "settings/panes/tokens-create.tsx",
    ],
  },
  // Revoking is asked over the row it belongs to, reached from that row's own
  // three-dot menu. The menu's rows are the pane's; the pane region is read on
  // the desktop page, where the menu draws no button of its own.
  "product/settings/tokens/revoke": {
    region: "pane",
    files: [
      "settings/panes/tokens-pane.tsx",
      "settings/panes/tokens-revoke.tsx",
    ],
  },
  "product/settings/tokens/revoke/menu": {
    region: "pane",
    files: ["settings/panes/tokens-pane.tsx"],
  },
  "product/settings/access": {
    region: "pane",
    files: ["settings/panes/access-pane.tsx", ...shared],
  },
  "product/settings/danger": {
    region: "pane",
    files: ["settings/panes/danger-pane.tsx", ...shared],
  },
  // The pane asked for by its address while the settings scope loads: the
  // scope's wait names the read, and the pane's own wait draws both controls
  // disabled.
  "product/settings/danger/scope-loading": {
    region: "pane",
    files: ["settings/panes/danger-pane.tsx", "settings/scope-wait.tsx"],
  },
} as const satisfies Record<string, Owner>;
