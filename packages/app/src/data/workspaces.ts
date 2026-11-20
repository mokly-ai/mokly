import {
  api,
  correlationHeader,
  expectBody,
  expectData,
  mutationHeaders,
} from "../api/client";
import type {
  Member,
  Workspace,
  WorkspaceSlugLookup,
  Role,
} from "../api/types";

import { followPages } from "./publications";

/** Workspaces the reader can open, strongest role first in the API's order. */
export async function listWorkspaces(): Promise<Workspace[]> {
  const page = await expectBody((id) =>
    api.GET("/v1/workspaces", { headers: correlationHeader(id) }),
  );
  return page.items;
}

/**
 * Every workspace the reader can open, across the list's pages. A select
 * offers what this answers, so a workspace past the first page is still one
 * the reader can choose.
 */
export async function listEveryWorkspace(): Promise<Workspace[]> {
  const listed = await followPages((cursor) =>
    expectBody((id) =>
      api.GET("/v1/workspaces", {
        params: { query: { cursor } },
        headers: correlationHeader(id),
      }),
    ),
  );
  return listed.items;
}

/** Read one workspace the reader belongs to. */
export function getWorkspace(workspaceId: string): Promise<Workspace> {
  return expectBody((id) =>
    api.GET("/v1/workspaces/{workspaceId}", {
      params: { path: { workspaceId } },
      headers: correlationHeader(id),
    }),
  );
}

/** Resolve a current or retired workspace slug to its canonical subject. */
export function getWorkspaceBySlug(
  workspaceSlug: string,
): Promise<WorkspaceSlugLookup> {
  return expectBody((id) =>
    api.GET("/v1/workspaces/by-slug/{workspaceSlug}", {
      params: { path: { workspaceSlug } },
      headers: correlationHeader(id),
    }),
  );
}

/** Ask the API for an available workspace slug derived from a real name. */
export function suggestWorkspaceSlug(name: string): Promise<string> {
  return expectBody((id) =>
    api.GET("/v1/workspaces/slug-suggestion", {
      params: { query: { name } },
      headers: correlationHeader(id),
    }),
  ).then((suggestion) => suggestion.slug);
}

/** Create a personal workspace during onboarding. */
export function createWorkspace(input: {
  name: string;
  slug: string;
}): Promise<Workspace> {
  return expectBody((id) =>
    api.POST("/v1/workspaces", {
      params: { header: mutationHeaders() },
      headers: correlationHeader(id),
      body: input,
    }),
  );
}

/** Rename a workspace, carrying its version for optimistic concurrency. */
export function renameWorkspace(
  workspaceId: string,
  input: { name: string; slug: string; version: number },
): Promise<Workspace> {
  return expectBody((id) =>
    api.PATCH("/v1/workspaces/{workspaceId}", {
      params: { path: { workspaceId }, header: mutationHeaders() },
      headers: correlationHeader(id),
      body: input,
    }),
  );
}

/** Members and pending invitations of a workspace. */
export async function listMembers(workspaceId: string): Promise<Member[]> {
  const page = await expectBody((id) =>
    api.GET("/v1/workspaces/{workspaceId}/members", {
      params: { path: { workspaceId } },
      headers: correlationHeader(id),
    }),
  );
  return page.items;
}

/** Invite one address to a workspace. */
export function inviteMember(
  workspaceId: string,
  input: { email: string; role: "admin" | "member" | "reviewer" },
): Promise<Member> {
  return expectBody((id) =>
    api.POST("/v1/workspaces/{workspaceId}/members", {
      params: { path: { workspaceId }, header: mutationHeaders() },
      headers: correlationHeader(id),
      body: input,
    }),
  );
}

/** Accept a pending membership for the signed-in person's verified email. */
export function acceptInvitation(
  workspaceId: string,
  memberId: string,
): Promise<Member> {
  return expectBody((id) =>
    api.POST("/v1/workspaces/{workspaceId}/invitations/{memberId}/accept", {
      params: {
        path: { workspaceId, memberId },
        header: mutationHeaders(),
      },
      headers: correlationHeader(id),
    }),
  );
}

/** Change one member's role, preserving the last owner. */
export function updateMember(
  workspaceId: string,
  memberId: string,
  input: { role: Role; version: number },
): Promise<Member> {
  return expectBody((id) =>
    api.PATCH("/v1/workspaces/{workspaceId}/members/{memberId}", {
      params: { path: { workspaceId, memberId }, header: mutationHeaders() },
      headers: correlationHeader(id),
      body: input,
    }),
  );
}

/** Remove a member or revoke an invitation. */
export function removeMember(
  workspaceId: string,
  memberId: string,
  version: number,
): Promise<void> {
  return expectData((id) =>
    api.DELETE("/v1/workspaces/{workspaceId}/members/{memberId}", {
      params: { path: { workspaceId, memberId }, header: mutationHeaders() },
      headers: correlationHeader(id),
      body: { version },
    }),
  ).then(() => undefined);
}
