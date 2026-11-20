import type { Cookie, Page } from "@playwright/test";

import { open, signIn } from "./harness";
import { apiOrigin } from "./origins";

/** The signed-in person's stable API identity. */
export async function currentUserId(page: Page): Promise<string> {
  return page.evaluate(async (origin) => {
    const answer = await fetch(`${origin}/v1/session`, {
      credentials: "include",
    });
    if (!answer.ok) throw new Error(`session read failed: ${answer.status}`);
    return ((await answer.json()) as { user: { id: string } }).user.id;
  }, apiOrigin);
}

/** Give an existing user direct administrator access to one project. */
export async function grantProject(
  page: Page,
  projectId: string,
  userId: string,
): Promise<void> {
  await page.evaluate(
    async ([origin, project, user]) => {
      const session = await fetch(`${origin}/v1/session`, {
        credentials: "include",
      });
      const { csrfToken } = (await session.json()) as { csrfToken: string };
      const answer = await fetch(`${origin}/v1/projects/${project}/members`, {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({ userId: user, role: "admin" }),
      });
      if (!answer.ok) throw new Error(`project grant failed: ${answer.status}`);
    },
    [apiOrigin, projectId, userId] as const,
  );
}

/**
 * Add a second person to a workspace, through the product and the API the
 * way a real one arrives: the signed-in reader invites an address, that person
 * signs in with their own magic link and accepts, and the reader comes back.
 * Return the member's session cookies for a later switch to that person.
 *
 * The suite has never had a workspace with more than one active member,
 * which is why a whole class of behaviour around the members panel went
 * unexercised. Acceptance has no screen yet, so this calls the endpoint the
 * API already serves; everything else is the product.
 */
export async function addMember(
  page: Page,
  workspaceId: string,
  email: string,
  role: "reviewer" | "member" | "admin" = "reviewer",
): Promise<Cookie[]> {
  const invited = await inviteThrough(page, workspaceId, email, role);
  const owner = await page.context().storageState();
  await page.context().clearCookies();
  await signIn(page, email);
  await acceptThrough(page, workspaceId, invited);
  const member = await page.context().cookies();
  await switchSession(page, owner.cookies);
  return member;
}

/** Switch to a saved API session and reload the reader's dashboard. */
export async function switchSession(
  page: Page,
  cookies: Cookie[],
): Promise<void> {
  await page.context().clearCookies();
  await page.context().addCookies(cookies);
  await open(page, "/dashboard");
}

/** Invite one address, returning the membership the invitation created. */
async function inviteThrough(
  page: Page,
  workspaceId: string,
  email: string,
  role: string,
): Promise<string> {
  return page.evaluate(
    async ([origin, id, address, chosen]) => {
      const session = await fetch(`${origin}/v1/session`, {
        credentials: "include",
      });
      const { csrfToken } = (await session.json()) as { csrfToken: string };
      const answer = await fetch(`${origin}/v1/workspaces/${id}/members`, {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({ email: address, role: chosen }),
      });
      if (!answer.ok) throw new Error(`invite failed: ${answer.status}`);
      return ((await answer.json()) as { id: string }).id;
    },
    [apiOrigin, workspaceId, email, role] as const,
  );
}

/** Accept the invitation as the person who was invited. */
async function acceptThrough(
  page: Page,
  workspaceId: string,
  memberId: string,
): Promise<void> {
  await page.evaluate(
    async ([origin, id, member]) => {
      const session = await fetch(`${origin}/v1/session`, {
        credentials: "include",
      });
      const { csrfToken } = (await session.json()) as { csrfToken: string };
      const answer = await fetch(
        `${origin}/v1/workspaces/${id}/invitations/${member}/accept`,
        {
          method: "POST",
          credentials: "include",
          headers: { "x-csrf-token": csrfToken },
        },
      );
      if (!answer.ok) throw new Error(`accept failed: ${answer.status}`);
    },
    [apiOrigin, workspaceId, memberId] as const,
  );
}
