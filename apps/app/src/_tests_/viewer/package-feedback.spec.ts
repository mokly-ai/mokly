import { expect, open, test } from "../harness";

import { publishedProject } from "./support";

test("a listed screen response cannot erase a selected component variant", async ({
  page,
}) => {
  const { publicationPath: path } = await publishedProject(
    page,
    "component-state",
  );
  // The variant is an entry of its own: `listScreens` names only the two
  // screens, and the package still selects the variant the address names.
  const query =
    "catalogueScreen=notice%2Fdraft&viewport=both&scheme=dark&search=notice";
  await open(page, `${path}?${query}`);
  const chosen = page.locator('[data-workspace-variant="notice/draft"]');

  const stage = page.locator("[data-mokly-stage]");
  await expect(stage).toHaveAttribute("data-viewport", "both");
  await expect(page.locator("[data-mokly-shell]")).toHaveAttribute(
    "data-mokly-color-scheme",
    "dark",
  );
  await expect(
    page.getByRole("heading", { level: 2, name: "Notice" }),
  ).toBeVisible();
  // The variant entry itself, not its parent showing its first variant.
  await expect(
    page.getByRole("button", { name: "Copy path notice/draft", exact: true }),
  ).toBeVisible();
  await expect(chosen).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("searchbox", { name: "Search catalogue" }),
  ).toHaveValue("notice");

  const screenResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      /\/publications\/[^/]+\/screens(?:\?|$)/.test(response.url()) &&
      response.status() === 200,
  );
  await page.getByTestId("viewer-share").click();
  const panel = page.getByTestId("viewer-panel-share");
  const listed = (await (await screenResponse).json()) as {
    items: { path: string }[];
  };
  expect(listed.items.map(({ path }) => path)).toEqual(["finish", "start"]);
  await expect(
    panel.getByText("Whole catalogue", { exact: true }),
  ).toBeVisible();
  // While the link is prepared, its field waits in its own frame, empty.
  const link = panel.getByLabel("Publication link");
  await expect(link).not.toHaveValue("");
  const shared = new URL(await link.inputValue());
  expect(shared.pathname).toBe(path);
  expect(shared.searchParams.get("scheme")).toBe("dark");
  expect(shared.searchParams.has("catalogueScreen")).toBe(false);
  // The scheme the API validated and the Both the host carries, and none of
  // the package's working state.
  expect([...shared.searchParams.keys()].sort()).toEqual([
    "scheme",
    "viewport",
  ]);
  await expect(page).toHaveURL(/catalogueScreen=notice%2Fdraft/);
  await expect(page).toHaveURL(/viewport=both/);
  await expect(page).toHaveURL(/search=notice/);

  await page.goBack();
  await expect(panel).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 2, name: "Notice" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/catalogueScreen=notice%2Fdraft/);
  await expect(page).toHaveURL(/viewport=both/);
  await expect(page).toHaveURL(/scheme=dark/);
  await expect(page).toHaveURL(/search=notice/);
  await expect(stage).toHaveAttribute("data-viewport", "both");
  await expect(page.locator("[data-mokly-shell]")).toHaveAttribute(
    "data-mokly-color-scheme",
    "dark",
  );
  await expect(chosen).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("searchbox", { name: "Search catalogue" }),
  ).toHaveValue("notice");

  await page.getByTestId("viewer-settings").click();
  await expect(page.getByTestId("settings-dialog")).toBeVisible();
  await page.getByTestId("close-settings").click();
  await expect(
    page.getByRole("heading", { level: 2, name: "Notice" }),
  ).toBeVisible();
  await expect(stage).toHaveAttribute("data-viewport", "both");
  await expect(page.locator("[data-mokly-shell]")).toHaveAttribute(
    "data-mokly-color-scheme",
    "dark",
  );
  await expect(chosen).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("searchbox", { name: "Search catalogue" }),
  ).toHaveValue("notice");
  await expect(page).toHaveURL(/catalogueScreen=notice%2Fdraft/);
  await expect(page).toHaveURL(/viewport=both/);
  await expect(page).toHaveURL(/scheme=dark/);
  await expect(page).toHaveURL(/search=notice/);
});

test("package filters survive panels, Back and settings rerenders", async ({
  page,
}) => {
  const { publicationPath: path } = await publishedProject(
    page,
    "filter-state",
  );
  const query = "viewport=both&scheme=dark&search=notice&tag=review";
  const search = page.getByRole("searchbox", { name: "Search catalogue" });
  await open(page, `${path}?${query}`);
  await expect(search).toHaveValue("notice tag:review");

  await page.getByTestId("viewer-history").click();
  await expect(page.getByTestId("viewer-panel-history")).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId("viewer-panel-history")).toHaveCount(0);
  await expect(search).toHaveValue("notice tag:review");
  await expect(page).toHaveURL(/viewport=both/);
  await expect(page).toHaveURL(/scheme=dark/);
  await expect(page).toHaveURL(/search=notice/);
  await expect(page).toHaveURL(/tag=review/);

  await page.getByTestId("viewer-settings").click();
  await expect(page.getByTestId("settings-dialog")).toBeVisible();
  await page.getByTestId("close-settings").click();
  await expect(search).toHaveValue("notice tag:review");
  await expect(page).toHaveURL(/viewport=both/);
  await expect(page).toHaveURL(/scheme=dark/);
  await expect(page).toHaveURL(/search=notice/);
  await expect(page).toHaveURL(/tag=review/);
});

test("package search and result selection survive controlled feedback", async ({
  page,
}) => {
  const { publicationPath: path } = await publishedProject(
    page,
    "search-result",
  );
  const search = page.getByRole("searchbox", { name: "Search catalogue" });
  await open(page, `${path}?catalogueScreen=start`);
  await expect(
    page.getByRole("heading", { level: 2, name: "Start" }),
  ).toBeVisible();

  await search.fill("notice");
  await expect(search).toHaveValue("notice");
  await expect(page).toHaveURL(/search=notice/);
  await page.getByRole("link", { name: /^Notice( Changed)?$/ }).click();
  await expect(
    page.getByRole("heading", { level: 2, name: "Notice" }),
  ).toBeVisible();
  await expect(search).toHaveValue("notice");
  await expect(page).toHaveURL(/catalogueScreen=notice/);
  await expect(page).toHaveURL(/search=notice/);

  await page.getByTestId("viewer-history").click();
  await expect(page.getByTestId("viewer-panel-history")).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId("viewer-panel-history")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 2, name: "Notice" }),
  ).toBeVisible();
  await expect(search).toHaveValue("notice");
  await expect(page).toHaveURL(/catalogueScreen=notice/);
  await expect(page).toHaveURL(/search=notice/);
});
