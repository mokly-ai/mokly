import { expect, test } from "@playwright/test";

import { reactShellForProject } from "./export_shell.js";
import { startStaticFixture } from "./static_fixture.js";

let site: Awaited<ReturnType<typeof startStaticFixture>>;
test.beforeAll(async ({ browser: _browser }, info) => {
  site = await startStaticFixture({
    noChanges: true,
    reactShell: reactShellForProject(info.project.name),
  });
});
test.afterAll(async () => {
  await site?.close();
});

for (const width of [390, 1440]) {
  test(`current-only publication navigates without comparison requests at ${width}px`, async ({
    page,
  }) => {
    const requests: string[] = [];
    const failures: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    page.on("response", (response) => {
      if (response.status() >= 400) failures.push(response.url());
    });
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${site.url}/id/home/`);
    await expect(page).toHaveURL(`${site.url}/view/screens/home.html`);
    await expect(page.locator("#mb-main h2")).toHaveText("Home");
    await expect(
      page.getByRole("group", { name: "Comparison mode" }),
    ).toHaveCount(0);
    await expect(page.locator('[data-filter="changed"]')).toHaveCount(0);
    if (width === 390)
      await page
        .getByRole("button", { name: "Open catalogue navigation" })
        .click();
    await page.locator('[data-route="screens/details.html"]').click();
    await expect(page).toHaveURL(`${site.url}/view/screens/details.html`);
    await expect(page.locator("#mb-main h2")).toHaveText("Details");
    await page.goBack();
    await expect(page.locator("#mb-main h2")).toHaveText("Home");
    await page.reload();
    await expect(page.locator("#mb-main h2")).toHaveText("Home");
    expect(
      requests.filter((url) => /\/__mokly\/(diffs|events)/.test(url)),
    ).toEqual([]);
    expect(failures).toEqual([]);
  });
}
