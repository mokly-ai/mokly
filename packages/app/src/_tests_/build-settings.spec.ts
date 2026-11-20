import type { Page } from "@playwright/test";

import { projectAddress } from "./addresses";
import { buildDouble } from "./build-double";
import { routeBuilds } from "./build-routes";
import { buildScenario } from "./build-scenario";
import { expect, freshEmail, openDialog, signIn, test } from "./harness";
import { apiOrigin } from "./origins";
import { createProject } from "./project-setup";
import { branchRow, build, buildId, summary } from "./viewer/build-fixtures";
import { pressWrite } from "./writes";

/** Open the project pane over the project's viewer. */
async function projectPane(page: Page, path: string): Promise<void> {
  await openDialog(page, path + "?settings=project");
  await expect(page.getByRole("heading", { name: "Project" })).toBeVisible();
}

test("Automatic builds writes on its own and reports a refusal beside itself", async ({
  page,
}) => {
  const scenario = await buildScenario(page, "build-switch");
  const { double } = scenario;
  double.project = {
    buildsAvailable: true,
    canRequestBuilds: true,
    automaticBuilds: false,
  };
  await projectPane(page, scenario.address.path);
  const toggle = page.getByTestId("automatic-builds");
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(
    page.getByText(
      "Publish each push to the default branch and to pull requests.",
    ),
  ).toBeVisible();

  // While its write runs, the switch shows the value asked for, disabled,
  // with its working word in its own row, and a screen reader hears the
  // operation. The write is held until that has been read.
  const answer = Promise.withResolvers<void>();
  const arrived = Promise.withResolvers<void>();
  await page.route(`**/v1/projects/${scenario.projectId}`, async (route) => {
    if (route.request().method() !== "PATCH") return route.fallback();
    arrived.resolve();
    await answer.promise;
    return route.fallback();
  });
  await toggle.click();
  await arrived.promise;
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(toggle).toBeDisabled();
  await expect(page.getByText("Saving…", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "Saving automatic builds…" }),
  ).toHaveCount(1);
  answer.resolve();

  // This run cannot build, so the real API refuses to turn it on.
  const fragment = page.locator(".fo-write-failure");
  await expect(fragment).toContainText("This project publishes from CI.");
  await expect(fragment.getByTestId("automatic-builds")).toBeVisible();
  await expect(fragment.locator(".fo-error-details")).toHaveCount(1);
  await expect(toggle).toHaveAttribute("aria-checked", "false");

  // A project that can build takes the setting with its current fields.
  double.acceptUpdates = true;
  await pressWrite(page, toggle, "PATCH", `/v1/projects/${scenario.projectId}`);
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".fo-write-failure")).toHaveCount(0);
  const [sent] = double.updates as {
    automaticBuilds: boolean;
    slug: string;
    visibility: string;
  }[];
  expect(sent.automaticBuilds).toBe(true);
  expect(sent.slug).toBe(scenario.address.slug);
  expect(sent.visibility).toBe("public");
});

test("only an administrator changes Automatic builds", async ({ page }) => {
  const scenario = await buildScenario(page, "build-switch-reader");
  scenario.double.project = {
    buildsAvailable: true,
    canRequestBuilds: true,
    automaticBuilds: true,
    canAdmin: false,
  };
  await projectPane(page, scenario.address.path);
  const toggle = page.getByTestId("automatic-builds");
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(toggle).toHaveAttribute("aria-disabled", "true");
});

test("a project that cannot build says how it publishes instead", async ({
  page,
}) => {
  const scenario = await buildScenario(page, "build-switch-none");
  await page.unrouteAll({ behavior: "wait" });
  await projectPane(page, scenario.address.path);
  await expect(page.getByTestId("automatic-builds")).toHaveCount(0);
  await expect(page.getByText("This project publishes from CI.")).toBeVisible();
});

test("the finished project says its default branch is publishing", async ({
  page,
}) => {
  await signIn(page, freshEmail("build-created"));
  const id = buildId(300);
  // Creation scheduled the default branch's first build, which the branch
  // list reports on its row before the project id is known to this test.
  await page.route(
    (url) =>
      url.origin === apiOrigin &&
      /^\/v1\/projects\/[^/]+\/branches$/.test(url.pathname),
    async (route) => {
      const answer = await route.fetch();
      return route.fulfill({
        response: answer,
        json: {
          items: [
            branchRow("main", {
              newestBuild: summary({ id, state: "queued" }),
            }),
          ],
          nextCursor: null,
        },
      });
    },
  );
  const projectId = await createProject(page, "Build Created Org");
  await expect(page.getByText("Mokly is publishing main.")).toBeVisible();
  const guide = page.getByRole("link", { name: "Publish from CI" });
  await expect(guide).toHaveAttribute("href", /\/docs\/ci\/publish-from-ci\/$/);
  await expect(page.getByTestId("publish-from-ci")).toHaveCount(0);

  // Open project leads into the viewer, where that build runs in the stage.
  await page.unrouteAll({ behavior: "wait" });
  const double = buildDouble();
  double.builds.set(
    id,
    build({ id, projectId, branch: "main", state: "queued", step: null }),
  );
  double.branches = [
    branchRow("main", { newestBuild: summary({ id, state: "queued" }) }),
  ];
  await routeBuilds(page, projectId, double);
  await page.getByTestId("open-project").click();
  const address = await projectAddress(page, projectId);
  await page.waitForURL((url) => url.pathname === address.path);
  await expect(
    page.getByRole("heading", { name: "Publishing this branch" }),
  ).toBeVisible();
  await expect(page.getByText("Waiting to start.")).toBeVisible();
});

test("with nothing publishing, the finished project leads with the guide", async ({
  page,
}) => {
  await signIn(page, freshEmail("build-created-ci"));
  await createProject(page, "Build CI Org");
  const actions = page.locator(".fo-account-actions").getByRole("button");
  await expect(actions).toHaveText(["Publish from CI", "Open project"]);
  await expect(page.getByText(/Mokly is publishing/)).toHaveCount(0);
});
