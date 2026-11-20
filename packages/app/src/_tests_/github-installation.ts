import { expect } from "@playwright/test";
import type { Page, Route } from "@playwright/test";

import { releaseRecordedGitHub } from "./database-fixture";
import { ready } from "./harness";
import { apiOrigin, appOrigin, githubOrigin } from "./origins";

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
