import { expect, test } from "@playwright/test";

import { startStaticFixture } from "./static_fixture.js";

const message =
  "This catalogue needs a compatible Mokly viewer. Update the viewer and reload.";
let site: Awaited<ReturnType<typeof startStaticFixture>>;
test.beforeAll(async () => {
  site = await startStaticFixture({ noChanges: true });
});
test.afterAll(async () => {
  await site?.close();
});

for (const boundary of ["catalogue", "delivery", "bootstrap"] as const) {
  test(`unsupported ${boundary} preserves the static page without hydration`, async ({
    page,
  }) => {
    const catalogues: string[] = [];
    const warnings: string[] = [];
    page.on("console", (message) => warnings.push(message.text()));
    await page.addInitScript(() => {
      document.addEventListener("mokly:hydrated", () => {
        document.documentElement.setAttribute("data-test-hydrated", "true");
      });
    });
    await page.route("**/mokly-viewer/catalogue.json", async (route) => {
      catalogues.push(route.request().url());
      const json = await (await route.fetch()).json();
      await route.fulfill({ json: { ...json, schemaVersion: 3 } });
    });
    if (boundary !== "catalogue")
      await page.route("**/view/home/index.html", async (route) => {
        const response = await route.fetch();
        let body = await response.text();
        body =
          boundary === "delivery"
            ? body.replace(
                "&quot;schemaVersion&quot;:5",
                "&quot;schemaVersion&quot;:3",
              )
            : body.replace(
                /(<script[^>]*data-mokly-shell-bootstrap[^>]*>)([\s\S]*?)(<\/script>)/u,
                (_match, before, json, after) =>
                  `${before}${JSON.stringify({ ...JSON.parse(json), schemaVersion: 0 })}${after}`,
              );
        await route.fulfill({ response, body });
      });
    await page.goto(`${site.url}/view/home/index.html`);
    await expect(page.getByRole("alert")).toHaveText(message);
    await expect(page.locator("#mb-main h2")).toHaveText("Home");
    await expect(page.locator("html")).not.toHaveAttribute(
      "data-test-hydrated",
    );
    expect(catalogues).toHaveLength(boundary === "catalogue" ? 1 : 0);
    expect(
      warnings.some((line) =>
        line.includes(`Unsupported Mokly ${boundary} version`),
      ),
    ).toBe(true);
    await expect(
      page.locator('a[data-route="details/index.html"]').first(),
    ).toHaveAttribute("href", /\/view\/details\//u);
  });
}
