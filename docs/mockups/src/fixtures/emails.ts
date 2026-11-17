/**
 * What the two email screens draw. Sam asked Mokly for a link and was invited
 * to the workspace by Alex, so one reader receives both messages and no
 * drawing makes the same person the actor and the subject. The lifetimes are
 * the ones the issuing services fix; the links are nonfunctional examples.
 */

import { lifetimePhrase } from "../emails/content";
import type { InvitationContent, SignInContent } from "../emails/content";
import { members, sample } from "./product";
import { siteOrigin } from "./site";

/** Who both messages are addressed to. */
export const recipient = members[2];

/** Who sent the invitation: the workspace's admin, not its owner. */
export const inviter = members[1];

/** The workspace Sam is invited to. */
export const workspaceName = sample.workspace;

/** The 15 minutes a sign-in link lasts, phrased as the copy quotes it. */
export const signInExpiry = lifetimePhrase({ count: 15, unit: "minute" });

/** The 7 days an invitation lasts, phrased as the copy quotes it. */
export const invitationExpiry = lifetimePhrase({ count: 7, unit: "day" });

/** A deliberately nonfunctional example; no drawing carries a credential. */
const exampleLinkToken = "example-not-a-credential";

/** Nonsecret fixture IDs for the pending member and its workspace. */
export const invitationIds = {
  workspace: "00000000-0000-0000-0000-000000000001",
  member: "00000000-0000-0000-0000-000000000002",
} as const;

/** The sign-in message Sam receives after asking for a link. */
export const signInContent: SignInContent = {
  expiry: signInExpiry,
  link: siteOrigin + "/auth/email/callback#token=" + exampleLinkToken,
};

/** The invitation Sam receives after Alex adds the address. */
export const invitationContent: InvitationContent = {
  expiry: invitationExpiry,
  invitedBy: inviter.name,
  link:
    siteOrigin +
    "/workspaces/" +
    invitationIds.workspace +
    "/invitations/" +
    invitationIds.member +
    "/accept",
  organization: workspaceName,
};
