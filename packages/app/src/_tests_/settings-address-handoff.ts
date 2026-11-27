import { createHash } from "node:crypto";

import type { Page } from "@playwright/test";

import { sql } from "./database-fixture";
import { expect } from "./harness";
import { apiOrigin } from "./origins";

export function settingsLink(
  pathname: string,
  catalogueScreen: string,
): string {
  const query = new URLSearchParams();
  query.set("view", "changes");
  query.set("catalogueScreen", catalogueScreen);
  query.append("tag", "a");
  query.append("tag", "b");
  return `${pathname}?${query.toString()}`;
}

export function expectExactReturnTo(
  address: string,
  destination: string,
): void {
  const current = new URL(address);
  expect(current.pathname).toBe("/sign-in");
  expect([...current.searchParams]).toEqual([["returnTo", destination]]);
}

export async function expectSettingsHandoff(
  page: Page,
  pane: string,
  title: string,
  catalogueScreen: string,
): Promise<void> {
  await expect(page).toHaveURL(
    (url) => url.searchParams.get("settings") === pane,
  );
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { level: 1 })).toHaveText(title);
  const current = new URL(page.url());
  expect(current.searchParams.get("view")).toBe("changes");
  expect(current.searchParams.get("catalogueScreen")).toBe(catalogueScreen);
  expect(current.searchParams.getAll("tag")).toEqual(["a", "b"]);
}

export async function endSession(page: Page): Promise<void> {
  await page.evaluate(async (origin) => {
    const sessionAnswer = await fetch(`${origin}/v1/session`, {
      credentials: "include",
    });
    if (!sessionAnswer.ok) {
      throw new Error(`session read failed: ${sessionAnswer.status}`);
    }
    const { csrfToken } = (await sessionAnswer.json()) as {
      csrfToken: string;
    };
    const answer = await fetch(`${origin}/v1/session`, {
      method: "DELETE",
      credentials: "include",
      headers: { "x-csrf-token": csrfToken },
    });
    if (!answer.ok) throw new Error(`sign out failed: ${answer.status}`);
  }, apiOrigin);
  await page.evaluate(() => window.localStorage.clear());
  await page.context().clearCookies();
}

/**
 * Reopen the sign-in link window of one address. The API sends one link per
 * address each minute, so a test that signs the same reader in again would
 * wait out that minute. This clears the row the limit keeps, keyed as
 * `mkc-auth` keys it: the SHA-256 of `email:` and the normalized address. The
 * second request still goes through the real API and mailer.
 */
export function reopenSignInWindow(email: string): void {
  const key = createHash("sha256")
    .update(`email:${email.trim().toLowerCase()}`)
    .digest("hex");
  sql(`DELETE FROM auth_rate_limits WHERE key = '${key}'`);
}

export async function retireAddressSlugs(
  page: Page,
  workspaceId: string,
  projectId: string,
  nextWorkspaceSlug: string,
  nextProjectSlug: string,
): Promise<void> {
  await page.evaluate(
    async ([origin, workspace, project, nextWorkspace, nextProject]) => {
      const sessionAnswer = await fetch(`${origin}/v1/session`, {
        credentials: "include",
      });
      if (!sessionAnswer.ok) {
        throw new Error(`session read failed: ${sessionAnswer.status}`);
      }
      const { csrfToken } = (await sessionAnswer.json()) as {
        csrfToken: string;
      };
      const headers = {
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
      };
      const workspaceAnswer = await fetch(
        `${origin}/v1/workspaces/${workspace}`,
        { credentials: "include" },
      );
      const projectAnswer = await fetch(`${origin}/v1/projects/${project}`, {
        credentials: "include",
      });
      if (!workspaceAnswer.ok || !projectAnswer.ok) {
        throw new Error("address subjects could not be read");
      }
      const currentWorkspace = (await workspaceAnswer.json()) as {
        name: string;
        version: number;
      };
      const currentProject = (await projectAnswer.json()) as {
        name: string;
        visibility: "private" | "public";
        requireApproval: boolean;
        version: number;
      };
      const renamedWorkspace = await fetch(
        `${origin}/v1/workspaces/${workspace}`,
        {
          method: "PATCH",
          credentials: "include",
          headers,
          body: JSON.stringify({
            name: currentWorkspace.name,
            slug: nextWorkspace,
            version: currentWorkspace.version,
          }),
        },
      );
      if (!renamedWorkspace.ok) {
        throw new Error(`workspace rename failed: ${renamedWorkspace.status}`);
      }
      const renamedProject = await fetch(`${origin}/v1/projects/${project}`, {
        method: "PATCH",
        credentials: "include",
        headers,
        body: JSON.stringify({
          name: currentProject.name,
          slug: nextProject,
          visibility: currentProject.visibility,
          requireApproval: currentProject.requireApproval,
          version: currentProject.version,
        }),
      });
      if (!renamedProject.ok) {
        throw new Error(`project rename failed: ${renamedProject.status}`);
      }
    },
    [
      apiOrigin,
      workspaceId,
      projectId,
      nextWorkspaceSlug,
      nextProjectSlug,
    ] as const,
  );
}
