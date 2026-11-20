import {
  api,
  correlationHeader,
  expectBody,
  expectData,
  mutationHeaders,
} from "../api/client";
import type { Token, TokenCreated } from "../api/types";

/** Publishing tokens of one project; a secret is never in this answer. */
export async function listTokens(projectId: string): Promise<Token[]> {
  const page = await expectBody((id) =>
    api.GET("/v1/projects/{projectId}/tokens", {
      params: { path: { projectId } },
      headers: correlationHeader(id),
    }),
  );
  return page.items;
}

/** Create a token; its secret is returned exactly once, here. */
export function createToken(
  projectId: string,
  name: string,
): Promise<TokenCreated> {
  return expectBody((id) =>
    api.POST("/v1/projects/{projectId}/tokens", {
      params: { path: { projectId }, header: mutationHeaders() },
      headers: correlationHeader(id),
      body: { name },
    }),
  );
}

/** Revoke a token; revocation is idempotent and keeps its metadata. */
export function revokeToken(projectId: string, tokenId: string): Promise<void> {
  return expectData((id) =>
    api.DELETE("/v1/projects/{projectId}/tokens/{tokenId}", {
      params: { path: { projectId, tokenId }, header: mutationHeaders() },
      headers: correlationHeader(id),
    }),
  ).then(() => undefined);
}
