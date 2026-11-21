import type { Installation, Plan, User, Visibility } from "./types";

/**
 * The name a reader has set, when they have set one.
 *
 * Every account is created by email and starts with that address as its
 * display name, so a name that is empty or still the address is no name at
 * all; a reader without one is called by their address wherever they are
 * named, and a reader with one is called by it alone.
 */
export function displayName(user: User): string | undefined {
  const name = user.name.trim();
  return name.length > 0 && name !== user.email ? name : undefined;
}

/** How a project's visibility reads in the product's own words. */
export function visibilityLabel(visibility: Visibility): string {
  return visibility === "public" ? "Public" : "Private";
}

/** How a role reads in the product's own words. */
export function roleLabel(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

/** How a plan reads in the product's own words. */
export function planLabel(plan: Plan): string {
  return plan === "team" ? "Team" : "Free";
}

/** How the kind of GitHub account an installation sits on reads. */
export const accountKindLabels = {
  user: "Personal",
  organization: "Organization",
} as const satisfies Record<Installation["accountKind"], string>;

/**
 * What an account adds to its name where its state is read in passing. A
 * connected account needs no word; a suspended one says so, because only
 * GitHub clears it. Keyed by every state, so a state the API adds fails to
 * compile until it has words rather than reading as connected.
 */
const accountStateSuffix = {
  connected: "",
  suspended: " · Suspended",
} as const satisfies Record<Installation["state"], string>;

/**
 * What the Workspace pane's GitHub accounts fact reads: every account the
 * workspace binds, in the list's order, a suspended one saying so, or "None"
 * with nothing bound.
 */
export function githubAccountsLabel(
  installations: readonly Installation[],
): string {
  if (installations.length === 0) return "None";
  return installations
    .map(
      (installation) =>
        installation.account + accountStateSuffix[installation.state],
    )
    .join(", ");
}

/**
 * What a free workspace's next project will be, said where the project is
 * about to be made and where the workspace's own projects are listed.
 *
 * One sentence in one place, because two screens say it: the repository step
 * and the Workspace pane. A copy in each would let one drift away from the
 * plan the other describes.
 */
export const publicOnFree = "Projects are public on the free plan.";

/**
 * What everyone who cannot start Checkout is told instead. Only an owner has
 * the way on, so the rest are given the one thing they can do about it; the
 * project pane and the viewer stage both say it, so it is written once.
 */
export const askAnOwnerToUpgrade = "Ask an owner to upgrade to Team.";

/** What a billing reader without the owner action is told. */
export const ownerManagesBilling = "An owner manages billing.";

/**
 * What a project that cannot build says where a build control would be: in
 * the project pane in place of the Automatic builds switch, and beside a
 * build request the API refused with `builds-unavailable`. Both name the way
 * this project publishes, so one sentence serves both.
 */
export const publishesFromCi = "This project publishes from CI.";
