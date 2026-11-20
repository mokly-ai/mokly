import type { Page } from "@playwright/test";

import { upgradeToTeam } from "./database-fixture";
import { currentWorkspaceId } from "./harness";
import { apiOrigin } from "./origins";

/**
 * Set one project's visibility through the API the project pane writes with,
 * so a test reads what the product actually says about a public or private
 * project rather than describing it.
 */
export async function setVisibility(
  page: Page,
  projectId: string,
  visibility: "public" | "private",
): Promise<void> {
  await page.evaluate(
    async ([origin, id, next]) => {
      const session = await fetch(`${origin}/v1/session`, {
        credentials: "include",
      });
      const { csrfToken } = (await session.json()) as { csrfToken: string };
      const project = await fetch(`${origin}/v1/projects/${id}`, {
        credentials: "include",
      });
      const current = (await project.json()) as {
        name: string;
        slug: string;
        version: number;
      };
      const answer = await fetch(`${origin}/v1/projects/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({
          name: current.name,
          slug: current.slug,
          visibility: next,
          requireApproval: false,
          version: current.version,
        }),
      });
      if (!answer.ok) throw new Error(`visibility failed: ${answer.status}`);
    },
    [apiOrigin, projectId, visibility] as const,
  );
}

/**
 * Make the signed-in reader's project private. A free workspace creates
 * public projects and refuses a private one, so the workspace is put on
 * Team first; the plan is written only by the billing webhook worker, which no
 * browser test can drive, so the row is written where that worker would write
 * it and the API reads it back on the write that follows.
 */
export async function makePrivate(
  page: Page,
  projectId: string,
): Promise<void> {
  upgradeToTeam(await currentWorkspaceId(page));
  await setVisibility(page, projectId, "private");
}
