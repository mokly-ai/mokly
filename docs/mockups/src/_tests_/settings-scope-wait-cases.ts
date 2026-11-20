/**
 * The settings scope's waits of the panes that read nothing of their own,
 * which `settings-scope-waits.test.ts` holds to the Wait composition.
 */

import {
  githubAccounts,
  project,
  sample,
  workspace,
} from "../fixtures/product";
import { billing, profile } from "../fixtures/product-states";

/**
 * The panes that read nothing of their own, each asked for by its address
 * while the scope loads: the rail's current pane, the section headings in
 * order (a bar reads as ""), the facts with their values (a bar reads as ""),
 * the controls that draw themselves disabled, how many controls wait as
 * placeholders, how many row and note frames hold a bar in place of a text
 * (one for each list, and the Delete project confirmation's frame, whose
 * label waits for the project's name), the session's texts that stay, and
 * the scope's texts that must not show.
 */
export const paneWaits = [
  {
    pane: "account",
    current: "Account",
    headings: ["GitHub", "Session"],
    facts: [["Email", profile.email]],
    disabled: ["Save changes", "Disconnect GitHub", "Sign out"],
    placeholders: 0,
    frames: 0,
    shown: [profile.email, profile.github, "Connected"],
    hidden: [],
  },
  {
    pane: "workspace",
    current: "Workspace",
    headings: ["Projects"],
    facts: [
      ["Plan", ""],
      ["Slug", ""],
      ["GitHub accounts", ""],
    ],
    disabled: ["Create project"],
    // Change, Manage and Save changes, which the reader's role decides.
    placeholders: 3,
    frames: 1,
    shown: [],
    hidden: [
      sample.workspace,
      workspace.slug,
      billing.plan,
      ...githubAccounts.map((account) => account.name),
      ...workspace.projects.map((one) => one.repository),
    ],
  },
  {
    pane: "project",
    current: "Project",
    headings: [],
    facts: [
      ["Slug", ""],
      ["Repository", ""],
      ["Config", ""],
      ["Visibility", ""],
    ],
    disabled: [],
    // Change, the visibility change, Save changes and the builds switch.
    placeholders: 4,
    frames: 0,
    shown: ["Automatic builds"],
    hidden: [
      sample.project,
      project.slug,
      sample.repository,
      sample.config,
      sample.visibility,
    ],
  },
  {
    pane: "danger",
    current: "Delete project",
    headings: [""],
    facts: [],
    disabled: ["Delete project", "Keep project"],
    placeholders: 0,
    frames: 1,
    shown: ["Type to confirm"],
    hidden: [sample.project],
  },
] as const;
