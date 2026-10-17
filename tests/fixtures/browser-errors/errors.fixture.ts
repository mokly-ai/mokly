import { test } from "../../browser/browser_test.js";

for (const kind of ["console", "pageerror"] as const) {
  test(`an unexpected ${kind} fails during automatic fixture teardown`, async ({
    page,
  }) => {
    test.fail();
    if (kind === "console") {
      await page.evaluate(() => console.error("unexpected console sentinel"));
    } else {
      const event = page.waitForEvent("pageerror");
      await page.evaluate(() =>
        queueMicrotask(() => {
          throw new Error("unexpected page sentinel");
        }),
      );
      await event;
    }
  });
}
