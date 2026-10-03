import { expect, test, type Locator, type Page } from "@playwright/test";

/** The extra line that sets the document icon apart from the page icon. */
const DOCUMENT_ICON = '.mbk-nav-ico path[d="M9 13h6M9 17h4"]';

function row(page: Page, entry: string): Locator {
  return page.locator(`nav.mbk-nav a[data-nav-row][data-entry-id="${entry}"]`);
}

test("the Example README is its folder's Overview row, and a document's crumb opens it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/view/example/workspace-guide/");
  const example = page.locator('details[data-nav-folder="folder:example"]');
  const overview = example.locator(":scope > a[data-nav-row]").first();
  await expect(overview).toHaveAccessibleName(/^Overview\b/);
  await expect(overview).toHaveAttribute("data-entry-id", "example");
  await expect(overview).toHaveAttribute("data-entry-kind", "document");
  await expect(overview).toHaveAttribute("data-nav-index", "");
  await expect(overview.locator(DOCUMENT_ICON)).toHaveCount(1);
  const guide = row(page, "example/workspace-guide");
  await expect(guide).toHaveAttribute("aria-current", "page");
  await expect(guide.locator(DOCUMENT_ICON)).toHaveCount(1);
  await expect(
    row(page, "example/getting-started").locator(DOCUMENT_ICON),
  ).toHaveCount(0);

  await page
    .getByLabel("Catalogue location")
    .getByRole("link", { name: "Example", exact: true })
    .click();
  await expect(page).toHaveURL(/\/view\/example\/$/);
  await expect(page.locator("#mb-main h2")).toHaveText("Example");
  await expect(overview).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByLabel("Catalogue location").getByRole("link"),
  ).toHaveCount(0);
});

test("search finds documents by title, path segment, and tag with the document icon", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/view/example/screens/details/");
  const search = page.locator("[data-mokly-search]");
  const overview = row(page, "example");
  const guide = row(page, "example/workspace-guide");
  const started = row(page, "example/getting-started");
  for (const query of ["workspace guide", "example/workspace-guide"]) {
    await search.fill(query);
    await expect(guide).toBeVisible();
    await expect(guide.locator(DOCUMENT_ICON)).toHaveCount(1);
    await expect(overview).toBeHidden();
    await expect(started).toBeHidden();
  }
  await search.fill("tag:guide");
  await expect(overview).toBeVisible();
  await expect(overview.locator(DOCUMENT_ICON)).toHaveCount(1);
  await expect(guide).toBeVisible();
  await expect(started).toBeHidden();
});
