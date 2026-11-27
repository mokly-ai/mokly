import { members, roles, workspace, project, sample } from "./product";

/** Named scenario snapshots; these are mockup data, never live application data. */
export type ScreenState = "default" | "empty" | "loading" | "error";

/**
 * One drawing's own path. `state` accepts a situation a screen family names for
 * itself — the entry screens name three — because the path is composed the same
 * way for either, while the four states keep their literal completions and stay
 * the union every other screen's drawings are checked against. The union is
 * written open rather than importing each family's situations, which would make
 * this module depend on the screens that already depend on it.
 */
export function stateScreenPath(
  id: string,
  state: ScreenState | (string & {}),
) {
  return state === "default" ? id : id + "/" + state;
}

export const onboarding = {
  email: members[0].email,
  /** The address the API refused: what the reader typed, not a whole address. */
  incompleteEmail: members[0].email.replace(/\.[a-z]+$/, ""),
  workspace: sample.workspace,
  workspaceSlug: workspace.slug,
  workspaceSlugSuggestion: workspace.slug + "-2",
  githubAccount: "mokly-ai",
  config: sample.config,
  projectSlug: project.slug,
  projectSlugSuggestion: project.slug + "-2",
  /**
   * The repository the CLI form names, as the Mokly CLI identifies it: a host
   * other than github.com, an owner with a group beneath it, and the name.
   */
  cliRepository: "gitlab.com/mokly-ai/web/site",
  cliProjectSlug: "site",
} as const;

/**
 * Someone who has not set a name is listed and managed by their address, which
 * is longer than the panel's column; short names hide what that costs.
 */
export const unnamedMember = {
  name: "jordan.mccallister@example.com",
  email: "jordan.mccallister@example.com",
  role: "Member",
  initials: "JM",
} as const;

/** Valid long labels that exercise the desktop viewer chrome's shared row. */
export const denseViewerChrome = {
  workspace: "Readable Rename Workspace With A Long Display Name",
  email: `readable-rename-${"9".repeat(16)}@example.com`,
} as const;

/** Sam is pending in this invitation snapshot and accepted in the detail snapshot. */
export const membership = {
  active: [...members.filter((person) => person.name !== "Sam"), unnamedMember],
  invited: members[2],
  selected: members[2],
  /**
   * The address the reader typed into the invite form, which its write sends:
   * someone neither active nor pending in the workspace.
   */
  inviting: "riley@example.com",
  /** The role the reader chose for Sam, which Save role's write sends. */
  askedRole: roles[1],
} as const;

/**
 * What an untouched field shows, exactly as the running product sets it: the
 * account's own name, and the shape of the repository the CLI form asks for.
 * A field the product gives a default value instead — the config path — has
 * none, and a value the reader chooses from a list is a select whose own
 * placeholder belongs to the drawing that shows it empty.
 */
export const placeholders = {
  name: "Your name",
  repository: "host/owner/name",
} as const;

/**
 * The reference Mokly answers a failed request with, quoted by the Details
 * disclosure so a report can name it. A mockup value, never a credential.
 */
export const failureReference = "9f1c7d2e-58ab-4c60-9d31-0b7a4e6c81f2";

/**
 * What a refused write says beside the control that made it. Each sentence
 * names the cause; the control names the operation and is the way back.
 */
export const causes = {
  busy: "Mokly is busy. Try again in a moment.",
  permission: "You don’t have permission to do that.",
  clipboard: "Copying didn’t work here. Select the token above and copy it.",
  duplicate: "This repository already has a project.",
  planRequired: "Private projects are on Team.",
  /** A build request for a pull request that closed, which gets no new build. */
  closedPullRequest: "This pull request is closed.",
  /** A build request in a project that no longer builds, which publishes from CI. */
  buildsUnavailable: "This project publishes from CI.",
} as const;

/**
 * What a screen says about a control when nothing was refused. A notice offers
 * no way back and discloses no reference, so it is not a cause and never draws
 * the refusal fragment.
 */
export const notices = {
  githubOpensSoon:
    "GitHub sign-in opens soon. Continue with your email address.",
} as const;

/**
 * What a field says when the reader's own text is what was refused. The
 * registered input draws the same sentence in its invalid variant, because a
 * refusal the reader can only answer by editing belongs on the field.
 */
export const fieldRefusals = {
  email: "Enter a complete email address.",
  /**
   * A form that declares no sentence of its own draws the shared one, put on
   * the field the form named for the refusal.
   */
  tokenName: "Check the values and try again.",
  /**
   * What sign in's Password field says when the API refused the password: the
   * shared sentence of that refusal, on the field the section names for it.
   */
  password: "This password isn’t valid.",
} as const;

