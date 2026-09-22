import { expect, test } from "@playwright/test";

import type { ViewerSelection } from "@mokly/viewer";

import { viewerFixture } from "../../packages/viewer/tests/browser_fixture.js";

import type {} from "./viewer_harness.js";

let fixture: Awaited<ReturnType<typeof viewerFixture>>;
test.beforeAll(async () => {
  fixture = await viewerFixture();
});
test.afterAll(async () => {
  await fixture.close();
});
test.beforeEach(async ({ page }) => {
  await page.goto(fixture.host.url);
  await page.waitForFunction(() => Boolean(window.viewerHarness));
});

test("invalid initial and incoming selection report a safe state without crashing React", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.evaluate(() =>
    window.viewerHarness.start("one", {
      strict: true,
      defaultSelection: { viewport: "tablet" },
    }),
  );
  await expect(page.locator("#one [role=alert]")).toBeVisible();
  expect(
    await page.evaluate(() => window.viewerHarness.get("one").events),
  ).toEqual([
    {
      name: "error",
      value: {
        code: "selection",
        message: "The requested catalogue selection is unavailable.",
      },
    },
  ]);
  await page.evaluate(() =>
    window.viewerHarness.start("two", { controlled: true }),
  );
  await expect(page.locator("#two h2")).toHaveText("Home");
  await page.evaluate(() => {
    const host = window.viewerHarness.get("two");
    host.setSelection({
      ...host.props.selection!,
      viewport: "tablet",
    } as unknown as ViewerSelection);
  });
  await expect(page.locator("#two [role=alert]")).toBeVisible();
  expect(errors).toEqual([]);
});

for (const cross of [false, true])
  test(`${cross ? "postMessage" : "same-origin"} shell links retain variants and fragments without duplicate navigation`, async ({
    page,
  }) => {
    await page.evaluate(
      (cross) => window.viewerHarness.start("one", { cross }),
      cross,
    );
    const action = page.getByRole("link", { name: "Action", exact: true });
    await action.evaluate((link) => {
      (link as HTMLAnchorElement).href += "?variant=disabled&fragment=details";
    });
    await action.click();
    await expect(
      page.getByRole("combobox", { name: "Saved variant" }),
    ).toHaveValue("disabled");
    await expect
      .poll(async () => {
        const element = await page
          .locator('iframe[data-workspace-frame="mobile"]')
          .elementHandle();
        return (await element?.contentFrame())?.url();
      })
      .toMatch(/disabled\.mobile\.html(?:\?[^#]*)?#details$/);
    await page
      .getByRole("combobox", { name: "Saved variant" })
      .dispatchEvent("change");
    expect(
      await page.evaluate(() =>
        window.viewerHarness
          .get("one")
          .events.filter((event) => event.name === "navigate")
          .map((event) => event.value),
      ),
    ).toEqual([
      {
        screenId: "action",
        route: "components/action.html",
        variantId: "disabled",
        fragment: "details",
      },
    ]);
  });

test("host routing preserves unrelated links and blocks invalid historical links", async ({
  page,
}) => {
  await page.evaluate(() => window.viewerHarness.start("one"));
  const action = page.getByRole("link", { name: "Action", exact: true });
  const intercepted = async (href: string) =>
    action.evaluate((link, destination) => {
      link.setAttribute("href", destination);
      let prevented = false;
      document.addEventListener(
        "click",
        (event) => {
          prevented = event.defaultPrevented;
          event.preventDefault();
        },
        { once: true },
      );
      (link as HTMLAnchorElement).click();
      return prevented;
    }, href);

  expect(await intercepted("/documentation/help.html")).toBe(false);
  expect(
    await intercepted(
      `/view/components/action.html?snapshot=${"f".repeat(64)}`,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() =>
      window.viewerHarness
        .get("one")
        .events.filter((event) => event.name === "error"),
    ),
  ).toEqual([
    {
      name: "error",
      value: {
        code: "selection",
        message: "The requested catalogue selection is unavailable.",
      },
    },
  ]);
});
