import { apiFailure } from "./api-responses";
import { manageUrl, suspendInstallation } from "./database-fixture";
import { installApp } from "./github-installation";
import { expect, freshEmail, open, signIn, test } from "./harness";
import { createWorkspace } from "./setup-walks";

/**
 * The install step for an owner or admin whose workspace GitHub has
 * suspended. The suspension is a fact of the workspace read; the link that
 * clears it comes from the installation list, a read of its own. When that
 * read fails, the step keeps the suspension and its action, says the link
 * could not be read and offers the read again.
 */

test("a failed read of the suspension's link offers it again on the install step", async ({
  page,
}) => {
  await signIn(page, freshEmail("install-suspension"));
  const workspaceId = await createWorkspace(page, "Install Suspension Org");
  await installApp(page);
  suspendInstallation(workspaceId);

  let failing = true;
  const failure = apiFailure("unavailable");
  // The first read waits until the step has been seen while it runs.
  const seen = Promise.withResolvers<void>();
  await page.route(
    (url) =>
      url.pathname === "/v1/github/installations" &&
      url.searchParams.get("workspaceId") === workspaceId,
    async (route) => {
      if (route.request().method() !== "GET" || !failing) {
        return route.continue();
      }
      await seen.promise;
      return route.fulfill({
        status: failure.status,
        contentType: "application/json",
        body: failure.body,
      });
    },
  );
  await open(page, `/install?workspaceId=${workspaceId}`);

  // While the list is read, only the link waits: the fact keeps its place,
  // and the step keeps its action and its lines.
  const fact = page.locator(".fo-facts");
  await expect(fact).toContainText("Suspended");
  await expect(page.getByRole("main").getByRole("status")).toHaveText(
    "Loading GitHub installation…",
  );
  await expect(
    page.getByRole("link", { name: "Resume on GitHub" }),
  ).toHaveCount(0);
  await expect(page.getByTestId("install-app")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Publish with the CLI instead" }),
  ).toBeVisible();
  seen.resolve();

  await expect(fact).toContainText("Couldn’t load");
  await expect(
    page.getByRole("link", { name: "Resume on GitHub" }),
  ).toHaveCount(0);
  // The failure belongs to the link alone: the step keeps its one action.
  await expect(page.getByTestId("install-app")).toBeVisible();

  failing = false;
  await fact.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("link", { name: "Resume on GitHub" }),
  ).toHaveAttribute("href", manageUrl);
  await expect(page.locator(".fo-facts")).not.toContainText("Couldn’t load");
  await expect(page.getByTestId("install-app")).toBeVisible();
});
