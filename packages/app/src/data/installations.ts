import {
  api,
  correlationHeader,
  expectBody,
  expectData,
  mutationHeaders,
} from "../api/client";
import type { Installation, Repository } from "../api/types";

import { followPages } from "./publications";

/**
 * Every App installation the reader can read, suspended ones included. Named
 * for one workspace, it answers that workspace's accounts only; unnamed, every
 * workspace the reader belongs to. A select and a pane list what this answers,
 * so it follows the cursor rather than stopping at one page.
 */
export async function listInstallations(
  workspaceId?: string,
): Promise<Installation[]> {
  const listed = await followPages((cursor) =>
    expectBody((id) =>
      api.GET("/v1/github/installations", {
        params: { query: { cursor, workspaceId } },
        headers: correlationHeader(id),
      }),
    ),
  );
  return listed.items;
}

/** Every repository one installation grants access to, across its pages. */
export async function listRepositories(
  installationId: string,
): Promise<Repository[]> {
  const listed = await followPages((cursor) =>
    expectBody((id) =>
      api.GET("/v1/github/installations/{installationId}/repositories", {
        params: { path: { installationId }, query: { cursor } },
        headers: correlationHeader(id),
      }),
    ),
  );
  return listed.items;
}

/**
 * Disconnect one installation from its workspace. The App stays installed on
 * GitHub, and the projects and publications made from its repositories stay.
 */
export function disconnectInstallation(installationId: string): Promise<void> {
  return expectData((id) =>
    api.DELETE("/v1/github/installations/{installationId}", {
      params: { path: { installationId }, header: mutationHeaders() },
      headers: correlationHeader(id),
    }),
  ).then(() => undefined);
}
