import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import { staticActivationFixture } from "./static_activations_fixture.js";
import { staticRequests } from "./static_delivery_assertions.js";
import { chooseScheme, expectFrameSource } from "./workspace_actions.js";

let host: Awaited<ReturnType<typeof staticActivationFixture>>;
test.beforeAll(async () => {
  host = await staticActivationFixture();
});

test("a copied catalogue restores a scheme pin and then its saved appearance", async ({
  page,
}) => {
  const requests = staticRequests(page);
  await page.goto(`${host.url}/view/details/?scheme=dark`);
  await expect(page.locator("html")).toHaveAttribute(
    "data-mokly-theme",
    "dark",
  );
  await expectFrameSource(
    page.locator(".mbk-frame-mobile iframe"),
    /index\.mobile\.dark\.html$/,
  );
  await page.goto(`${host.url}/view/details/`);
  await expect(page.locator("html")).toHaveAttribute(
    "data-mokly-theme",
    "auto",
  );
  await chooseScheme(page, "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-mokly-theme",
    "dark",
  );
  await expectFrameSource(
    page.locator(".mbk-frame-mobile iframe"),
    /index\.mobile\.dark\.html$/,
  );
  requests.assert();
});

test("copied light-only documents keep native light media and controls under Dark", async ({
  page,
}) => {
  const requests = staticRequests(page);
  await page.goto(`${host.url}/view/home/`);
  const frame = page.locator(".mbk-frame-mobile iframe");
  await expect(
    frame.contentFrame().getByRole("textbox", { name: "Native input" }),
  ).toBeVisible();
  for (const scheme of ["light", "dark"] as const) {
    await chooseScheme(page, scheme);
    await expectFrameSource(frame, /\/home\/index\.mobile\.html$/);
    await expect(frame).toHaveCSS("color-scheme", "light");
    expect(
      await frame.evaluate(
        (element: HTMLIFrameElement) =>
          element.contentWindow!.matchMedia("(prefers-color-scheme: dark)")
            .matches,
      ),
    ).toBe(false);
  }
  requests.assert();
});
