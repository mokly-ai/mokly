import { expect, test, type Page } from "@playwright/test";

import type { ViewerSelection } from "@mokly/viewer";

import { viewerFixture } from "../../packages/viewer/tests/browser_fixture.js";

import type {} from "./viewer_harness.js";

let fixture: Awaited<ReturnType<typeof viewerFixture>>;
test.beforeAll(async () => {
  fixture = await viewerFixture("", {
    extra: `const setup = defineScreen({ ...metadata, path: "tools/setup", title: "Setup", description: "Setup", mobile: <main>Setup</main>, desktop: <main>Setup</main> });
const forms = defineScreen({ ...metadata, path: "forms", title: "Forms", description: "Forms", tags: ["forms"], mobile: <main>Forms</main>, desktop: <main>Forms</main> });`,
    exports: "...action.entries, ...pane.entries, setup, forms,",
  });
});
test.afterAll(async () => {
  await fixture.close();
});

/** Mount a controlled viewer on Setup whose host commits only on request. */
async function openControlled(page: Page, filters: Partial<ViewerSelection>) {
  await page.goto(fixture.host.url);
  await page.waitForFunction(() => Boolean(window.viewerHarness));
  await page.evaluate(
    (defaultSelection) =>
      window.viewerHarness.start("one", {
        controlled: true,
        defaultSelection,
      }),
    { screenPath: "tools/setup", ...filters },
  );
  await expect(page.locator("#one h2")).toContainText("Setup");
}

/** The selection the viewer proposed last, if any. */
function lastProposal(page: Page) {
  return page.evaluate(
    () =>
      window.viewerHarness
        .get("one")
        .events.filter((event) => event.name === "selection")
        .at(-1)?.value as ViewerSelection | undefined,
  );
}

/** Commit one selection as the host. */
function commit(page: Page, selection: ViewerSelection) {
  return page.evaluate(
    (value) => window.viewerHarness.get("one").setSelection(value),
    selection,
  );
}

const tools = (page: Page) =>
  page.locator('#one details[data-nav-disclosure="folder:specs:tools"]');

async function revealTools(page: Page) {
  await page
    .locator("#one")
    .getByLabel("Catalogue location")
    .getByRole("button", { name: "Tools" })
    .click();
}

test("a controlled reveal clears a tag-only query and focuses the folder once the host commits", async ({
  page,
}) => {
  await openControlled(page, { tags: ["forms"] });
  await expect(tools(page)).toBeHidden();
  await revealTools(page);
  const proposal = await lastProposal(page);
  expect(proposal).toEqual(
    expect.objectContaining({
      screenPath: "tools/setup",
      search: "",
      tags: [],
    }),
  );
  await expect(tools(page)).toBeHidden();
  await commit(page, proposal!);
  await expect(tools(page)).toBeVisible();
  await expect(tools(page).locator(":scope > summary")).toBeFocused();
  await expect(
    page.locator("#one").getByRole("searchbox", { name: "Search catalogue" }),
  ).toHaveValue("");
});

test("a controlled reveal waits for a cleared search before it focuses the folder", async ({
  page,
}) => {
  await openControlled(page, { search: "zzz" });
  await revealTools(page);
  const proposal = await lastProposal(page);
  expect(proposal).toEqual(expect.objectContaining({ search: "", tags: [] }));
  await expect(tools(page).locator(":scope > summary")).not.toBeFocused();
  await commit(page, proposal!);
  await expect(tools(page).locator(":scope > summary")).toBeFocused();
});

test("a host commit that leaves the folder hidden ends the reveal", async ({
  page,
}) => {
  await openControlled(page, { search: "zzz" });
  await revealTools(page);
  const proposal = await lastProposal(page);
  await commit(page, { ...proposal!, search: "yyy" });
  await expect(tools(page)).toBeHidden();
  await commit(page, { ...proposal!, search: "" });
  await expect(tools(page)).toBeVisible();
  await expect(tools(page).locator(":scope > summary")).not.toBeFocused();
});
