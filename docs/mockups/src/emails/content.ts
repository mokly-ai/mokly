/**
 * What each delivered message says, as typed content rather than a rendered
 * body: the two kinds, the closed set of values a template substitutes, and
 * the lifetime phrase the copy quotes.
 */

/** The two messages Mokly Cloud sends. */
export type EmailKind = "sign-in" | "invitation";

/** Every value a template may substitute, in the order the contract lists. */
export const placeholderNames = [
  "link",
  "organization",
  "invitedBy",
  "expiry",
] as const;

/** One substituted value's name. */
export type PlaceholderName = (typeof placeholderNames)[number];

/** The token a template carries where one value belongs. */
export function placeholder(name: PlaceholderName): string {
  return "{{" + name + "}}";
}

/** How long a link stays valid, in the unit its issuing service names. */
export interface Lifetime {
  count: number;
  unit: "day" | "minute";
}

/** The phrase the copy quotes for one lifetime, singular at one. */
export function lifetimePhrase({ count, unit }: Lifetime): string {
  return count + " " + unit + (count === 1 ? "" : "s");
}

/** What the sign-in message carries. */
export interface SignInContent {
  expiry: string;
  link: string;
}

/** What the invitation carries. */
export interface InvitationContent {
  expiry: string;
  invitedBy: string;
  link: string;
  /** The workspace name, under the placeholder name the templates keep. */
  organization: string;
}

/** The sign-in content the generator writes into the committed template. */
export const signInPlaceholderContent: SignInContent = {
  expiry: placeholder("expiry"),
  link: placeholder("link"),
};

/** The invitation content the generator writes into the committed template. */
export const invitationPlaceholderContent: InvitationContent = {
  expiry: placeholder("expiry"),
  invitedBy: placeholder("invitedBy"),
  link: placeholder("link"),
  organization: placeholder("organization"),
};
