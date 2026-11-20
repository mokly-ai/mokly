import { addresses, sample } from "../fixtures/product";
import { onboarding } from "../fixtures/product-states";

/**
 * Each wait and the loaded drawing whose layout it draws: what screen readers
 * and sighted readers hear, where a shown name sits, whether the heading is
 * known, how many steps the strip claims, whether the line to the CLI form is
 * drawn, and the answer's values that the wait must not show.
 */
export const waits = [
  {
    wait: "product/account/create-workspace/loading",
    loaded: "product/account/create-workspace",
    heard: ["Opening Mokly…", "screen-reader-only"],
    place: undefined,
    heading: "known",
    steps: 0,
    cli: false,
    hidden: [onboarding.workspace, onboarding.workspaceSlug],
  },
  {
    wait: "product/account/install-app/loading",
    loaded: "product/account/install-app",
    heard: ["Loading your workspace…", "visible"],
    place: "fo-account-detail",
    heading: "known",
    steps: 1,
    cli: true,
    hidden: ["Choose the repositories Mokly can read."],
  },
  {
    wait: "product/account/install-app/connect/loading",
    loaded: "product/account/install-app/connect",
    heard: ["Loading your workspaces…", "visible"],
    place: "fo-wait-field",
    heading: "known",
    steps: 0,
    cli: false,
    hidden: [sample.workspace],
  },
  {
    wait: "product/account/choose-repository/loading",
    loaded: "product/account/choose-repository",
    heard: ["Loading repositories…", "visible"],
    place: "fo-wait-field",
    heading: "known",
    steps: 2,
    cli: true,
    hidden: [sample.repository, onboarding.config, onboarding.projectSlug],
  },
  {
    wait: "product/account/choose-repository/cli/workspace-loading",
    loaded: "product/account/choose-repository/cli",
    heard: ["Loading your workspace…", "visible"],
    place: "fo-address-preview",
    heading: "known",
    steps: 2,
    cli: false,
    hidden: [
      onboarding.cliRepository,
      onboarding.config,
      onboarding.workspaceSlug,
    ],
  },
  {
    wait: "product/account/project-created/loading",
    loaded: "product/account/project-created/empty",
    heard: ["Opening your project…", "screen-reader-only"],
    place: undefined,
    heading: "bar",
    steps: 0,
    cli: false,
    hidden: [
      sample.project,
      sample.repository,
      sample.config,
      addresses.project,
    ],
  },
] as const;
