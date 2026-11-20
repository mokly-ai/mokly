/**
 * Where the setup controls lead. A destination that differs between a
 * workspace with a connected GitHub account and one without, or between a
 * project that builds and one that cannot, takes that fact as a required
 * argument. No link can then draw one workspace while its reader stands in
 * the other, or show a build that the new project can never run.
 */

/** What the workspace's installations add up to, as the workspace read says. */
export type Installation = "connected" | "suspended" | "absent";

/**
 * Whether the new project can build. A project linked to an installed
 * repository can, and its default branch's first build starts at once. A
 * project that publishes with the CLI has no repository link and never builds.
 */
export type Builds = "available" | "unavailable";

/**
 * The step a workspace's next project starts at: the repository step once an
 * account is connected, and the install step until then, because the
 * repository step lists what the App can read. The CLI form's way back is the
 * same step, because that step is the one that offered the form.
 */
export function setupStep(installation: Installation): string {
  return installation === "connected"
    ? "product/account/choose-repository"
    : "product/account/install-app";
}

/**
 * The CLI form as this workspace reaches it: the form of a workspace with a
 * connected account, or the untouched form of one that has none, whose strip
 * claims no installation and whose way back is the install step.
 */
export function cliForm(installation: Installation): string {
  return installation === "connected"
    ? "product/account/choose-repository/cli"
    : "product/account/choose-repository/cli/empty";
}

/**
 * The finished project a creation lands on: its default branch's first build
 * running, or, for a project that cannot build, nothing publishing yet and
 * the CLI setup guide first.
 */
export function projectCreated(builds: Builds): string {
  return builds === "available"
    ? "product/account/project-created"
    : "product/account/project-created/empty";
}
