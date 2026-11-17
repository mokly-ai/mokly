import { expect, open, test } from "../harness";
import { publish } from "../publish";

import { makePublic, publishedViewerReady, publishedProject } from "./support";

test("version failure keeps cloud chrome, selection and theme until a complete reload", async ({
  page,
}) => {
  const made = await publishedProject(page, "viewer-version", {
    branch: "main",
    detailVersion: 3,
  });
  await makePublic(page, made.projectId);
  const origin = new URL(made.catalogueUrl as string).origin;
  let reads = 0;
  page.on("request", (request) => {
    if (request.url() === origin + "/mokly-viewer/index.json") reads += 1;
  });
  // The package asks for the selected entry's detail, whose version it
  // refuses; the index it was given is the receiver-validated v9.
  const asked =
    made.publicationPath +
    "?catalogueScreen=start&view=changes&viewport=both&scheme=dark&search=start&tag=critical";
  await open(page, asked);
  const card = page.getByTestId("viewer-version-failure");
  await expect(card).toBeVisible();
  await expect(card.locator(".fo-state-title")).toHaveText(
    "This catalogue needs a compatible viewer",
  );
  await expect(card.locator(".fo-state-detail")).toHaveCount(0);
  await expect(card.getByRole("button")).toHaveCount(1);
  await expect(card.locator("details")).not.toHaveAttribute("open");
  await expect(card.locator("details")).toContainText(
    "Unsupported Mokly detail version 3; this viewer supports version 4.",
  );
  await expect(page.locator(".fo-published-viewer")).toHaveCount(0);
  await expect(page.getByTestId("viewer-project")).toBeVisible();
  expect(reads, "initial source").toBe(1);
  await page.evaluate(() => {
    const next = new URL(window.location.href);
    next.searchParams.set("viewport", "mobile");
    next.searchParams.set("search", "changed");
    window.history.replaceState(window.history.state, "", next.href);
  });
  const url = page.url();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute(
    "data-color-scheme",
    "dark",
  );
  expect(reads, "selection and theme").toBe(1);
  await page.getByTestId("viewer-history").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(reads, "open panel").toBe(1);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(card).toBeVisible();
  await expect(page).toHaveURL(url);
  expect(reads, "closed panel").toBe(1);
  await page.evaluate(() => {
    const next = new URL(window.location.href);
    next.hash = "keep";
    window.history.replaceState(window.history.state, "", next.href);
  });
  const complete = page.url();
  const loaded = page.waitForEvent("load");
  await card.getByRole("button", { name: "Reload", exact: true }).click();
  await loaded;
  await expect(card).toBeVisible();
  await expect(page).toHaveURL(complete);
  expect(reads).toBe(2);
  await card.getByText("Details", { exact: true }).click();
  await expect(card.locator("details")).toHaveAttribute("open", "");
});

test("a replacement catalogue source clears the version failure", async ({
  page,
}) => {
  const made = await publishedProject(page, "version-replacement", {
    branch: "main",
    detailVersion: 3,
  });
  await makePublic(page, made.projectId);
  const valid = await publish(made.token, made.projectId, { branch: "main" });
  await open(page, made.publicationPath + "?catalogueScreen=start");
  await expect(page.getByTestId("viewer-version-failure")).toBeVisible();
  await page.getByTestId("viewer-history").click();
  await page
    .getByRole("dialog")
    .locator(`a[href$="/publications/${valid.id}"]`)
    .click();
  await publishedViewerReady(page);
  await expect(page.getByTestId("viewer-version-failure")).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/publications/${valid.id}$`));
});
