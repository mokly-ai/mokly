import { projectPathFor } from "./addresses";
import { installApp } from "./github-installation";
import {
  currentWorkspaceId,
  expect,
  freshEmail,
  open,
  ready,
  signIn,
  test,
} from "./harness";
import { createProject } from "./project-setup";

test("/dashboard sends an account with no workspace to the workspace step", async ({
  page,
}) => {
  await signIn(page, freshEmail("noorg"));
  await page.waitForURL((url) => url.pathname === "/new");
  // The resolver waits under its own title from the first read it makes, the
  // session read, and names the wait for screen readers only.
  const session = Promise.withResolvers<void>();
  await page.route("**/v1/session", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    await session.promise;
    return route.continue();
  });
  try {
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { level: 1, name: "Opening your workspace" }),
    ).toBeVisible();
    await expect(page.getByRole("status")).toHaveText("Opening your project…");
  } finally {
    session.resolve();
  }
  await page.waitForURL((url) => url.pathname === "/new");
});

test("/dashboard sends a workspace with no project to its next step", async ({
  page,
}) => {
  await signIn(page, freshEmail("noproject"));
  await page.waitForURL((url) => url.pathname === "/new");
  await page.getByLabel("Workspace name").fill("Empty Org");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.waitForURL((url) => url.pathname === "/install");

  // Nothing is bound, so the step that binds one is where the reader belongs.
  await page.goto("/dashboard");
  await page.waitForURL((url) => url.pathname === "/install");
  await ready(page);

  // Once something is, the repository step is.
  await installApp(page);
  await page.goto("/dashboard");
  await page.waitForURL((url) => /^\/[^/]+\/-\/new$/.test(url.pathname));
});

test("dashboard and UUID resolvers reopen the canonical project viewer", async ({
  page,
}) => {
  await signIn(page, freshEmail("viewer"));
  const projectId = await createProject(page, "Viewer Org");
  const canonical = await projectPathFor(page, projectId);
  await open(page, `/projects/${projectId}`);
  await page.waitForURL((url) => url.pathname === canonical);
  await expect(page.locator(".fo-stage-canvas")).toBeVisible();
  await page.goto("/dashboard");
  await page.waitForURL((url) => url.pathname === canonical);
  const workspaceId = await currentWorkspaceId(page);
  await page.goto(`/workspaces/${workspaceId}`);
  await page.waitForURL((url) => url.pathname === canonical);
});

test("every UUID permalink tail enters the static project resolver", async ({
  page,
}) => {
  await signIn(page, freshEmail("uuid-tails"));
  const projectId = await createProject(page, "UUID Tail Org");
  const direct = `/v1/projects/${projectId}`;
  const slugCollision = `/v1/workspaces/by-slug/projects/projects/${projectId}`;
  const tails = [
    "/publications/01994f10-0000-7000-8000-0000000000aa",
    "/branches?branch=main",
    "/pull-requests/42",
    "/setup",
    "/settings",
    "/settings/tokens",
    "/settings/access",
    "/settings/danger",
  ];
  const observed: string[] = [];
  for (const tail of tails) {
    const routed = page.waitForRequest((request) => {
      const pathname = new URL(request.url()).pathname;
      return pathname === direct || pathname === slugCollision;
    });
    await page.goto(`/projects/${projectId}${tail}`);
    observed.push(new URL((await routed).url()).pathname);
  }
  expect(observed).toEqual(tails.map(() => direct));
});

test("a project with nothing published shows Set up publishing", async ({
  page,
}) => {
  await signIn(page, freshEmail("stage"));
  const projectId = await createProject(page, "Stage Org");
  await open(page, await projectPathFor(page, projectId));
  // The chrome stays mounted in every state, so the reader is never outside
  // the viewer: the slot bar is what the stage draws above its canvas.
  await expect(page.locator(".fo-top-bar")).toBeVisible();
  const canvas = page.locator(".fo-stage-canvas");
  await expect(canvas).toBeVisible();
  await expect(canvas.getByText("No publications yet")).toBeVisible();
  await expect(
    canvas.getByRole("button", { name: "Set up publishing" }),
  ).toBeVisible();
  await expect(page.locator("main, [role=main]").locator("h1")).toHaveCount(1);
  await expect(page.locator("main, [role=main]")).toHaveCount(1);
});

test("a workspace the reader cannot open resolves to their own", async ({
  page,
}) => {
  await signIn(page, freshEmail("denied-org"));
  const projectId = await createProject(page, "Mine Org");
  const canonical = await projectPathFor(page, projectId);
  await page.goto("/workspaces/01994f10-0000-7000-8000-0000000000fe");
  await page.waitForURL((url) => url.pathname === canonical);
});

test("a project the reader cannot open resolves without disclosing it", async ({
  page,
}) => {
  await signIn(page, freshEmail("denied"));
  await page.waitForURL((url) => url.pathname === "/new");
  await page.goto("/projects/01994f10-0000-7000-8000-0000000000ff");
  await page.waitForURL((url) => url.pathname === "/new");
  await expect(page.getByText("01994f10")).toHaveCount(0);
});
