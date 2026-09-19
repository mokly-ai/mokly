import { expect, test, type Page } from "@playwright/test";

import { startStaticFixture } from "./static_fixture.js";

let exported: Awaited<ReturnType<typeof startStaticFixture>>;

test.beforeAll(async () => {
  exported = await startStaticFixture({ noChanges: true });
});

test.afterAll(async () => {
  await exported?.close();
});

test("live host waits for explicit capabilities and repeated bootstrap stays single", async ({
  page,
}) => {
  const errors = captureErrors(page);
  await countHydrations(page);
  const gate = await delayHost(page);
  await page.goto("/view/screens/welcome.html", { waitUntil: "commit" });
  await gate.requested;

  await page.evaluate(
    (modulePath) => import(modulePath),
    "/__mokly/client/react-shell.js",
  );
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-mokly-hydrated",
    "",
  );

  gate.release();
  await page.waitForLoadState("load");
  await expect(page.locator("html")).toHaveAttribute("data-mokly-hydrated", "");
  await expect.poll(() => hydrationCount(page)).toBe(1);

  await page.evaluate(
    (modulePath) => import(modulePath),
    "/__mokly/client/react-host.js?repeat",
  );
  await expect.poll(() => hydrationCount(page)).toBe(1);
  expect(errors).toEqual([]);
});

test("export auto-hydrates once without live capabilities", async ({
  page,
}) => {
  const errors = captureErrors(page);
  await countHydrations(page);
  await page.goto(new URL("/view/screens/home.html", exported.url).href);
  await expect(page.locator("html")).toHaveAttribute("data-mokly-hydrated", "");
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-mokly-host-capabilities",
    "",
  );
  await expect.poll(() => hydrationCount(page)).toBe(1);

  await page.evaluate(
    (modulePath) => import(modulePath),
    "/__mokly/client/react-shell.js",
  );
  await expect.poll(() => hydrationCount(page)).toBe(1);
  expect(errors).toEqual([]);
});

async function countHydrations(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.assign(window, { __moklyHydrationCount: 0 });
    window.addEventListener("mokly:hydrated", () => {
      const state = window as unknown as Window & {
        __moklyHydrationCount: number;
      };
      state.__moklyHydrationCount += 1;
    });
  });
}

async function hydrationCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (window as unknown as Window & { __moklyHydrationCount: number })
        .__moklyHydrationCount,
  );
}

async function delayHost(page: Page): Promise<{
  release(): void;
  requested: Promise<void>;
}> {
  let markRequested = (): void => undefined;
  const requested = new Promise<void>((resolve) => {
    markRequested = resolve;
  });
  let release = (): void => undefined;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/__mokly/client/react-host.js", async (route) => {
    markRequested();
    await released;
    await route.continue();
  });
  return { release, requested };
}

function captureErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const sandboxDiagnostic =
      message.text().includes("document's frame is sandboxed") &&
      message.text().startsWith("Blocked script execution in");
    if (!sandboxDiagnostic) errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}
