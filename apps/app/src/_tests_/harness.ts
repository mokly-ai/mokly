import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test as base } from "@playwright/test";
import type { Dialog, Page, Route } from "@playwright/test";

import { installedRepository, releaseRecordedGitHub } from "./database-fixture";
import { apiOrigin, appOrigin, githubOrigin } from "./origins";
import type { operations } from "../api/generated/schema";
import type { ApiReason } from "../api/reasons";
import {
  branchPath,
  createWorkspacePath,
  installPath,
  workspacePath,
  projectPath,
  publicationPath,
  pullRequestPath,
  settingsPath,
  signUpPath,
} from "../navigation/paths";
import { failureFor } from "./failures";
import { admitLinkRequest, mailedLink } from "./sign-in-links";

/**
 * The JSON body one API operation answers with.
 *
 * A browser test that stands in for an answer is held to this, so a field
 * added to the contract fails typecheck here rather than drifting into a
 * fixture nobody re-read: the Milestone 1 review found an `Workspace`
 * literal silently missing `plan` exactly that way.
 */
export type ApiBody<Name extends keyof operations> =
  operations[Name]["responses"] extends {
    200: { content: { "application/json": infer Body } };
  }
    ? Body
    : never;

const skipMarker = resolve(process.cwd(), ".expo/app-tests/skip.txt");

function skipReason(): string {
  if (!existsSync(skipMarker)) return "";
  return readFileSync(skipMarker, "utf8").trim();
}

/**
 * Every test needs the real API; only local database unavailability may skip.
 *
 * The admission check is an automatic fixture, not a `test.beforeEach` at
 * module level. A hook registered while a module loads belongs only to the
 * spec file being loaded at that moment; Node then caches this module, so the
 * next spec file the same worker loads would import the shared `test` without
 * ever registering the hook. A fixture is attached to the `test` object itself
 * and applies to every test declared through it, in every file and on every
 * attempt.
 */
export const test = base.extend<{ admitted: void }>({
  admitted: [
    // Playwright requires the fixture argument to be a destructuring pattern,
    // even when nothing is used; the lint rule is disabled here for that reason.
    // eslint-disable-next-line no-empty-pattern
    async ({}, use, testInfo) => {
      const reason = skipReason();
      testInfo.skip(reason.length > 0, reason);
      await use();
    },
    { auto: true },
  ],
});

export { expect };

/**
 * A fresh address, so one run never inherits another's account. The API stores
 * an address lowercased, so the label is too — otherwise the link this run
 * looks for in the mailer's log is not the one the server wrote.
 */
