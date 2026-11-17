import type { Route } from "@playwright/test";

import type { Branch, Build, Project, PullRequest } from "../api/types";
import type { ApiReason } from "../api/reasons";
import type { BuildDouble } from "./build-double";
import { failureFor } from "./failures";

/**
 * How the build double answers each operation it stands in for: the project
 * read and its full update, the reference lists, and the build request,
 * cancel, read and log read. `build-routes.ts` decides which request reaches
 * which answer.
 */

/** The envelope the API sends for one reason, with the data it carries. */
function refusal(
  route: Route,
  reason: ApiReason,
  data?: Record<string, unknown>,
) {
  const { code, status } = failureFor(reason);
  return route.fulfill({
    status,
    json: {
      error: {
        code,
        reason,
        message: "Refused.",
        request_id: "01994f10-0000-7000-8000-0000000000cc",
        ...(data ? { data } : {}),
      },
    },
  });
}

/** One window of a build's log after a sequence, as the API answers it. */
function logWindow(double: BuildDouble, buildId: string, after: number) {
  const chunks = (double.logs.get(buildId) ?? []).filter(
    (chunk) => chunk.sequence > after,
  );
  const window = chunks.slice(0, 100);
  const build = double.builds.get(buildId);
  const ended =
    build !== undefined && !["queued", "running"].includes(build.state);
  return {
    chunks: window,
    nextAfter: window.length > 0 ? window[window.length - 1].sequence : after,
    complete: ended && window.length === chunks.length,
    elision: double.elisions.get(buildId) ?? null,
  };
}

/** Replace real rows with the double's rows of the same name, then add the rest. */
function merged<T>(real: T[], own: T[], key: (row: T) => string): T[] {
  const names = new Set(own.map(key));
  return [...own, ...real.filter((row) => !names.has(key(row)))];
}

/** The real project read, with the double's build fields over it. */
export async function answerProject(route: Route, double: BuildDouble) {
  const answer = await route.fetch();
  const body = (await answer.json()) as Project;
  return route.fulfill({
    response: answer,
    json: { ...body, ...double.project },
  });
}

/** Store an accepted full update's Automatic builds over the real project. */
export async function answerUpdate(route: Route, double: BuildDouble) {
  const body = route.request().postDataJSON() as { automaticBuilds?: boolean };
  double.updates.push(body);
  if (body.automaticBuilds !== undefined) {
    double.project = {
      ...double.project,
      automaticBuilds: body.automaticBuilds,
    };
  }
  const answer = await route.fetch({ method: "GET", postData: undefined });
  const real = (await answer.json()) as Project;
  return route.fulfill({
    response: answer,
    json: { ...real, ...double.project },
  });
}

/** The real branch or pull request list, with the double's rows over it. */
export async function answerRows(
  route: Route,
  double: BuildDouble,
  kind: "branches" | "pulls",
) {
  const answer = await route.fetch();
  const body = (await answer.json()) as { items: (Branch | PullRequest)[] };
  body.items =
    kind === "branches"
      ? merged(body.items as Branch[], double.branches, (row) => row.name)
      : merged(body.items as PullRequest[], double.pullRequests, (row) =>
          String(row.number),
        );
  return route.fulfill({ response: answer, json: body });
}

/**
 * The build operations themselves: a request creates the double's next build
 * or is refused, Cancel cancels a build or is refused, and the build and log
 * reads answer from what the double holds.
 */
export async function answerBuilds(
  route: Route,
  double: BuildDouble,
  rest: string[],
) {
  const method = route.request().method();
  const [, buildId, tail] = rest;
  if (buildId === undefined && method === "POST") {
    double.requests.push(route.request().postDataJSON());
    if (double.refuseRequest) {
      return refusal(
        route,
        double.refuseRequest.reason,
        double.refuseRequest.data,
      );
    }
    const created = double.nextBuild;
    if (!created) return refusal(route, "builds-unavailable");
    double.builds.set(created.id, created);
    return route.fulfill({ status: 201, json: created });
  }
  if (tail === "cancel" && method === "POST") {
    double.cancels.push(buildId);
    if (double.refuseCancel) return refusal(route, double.refuseCancel);
    const build = double.builds.get(buildId);
    if (!build) return refusal(route, "not-found");
    const cancelled: Build = {
      ...build,
      state: "cancelled",
      canCancel: false,
      finishedAt: new Date().toISOString(),
    };
    double.builds.set(buildId, cancelled);
    return route.fulfill({ json: cancelled });
  }
  if (method !== "GET") return route.continue();
  const build = double.builds.get(buildId);
  if (tail === "log") {
    double.reads.push("log:" + buildId);
    if (double.failLog) return refusal(route, double.failLog);
    const after = Number(
      new URL(route.request().url()).searchParams.get("after") ?? "0",
    );
    return build
      ? route.fulfill({ json: logWindow(double, buildId, after) })
      : refusal(route, "not-found");
  }
  double.reads.push("build:" + buildId);
  if (double.failBuild) return refusal(route, double.failBuild);
  if (!build) return refusal(route, "not-found");
  const hold = double.holdBuildReads;
  if (hold) {
    double.heldBuildReads += 1;
    await hold;
    double.heldBuildReads -= 1;
  }
  return route.fulfill({ json: build });
}
