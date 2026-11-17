import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import type { Page } from "@playwright/test";

import {
  currentWorkspaceId,
  expect,
  freshEmail,
  installApp,
  workspaceAddress,
  signIn,
} from "./harness";
import { apiOrigin } from "./origins";

/** A promise a routed response can hold until the test releases it. */
export function requestGate(): { wait: Promise<void>; release: () => void } {
  let release: () => void = () => undefined;
  const wait = new Promise<void>((resolveGate) => {
    release = resolveGate;
  });
  return { wait, release };
}

/** One collision-safe slug within both address ceilings used by the suite. */
export function uniqueSlug(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

/** Reach the real workspace create form as a new signed-in reader. */
export async function createWorkspaceStep(
  page: Page,
  label: string,
): Promise<void> {
  await signIn(page, freshEmail(label));
  await page.waitForURL((url) => url.pathname === "/new");
}

/** Create one real workspace, install the App and reach the repository step. */
export async function reachRepositoryStep(
  page: Page,
  label: string,
): Promise<{ workspaceId: string; workspaceSlug: string }> {
  await createWorkspaceStep(page, label);
  const workspaceSlug = uniqueSlug("suggestion-team");
  await page.getByLabel("Workspace name").fill("Suggestion Team");
  await page.getByLabel("Workspace slug").fill(workspaceSlug);
  const creation = page.waitForRequest(
    (request) =>
      request.url().endsWith("/v1/workspaces") && request.method() === "POST",
  );
  await page.getByTestId("create-workspace").click();
  const submitted = (await creation).postDataJSON() as { slug: string };
  expect(submitted.slug).toBe(workspaceSlug);
  await page.waitForURL((url) => url.pathname === "/install");
  const workspaceId = await currentWorkspaceId(page);
  const stored = await workspaceAddress(page, workspaceId);
  await installApp(page);
  expect(new URL(page.url()).pathname).toBe(`${stored.path}/-/new`);
  return { workspaceId, workspaceSlug: stored.slug };
}

/** Add or replace the settings pane while retaining all viewer state. */
export function settingsAddress(address: string, pane: string): string {
  const url = new URL(address);
  url.searchParams.set("settings", pane);
  return url.href;
}

/** Persist a reviewable browser image outside the repository diff. */
export async function captureReadableAddress(
  page: Page,
  name: string,
): Promise<void> {
  const directory = resolve(
    process.cwd(),
    "../../.context/readable-addresses-app",
  );
  mkdirSync(directory, { recursive: true });
  await page.screenshot({
    path: resolve(directory, `${name}.png`),
    fullPage: true,
  });
}

/** One actual screen/view accepted by the running Share API. */
export async function shareSelection(
  page: Page,
  projectId: string,
  publicationId: string,
): Promise<{
  path: string;
  title: string;
  viewport: "desktop" | "mobile";
  scheme: "light" | "dark";
}> {
  const selection = await page.evaluate(
    async ([origin, project, publication]) => {
      const answer = await fetch(
        `${origin}/v1/projects/${project}/publications/${publication}/screens`,
        { credentials: "include" },
      );
      if (!answer.ok) throw new Error(`screen list failed: ${answer.status}`);
      const body = (await answer.json()) as {
        items: {
          path: string;
          title: string;
          views: {
            viewport: "desktop" | "mobile";
            colorScheme: "light" | "dark";
          }[];
        }[];
      };
      const screen =
        body.items.find((item) => item.path === "start") ?? body.items[0];
      const view =
        screen?.views.find(
          (candidate) =>
            candidate.viewport === "mobile" || candidate.colorScheme === "dark",
        ) ?? screen?.views[0];
      if (!screen || !view)
        throw new Error("publication has no shareable view");
      return {
        path: screen.path,
        title: screen.title,
        viewport: view.viewport,
        scheme: view.colorScheme,
      };
    },
    [apiOrigin, projectId, publicationId] as const,
  );
  expect(selection.path).not.toBe("");
  return selection;
}