export function freshEmail(label: string): string {
  const stem = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `${stem}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

/**
 * Every screen root carries `data-mkc-screen`, and the application only renders
 * one once its session has resolved. Waiting for it is the readiness signal a
 * navigation needs; a fixed pause would be a guess about a slow machine.
 */
export async function ready(page: Page): Promise<void> {
  await expect(page.locator("[data-mkc-screen]").first()).toBeVisible();
}

/** Wait until navigation has rendered the exact completed screen expected. */
export async function readyScreen(page: Page, screen: string): Promise<void> {
  await expect(page.locator(`[data-mkc-screen="${screen}"]`)).toBeVisible();
}

/** Navigate, then wait until the application has actually rendered a screen. */
export async function open(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await ready(page);
}

/** Sign one new person in through the real magic-link process. */
export async function signIn(
  page: Page,
  email: string,
  returnTo?: string,
): Promise<void> {
  const entry = returnTo
    ? `${signUpPath}?returnTo=${encodeURIComponent(returnTo)}`
    : signUpPath;
  await open(page, entry);
  await page.getByLabel("Email").fill(email);
  const submit = page.getByTestId("email-entry");
  await expect(submit).toBeEnabled();
  await admitLinkRequest(page, async () => {
    const sent = page.waitForResponse(
      (answer) => answer.url().endsWith("/v1/auth/magic-links"),
      { timeout: 60_000 },
    );
    await submit.click();
    return sent;
  });
  await page.waitForURL(/auth\/email/);
  await expect(page.getByText(email).first()).toBeVisible();
  await openMagicLink(page, email);
}

/** Open the one-use credential without ever including it in a test diagnostic. */
export async function openMagicLink(page: Page, email: string): Promise<void> {
  await navigateMagicLink(page, await mailedLink(email));
  // The callback screen renders while it is still exchanging the credential,
  // so wait for it to hand over: navigating away before it does cancels the
  // exchange and leaves the reader signed out.
  await page.waitForURL(
    (url) => !url.pathname.startsWith("/auth/email/callback"),
  );
  await ready(page);
}

/** Navigate with a credential without exposing its URL in Playwright errors. */
export async function navigateMagicLink(
  page: Page,
  link: string,
): Promise<void> {
  try {
    await page.goto(link);
  } catch {
    throw new Error("[app/tests] Could not open the sign-in callback");
  }
}

/**
 * Answer the two pages GitHub itself would show with the returns it sends.
 *
 * The recorded GitHub answers the provider's API, which is what the server
 * calls; the setup page and the authorization page are the browser's own two
 * stops, and a reader presses Install and Authorize on them. Nothing else about
 * the walk is stood in for: both returns land on the real landing routes, which
 * exchange them with the API, which reads the recorded provider over HTTP.
 *
 * The setup page returns the recorded installation, or the one the walk names,
 * such as the second installation the recorded GitHub serves. A later call
 * answers in place of an earlier one, because the newest route runs first.
 */
export async function answerGitHubPages(
  page: Page,
  installationId = 1,
): Promise<void> {
  const redirect = (route: Route, to: (state: string) => string) => {
    const state =
      new URL(route.request().url()).searchParams.get("state") ?? "";
    return route.fulfill({ status: 302, headers: { location: to(state) } });
  };
  await page.route(`${githubOrigin}/apps/*/installations/new*`, (route) =>
    redirect(
      route,
      (state) =>
        `${appOrigin}/auth/github/install?installation_id=${installationId}` +
        `&state=${state}&setup_action=install`,
    ),
  );
  await page.route(`${githubOrigin}/login/oauth/authorize*`, (route) =>
    redirect(
      route,
      (state) =>
        `${appOrigin}/auth/github/callback?code=fixture-code&state=${state}`,
    ),
  );
}

/**
 * Press the control that starts an installation flow, and press it again once
 * if the API turned the start away. The API admits twenty GitHub flow starts
 * per peer address per minute, and a suite that installs for every test
 * reaches that, so a refused start waits out the server's own Retry-After,
 * exactly as signing in does. The control is the same control after a
 * refusal: it reads the way back.
 */
export async function startGitHubFlow(
  page: Page,
  control: string,
): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    const started = page.waitForResponse(
      (answer) =>
        answer.url().endsWith("/v1/github/installations") &&
        answer.request().method() === "POST",
      { timeout: 60_000 },
    );
    await page.getByTestId(control).click();
    const answer = await started;
    if (answer.status() < 400) return;
    expect(answer.status(), "the API admits or rate-limits the start").toBe(
      429,
    );
    expect(
      attempt,
      "the admission window reopens within one wait",
    ).toBeLessThan(1);
    const seconds = Number(answer.headers()["retry-after"] ?? "60");
    await page.waitForTimeout((seconds + 1) * 1000);
  }
}

/**
 * Install the App for the workspace the reader is standing on, for real:
 * the API starts the flow, GitHub returns the setup, the API authorizes it and
 * binds the installation and its repositories, and the install step hands the
 * reader on to the repository step because the workspace now has one.
 */
export async function installApp(page: Page): Promise<void> {
  releaseRecordedGitHub();
  await answerGitHubPages(page);
  await startGitHubFlow(page, "install-app");
  await page.waitForURL((url) => /^\/[^/]+\/-\/new$/.test(url.pathname));
  await ready(page);
}

/**
 * Install the App for one workspace through the API exchange the two
 * GitHub pages drive: start, the setup return and the authorization return.
 * The desktop shell sends any provider page but GitHub's own to the system
 * browser, so a walk there cannot visit the recorded pages; everything after
 * them is the same real exchange against the recorded GitHub.
 */
export async function installThroughApi(
  page: Page,
  workspaceId: string,
): Promise<void> {
  releaseRecordedGitHub();
  await page.evaluate(
    async ([origin, workspace]) => {
      const post = async (path: string, body: object) => {
        const session = await fetch(`${origin}/v1/session`, {
          credentials: "include",
        });
        const { csrfToken } = (await session.json()) as { csrfToken: string };
        const answer = await fetch(origin + path, {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
            "x-csrf-token": csrfToken,
          },
          body: JSON.stringify(body),
        });
        if (!answer.ok) throw new Error(`${path} failed: ${answer.status}`);
        return (await answer.json()) as Record<string, string>;
      };
      const start = await post("/v1/github/installations", {
        workspaceId: workspace,
        returnTo: "/install",
      });
      await post("/v1/github/installations/callback", {
        installationId: 1,
        state: start.state,
        codeVerifier: start.codeVerifier,
      });
      await post("/v1/auth/github/callback", {
        code: "fixture-code",
        state: start.state,
        codeVerifier: start.codeVerifier,
      });
    },
    [apiOrigin, workspaceId] as const,
  );
}

