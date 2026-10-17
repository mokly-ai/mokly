import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import { reviewSnapshotFixture } from "./review_snapshot_fixture.js";

let fixture: Awaited<ReturnType<typeof reviewSnapshotFixture>>;
test.beforeAll(async () => {
  fixture = await reviewSnapshotFixture();
});

for (const view of ["mobile", "desktop", "mobile.dark", "desktop.dark"]) {
  test(`${view}: Review snapshot links retain portable targets while the pane cancels activation`, async ({
    page,
    request,
    context,
  }) => {
    await page.goto(`${fixture.url}/?view=${view}`);
    const frame = page.locator("iframe[data-mokly-comparison-frame]");
    await expect(frame).toHaveAttribute("sandbox", "allow-same-origin");
    await expect(frame).toHaveAttribute(
      "data-mokly-preview-source",
      new RegExp(
        `/snapshots/before/.*/index\\.${view.replaceAll(".", "\\.")}\\.html$`,
      ),
    );
    const link = frame
      .contentFrame()
      .getByRole("link", { name: "View details", exact: true });
    await expect(link).toBeVisible();
    const target = await link.evaluate(
      (element: HTMLAnchorElement) => element.href,
    );
    expect(target).toContain(
      `/snapshots/before/mokly-generated/example/screens/details/index.${view}.html#details`,
    );
    const response = await request.get(target);
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain("details");
    const sources: string[] = [];
    page.on("request", (request) => {
      sources.push(request.url());
    });
    let popups = 0;
    context.on("page", () => {
      popups++;
    });
    await frame.evaluate((element: HTMLIFrameElement) => {
      const document = element.contentDocument!;
      document.addEventListener("click", (event) => {
        document.documentElement.dataset.cancelled = String(
          event.defaultPrevented,
        );
      });
    });
    await link.click();
    await expect(frame.contentFrame().locator("html")).toHaveAttribute(
      "data-cancelled",
      "true",
    );
    await link.press("Enter");
    await link.click({ button: "middle" });
    expect(popups).toBe(0);
    expect(sources.filter((url) => url.includes("/details/"))).toEqual([]);
    await expect(link).toBeVisible();
    await expect(page).toHaveURL(`${fixture.url}/?view=${view}`);
  });
}