/**
 * Sign in's password section, which a deployment draws when its configuration
 * answer names a shared account: that account, and the password the reader
 * typed, which is visibly not a credential. What the Password field says when
 * the API refused it is `fieldRefusals.password`.
 */
export const previewPassword = {
  account: "preview@mokly.ai",
  typed: "mockup-password-not-a-credential",
} as const;

/** Address-field recoveries that land with the readable-address UI milestone. */
export const slugRefusals = {
  createWorkspaceTaken: "This address is already in use. Try mokly-team-2.",
  createWorkspaceReserved: "This address isn’t available. Try mokly-team-2.",
  createProjectTaken: "This address is already in use. Try mokly-cloud-2.",
  workspaceTaken: "This address is already in use. Try mokly-studio-2.",
  workspaceReserved: "This address isn’t available. Try mokly-studio-2.",
  projectTaken: "This address is already in use. Try cloud-app-2.",
  slugFormat: "Use lowercase letters, numbers and single hyphens.",
  versionConflict: "This changed elsewhere. Reopen it to see the latest.",
} as const;

/** Drafts used by the two address settings pages. */
export const slugEdits = {
  workspace: { draft: "mokly-studio", refused: "mokly-studio" },
  project: { draft: "cloud-app", refused: "cloud-app" },
} as const;

/** Cal's own profile, shown by the account pane of the settings dialog. */
export const profile = {
  ...members[0],
  github: "calummoore",
} as const;

/** The catalogue's seat prices, in the cents the billing read reports. */
export const seatAmounts = { editor: 2000, collaborator: 500 } as const;

/** How long the one trial a workspace is offered runs. */
export const trialDays = 7;

/** One amount as a pane shows it, from the cents Mokly answers with. */
function money(cents: number): string {
  return "$" + (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}

/** A seat kind is derived from a role and is never a setting of its own. */
function seatKind(role: string): "editor" | "collaborator" {
  return role === "Reviewer" ? "collaborator" : "editor";
}

/**
 * The seats this workspace is using. Editors are everyone in it who is not
 * a reviewer, and the one Collaborator is Sam's reviewer grant on Mokly Cloud,
 * which the access pane lists: a grant occupies a seat exactly as a membership
 * does. The pending invitation occupies none.
 */
const editorsInUse = membership.active.filter(
  (person) => seatKind(person.role) === "editor",
).length;
const collaboratorsInUse = 1;

/**
 * What the Billing pane reads. Every amount is written once, here, because the
 * running pane reads the counts and the unit amounts from one billing response
 * and computes the total from them; a price typed into a screen would be a
 * number Stripe never agreed to.
 */
export const billing = {
  copy: {
    freeHeadline: "Free for open-source catalogues",
    confirming: "Confirming your subscription",
    delayed: "Still confirming your subscription",
    /** A billing read that failed says so where the pane's facts would be. */
    readFailed: "Billing couldn’t load",
    paymentFailed: "Payment failed",
    /** A billing deployment with no configured provider has no facts or action. */
    opensSoon: "Billing opens soon.",
    /** The refused private-visibility modal says this above its confirmation. */
    privateVisibility: causes.planRequired,
    privateUpload: "Publishing to private projects is on Team.",
    /** Everyone who cannot start Checkout gets the one action they can take. */
    askOwner: "Ask an owner to upgrade to Team.",
    /** An admin may read billing facts but cannot open Stripe's surfaces. */
    adminReads: "An owner manages billing.",
  },
  plan: "Team",
  free: "Free",
  editors: {
    inUse: editorsInUse + " in use",
    each: money(seatAmounts.editor) + " each a month",
    seat: "Adds an Editor seat, " + money(seatAmounts.editor) + " a month.",
    price: money(seatAmounts.editor) + " a month",
  },
  collaborators: {
    inUse: collaboratorsInUse + " in use",
    each: money(seatAmounts.collaborator) + " each a month",
    seat:
      "Adds a Collaborator seat, " +
      money(seatAmounts.collaborator) +
      " a month.",
    price: money(seatAmounts.collaborator) + " a month",
  },
  total: money(
    editorsInUse * seatAmounts.editor +
      collaboratorsInUse * seatAmounts.collaborator,
  ),
  renews: "15 Oct",
  trial: "Team starts with a " + trialDays + "-day trial.",
  trialing: "Team until 29 Sep, then billed monthly",
  ending: "Team ends 15 Oct",
  /** A free workspace's projects are created public, so the steps say so. */
  publicProjects: "Projects are public on the free plan.",
  publicVisibility: "Public",
} as const;

/** A deliberately nonfunctional, one-time example; never a credential. */
export const exampleToken = "mkc_example_not_a_credential";