/**
 * The repository step's own field. It carries one stable accessible name, so
 * the control is the same control however the reader has answered it, and it
 * is the same element whether or not there is anything to choose.
 */
export function repositoryField(page: Page) {
  return page.getByLabel("Repository", { exact: true });
}

/** Choose one installed repository from the repository step's own field. */
export async function chooseRepository(
  page: Page,
  repository = installedRepository,
): Promise<void> {
  await repositoryField(page).click();
  await page.getByRole("option", { name: repository }).click();
}

/**
 * Walk a new account to a created project and answer with its identifier. The
 * installation is part of the walk, because a project is a repository the App
 * can read and there is no way to create one without it, so every project is
 * created for the recorded installation's one repository. `origin` runs the
 * walk on another application origin, such as the desktop shell's, which
 * installs through the API exchange instead of the provider's pages.
 */
export async function createProject(
  page: Page,
  workspace: string,
  origin?: string,
): Promise<string> {
  await open(
    page,
    origin ? new URL(createWorkspacePath, origin).href : createWorkspacePath,
  );
  await page.getByLabel("Workspace name").fill(workspace);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.waitForURL((url) => url.pathname === installPath);
  if (origin) {
    const workspaceId =
      new URL(page.url()).searchParams.get("workspaceId") ?? "";
    await installThroughApi(page, workspaceId);
    await page.reload();
    await page.waitForURL((url) => /^\/[^/]+\/-\/new$/.test(url.pathname));
    await ready(page);
  } else {
    await installApp(page);
  }
  await chooseRepository(page);
  await page.getByRole("button", { name: "Create project" }).click();
  await page.waitForURL((url) => /^\/[^/]+\/[^/]+\/setup$/.test(url.pathname));
  await ready(page);
  const [, workspaceSlug = "", projectSlug = ""] = new URL(page.url()).pathname
    .split("/")
    .map(decodeURIComponent);
  return page.evaluate(
    async ([origin, workspaceKey, projectKey]) => {
      const answer = await fetch(
        `${origin}/v1/workspaces/by-slug/${encodeURIComponent(workspaceKey)}` +
          `/projects/${encodeURIComponent(projectKey)}`,
        { credentials: "include" },
      );
      if (!answer.ok)
        throw new Error(`project lookup failed: ${answer.status}`);
      return ((await answer.json()) as { id: string }).id;
    },
    [apiOrigin, workspaceSlug, projectSlug] as const,
  );
}

/** The current canonical address fields for one UUID workspace. */
export interface WorkspaceAddress {
  slug: string;
  path: string;
}

/** The current canonical address fields for one UUID project. */
export interface ProjectAddress {
  workspaceSlug: string;
  slug: string;
  path: string;
}

/** Resolve a stable workspace identity to its current slug address. */
export async function workspaceAddress(
  page: Page,
  workspaceId: string,
): Promise<WorkspaceAddress> {
  const slug = await page.evaluate(
    async ([origin, id]) => {
      const answer = await fetch(`${origin}/v1/workspaces/${id}`, {
        credentials: "include",
      });
      if (!answer.ok) {
        throw new Error(`workspace lookup failed: ${answer.status}`);
      }
      return ((await answer.json()) as { slug: string }).slug;
    },
    [apiOrigin, workspaceId] as const,
  );
  return { slug, path: workspacePath(slug) };
}

/** Resolve a stable project identity to its current two-slug address. */
export async function projectAddress(
  page: Page,
  projectId: string,
): Promise<ProjectAddress> {
  const project = await page.evaluate(
    async ([origin, id]) => {
      const answer = await fetch(`${origin}/v1/projects/${id}`, {
        credentials: "include",
      });
      if (!answer.ok)
        throw new Error(`project lookup failed: ${answer.status}`);
      return (await answer.json()) as {
        workspaceSlug: string;
        slug: string;
      };
    },
    [apiOrigin, projectId] as const,
  );
  return {
    ...project,
    path: projectPath(project.workspaceSlug, project.slug),
  };
}

/** Current canonical viewer path for one UUID project. */
export async function projectPathFor(
  page: Page,
  projectId: string,
): Promise<string> {
  return (await projectAddress(page, projectId)).path;
}

/** Current canonical immutable-publication path for one UUID project. */
export async function publicationPathFor(
  page: Page,
  projectId: string,
  publicationId: string,
): Promise<string> {
  const address = await projectAddress(page, projectId);
  return publicationPath(address.workspaceSlug, address.slug, publicationId);
}

