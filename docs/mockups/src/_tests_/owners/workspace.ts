import { shared } from "../app-regions";
import type { Owner } from "../app-regions";

export const workspaceOwners = {
  // The index's own failure belongs to the frames that resolve settings, not
  // to the pane that lists them.
  "product/settings/sections": {
    region: "pane",
    files: [
      "settings/panes/sections-pane.tsx",
      "settings/dialog-host.tsx",
      "settings/layer-screen.tsx",
      "settings/scope-wait.tsx",
      ...shared,
    ],
  },
  "product/settings/account": {
    region: "pane",
    files: ["settings/panes/account-pane.tsx", ...shared],
  },
  // The pane asked for by its address while the settings scope loads: the
  // scope's wait names the read, and the pane's own wait draws every control
  // in its waiting form.
  "product/settings/account/scope-loading": {
    region: "pane",
    files: ["settings/panes/account-pane.tsx", "settings/scope-wait.tsx"],
  },
  // The same pane while the session loads, before the scope is read: the
  // scope's wait names the wait, and the pane's own wait, which takes an
  // unknown session, draws every control in its waiting form.
  "product/settings/account/session-loading": {
    region: "pane",
    files: ["settings/panes/account-pane.tsx", "settings/scope-wait.tsx"],
  },
  // Connect GitHub's write. The pane writes its working word, the operation
  // screen readers hear and every other control's resting label.
  "product/settings/account/github-connecting": {
    region: "pane",
    files: ["settings/panes/account-pane.tsx"],
  },
  // The pane in the desktop app's window keeps every label the pane writes;
  // only where Connect GitHub leads and its glyph change, and nothing on the
  // page has failed or been refused.
  "product/settings/account/desktop": {
    region: "pane",
    files: ["settings/panes/account-pane.tsx"],
  },
  "product/settings/workspace": {
    region: "pane",
    files: [
      "settings/panes/workspace-pane.tsx",
      "settings/panes/workspace-projects.tsx",
      ...shared,
    ],
  },
  // The GitHub accounts fact's own two situations. Nothing on either page has
  // failed to load and no write has been refused, so the pane alone answers
  // for both: it reads the accounts onto the fact and writes its Manage.
  "product/settings/workspace/suspended": {
    region: "pane",
    files: [
      "settings/panes/workspace-pane.tsx",
      "settings/panes/workspace-projects.tsx",
    ],
  },
  "product/settings/workspace/absent": {
    region: "pane",
    files: [
      "settings/panes/workspace-pane.tsx",
      "settings/panes/workspace-projects.tsx",
    ],
  },
  // The fact's own read of the installation list, running and failed. While
  // it runs the fact draws only a placeholder named to assistive technology,
  // which no control carries, so the pane alone answers for that page and the
  // situation test holds the name. A failure draws its retry, which the
  // fact's own module writes beside the failure.
  "product/settings/workspace/accounts-loading": {
    region: "pane",
    files: [
      "settings/panes/workspace-pane.tsx",
      "settings/panes/workspace-projects.tsx",
    ],
  },
  "product/settings/workspace/accounts-unreadable": {
    region: "pane",
    files: [
      "settings/panes/workspace-pane.tsx",
      "settings/panes/workspace-projects.tsx",
      "settings/panes/workspace-github.tsx",
    ],
  },
  // The workspace back on the free plan. The pane reads the plan onto the
  // fact, says where its private projects stand and gives an owner the way on.
  "product/settings/workspace/plan": {
    region: "pane",
    files: [
      "settings/panes/workspace-pane.tsx",
      "settings/panes/workspace-projects.tsx",
      "components/plan-consequence.tsx",
    ],
  },
  // The same workspace read by a member. The pane owns the consequence and
  // the sentence that gives everybody without Billing access their way on.
  "product/settings/workspace/plan-member": {
    region: "pane",
    files: [
      "settings/panes/workspace-pane.tsx",
      "settings/panes/workspace-projects.tsx",
    ],
  },
  // The pane asked for by its address while the settings scope loads. The
  // scope's wait names the read; the pane's own wait draws Create project
  // disabled, and every other control waits as a placeholder.
  "product/settings/workspace/scope-loading": {
    region: "pane",
    files: ["settings/panes/workspace-pane.tsx", "settings/scope-wait.tsx"],
  },
  // Save's write. The pane writes the working word and the operation, and the
  // projects section beside it writes Create project.
  "product/settings/workspace/saving": {
    region: "pane",
    files: [
      "settings/panes/workspace-pane.tsx",
      "settings/panes/workspace-projects.tsx",
    ],
  },
  "product/settings/workspace/slug": {
    region: "pane",
    files: ["settings/panes/slug-editor.tsx"],
  },
  // The GitHub accounts pane, its rows and its row menu. The remove modal is
  // a module of its own, drawn over the pane it belongs to.
  "product/settings/github": {
    region: "pane",
    files: ["settings/panes/github-pane.tsx", ...shared],
  },
  "product/settings/github/suspended": {
    region: "pane",
    files: ["settings/panes/github-pane.tsx"],
  },
  "product/settings/github/member": {
    region: "pane",
    files: ["settings/panes/github-pane.tsx"],
  },
  "product/settings/github/menu": {
    region: "pane",
    files: ["settings/panes/github-pane.tsx"],
  },
  // The pane in the desktop app's window, whose Add GitHub account opens the
  // web: the pane writes every label on it.
  "product/settings/github/desktop": {
    region: "pane",
    files: ["settings/panes/github-pane.tsx"],
  },
  "product/settings/github/remove": {
    region: "pane",
    files: [
      "settings/panes/github-pane.tsx",
      "settings/panes/github-remove.tsx",
    ],
  },
  // Add GitHub account's write, which leaves for GitHub. The pane writes its
  // working word and the operation; the rows' menus draw no label the
  // comparison reads.
  "product/settings/github/adding": {
    region: "pane",
    files: ["settings/panes/github-pane.tsx"],
  },
  "product/settings/workspace/slug-recovery": {
    region: "pane",
    files: ["settings/panes/slug-editor.tsx"],
  },
} as const satisfies Record<string, Owner>;
