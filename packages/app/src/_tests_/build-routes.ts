import type { Page, Route } from "@playwright/test";

import type { Project } from "../api/types";
import { liveProjectUrl } from "../data/live-client";

import {
  answerBuilds,
  answerProject,
  answerRows,
  answerUpdate,
} from "./build-answers";
import type { BuildDouble } from "./build-double";
import { apiOrigin } from "./origins";

/** One API path of this project, split after the project's own segment. */
function projectPath(url: URL, projectId: string): string[] | undefined {
  if (url.origin !== apiOrigin) return undefined;
  const prefix = "/v1/projects/" + projectId;
  if (url.pathname !== prefix && !url.pathname.startsWith(prefix + "/")) {
    return undefined;
  }
  return url.pathname.slice(prefix.length).split("/").filter(Boolean);
}

/**
 * A request the page abandoned by navigating, or that was still in flight when
 * the test ended, has nothing left to answer: its response is disposed and its
 * route is gone. Playwright closes the context with the reason "Test ended."
 * after a test passes. Only those are ignored; a timeout and any other failure
 * in a handler still fail the test.
 */
function answering(
  handler: (route: Route) => Promise<unknown>,
): (route: Route) => Promise<unknown> {
  return (route) =>
    handler(route).catch((caught: unknown) => {
      const message = caught instanceof Error ? caught.message : String(caught);
      if (
        /Response has been disposed|Route is already handled|has been closed|Test ended\./.test(
          message,
        )
      ) {
        return undefined;
      }
      throw caught;
    });
}

/**
 * Answer one project's build operations from the double. Project lookups by
 * slug are matched by the project's own identifier in the answer, so a test
 * names only the project it created.
 */
export async function routeBuilds(
  page: Page,
  projectId: string,
  double: BuildDouble,
): Promise<void> {
  // The double has no database writes to notify the socket. Use the card's
  // polling path when a browser spec changes the double.
  await page.routeWebSocket(
    liveProjectUrl(apiOrigin, projectId).href,
    (socket) => socket.close(),
  );
  await page.route(
    (url) =>
      url.origin === apiOrigin &&
      /^\/v1\/workspaces\/by-slug\/[^/]+\/projects\/[^/]+$/.test(url.pathname),
    answering(async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      const answer = await route.fetch();
      const body = (await answer.json()) as Project;
      if (body.id !== projectId) return route.fulfill({ response: answer });
      return route.fulfill({
        response: answer,
        json: { ...body, ...double.project },
      });
    }),
  );
  await page.route(
    (url) => projectPath(url, projectId) !== undefined,
    answering(async (route) => {
      const rest = projectPath(new URL(route.request().url()), projectId) ?? [];
      const method = route.request().method();
      if (rest.length === 0 && method === "GET") {
        return answerProject(route, double);
      }
      if (rest.length === 0 && method === "PATCH" && double.acceptUpdates) {
        return answerUpdate(route, double);
      }
      if (rest[0] === "branches" && method === "GET") {
        return answerRows(route, double, "branches");
      }
      if (rest[0] === "pull-requests" && method === "GET") {
        return answerRows(route, double, "pulls");
      }
      if (rest[0] === "history" && method === "GET" && double.history) {
        return route.fulfill({
          json: { items: double.history, nextCursor: null },
        });
      }
      if (rest[0] === "builds") return answerBuilds(route, double, rest);
      return route.continue();
    }),
  );
}