/** Current canonical pull-request alias for one UUID project. */
export async function pullRequestPathFor(
  page: Page,
  projectId: string,
  number: number,
): Promise<string> {
  const address = await projectAddress(page, projectId);
  return pullRequestPath(address.workspaceSlug, address.slug, number);
}

/** Current canonical branch alias for one UUID project. */
export async function branchPathFor(
  page: Page,
  projectId: string,
  branch: string,
): Promise<string> {
  const address = await projectAddress(page, projectId);
  return branchPath(address.workspaceSlug, address.slug, branch);
}

/** A canonical project address with the supplied query text. */
export async function projectQueryPathFor(
  page: Page,
  projectId: string,
  query: string,
): Promise<string> {
  const path = await projectPathFor(page, projectId);
  return query ? `${path}?${query}` : path;
}

/** Durable project settings path from a stable UUID fixture identity. */
export async function projectSettingsPathFor(
  page: Page,
  projectId: string,
  pane: "project" | "tokens" | "access" | "danger",
): Promise<string> {
  const address = await projectAddress(page, projectId);
  return settingsPath({
    pane,
    workspaceSlug: address.workspaceSlug,
    projectSlug: address.slug,
  });
}

/** Durable workspace settings path from a stable UUID fixture identity. */
export async function workspaceSettingsPathFor(
  page: Page,
  workspaceId: string,
  pane: "workspace" | "github" | "members" | "billing",
): Promise<string> {
  const address = await workspaceAddress(page, workspaceId);
  return settingsPath({ pane, workspaceSlug: address.slug });
}

/**
 * Navigate to a `?settings=` address, or to a durable settings route, and wait
 * for the dialog over its page. A durable route on a wide surface draws the
 * dialog's wait until it hands over by replacing its address, so the dialog is
 * the reader's once the address carries it.
 */
export async function openDialog(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page).toHaveURL((url) => url.searchParams.has("settings"));
  await expect(page.getByRole("dialog")).toBeVisible();
}

/** The workspace the signed-in reader belongs to, read from the real API. */
export async function currentWorkspaceId(page: Page): Promise<string> {
  return page.evaluate(async (origin) => {
    const answer = await fetch(origin + "/v1/workspaces", {
      credentials: "include",
    });
    const body = (await answer.json()) as { items: { id: string }[] };
    return body.items[0].id;
  }, apiOrigin);
}

/** Whether the browser's own prompt is in place for a draft on this page. */
export async function unloadGuard(page: Page): Promise<boolean> {
  return page.evaluate(() => typeof window.onbeforeunload === "function");
}

/**
 * Drive an exit the page cannot intercept and report the browser's own prompts.
 * The navigation is expected not to complete: the prompt is the point.
 */
export async function leaveDocument(
  page: Page,
  go: () => Promise<unknown>,
): Promise<string[]> {
  const prompts: string[] = [];
  const seen = (dialog: Dialog) => {
    prompts.push(dialog.type());
    void dialog.dismiss();
  };
  page.on("dialog", seen);
  await go().catch(() => undefined);
  await page.waitForTimeout(500);
  page.off("dialog", seen);
  return prompts;
}

/**
 * The envelope the API sends for one reason, with the code and the status the
 * protocol's own table records for it. A fixture names the reason and nothing
 * else, so it cannot describe an answer the server has no way to produce.
 */
export function apiFailure(
  reason: ApiReason,
  message = "Try again shortly.",
): { status: number; body: string } {
  const { code, status } = failureFor(reason);
  return {
    status,
    body: JSON.stringify({
      error: {
        code,
        reason,
        message,
        request_id: "01994f10-0000-7000-8000-0000000000bb",
      },
    }),
  };
}

/**
 * Answer one endpoint with the failure the API would send for `reason`. Other
 * methods on the same address go through.
 */
export async function failWith(
  page: Page,
  url: string,
  method: string,
  reason: ApiReason,
): Promise<void> {
  const { status, body } = apiFailure(reason);
  await page.route(url, (route) => {
    if (route.request().method() !== method) return route.continue();
    return route.fulfill({ status, contentType: "application/json", body });
  });
}

/** Count what one press actually sent, so a second press cannot go unnoticed. */
export async function countRequests(
  page: Page,
  url: string,
  method: string,
): Promise<() => number> {
  let seen = 0;
  await page.route(url, async (route) => {
    if (route.request().method() !== method) return route.continue();
    seen += 1;
    // Held open, so a second press during the first cannot be mistaken for a
    // legitimate retry after it.
    await new Promise((done) => setTimeout(done, 1500));
    return route.continue();
  });
  return () => seen;
}
