import type { Page } from "@playwright/test";

/** Hold every GET whose path matches until the test lets them go. */
export async function holdReads(page: Page, path: RegExp) {
  const gate = Promise.withResolvers<void>();
  const arrived = Promise.withResolvers<void>();
  await page.route(
    (url) => path.test(url.pathname),
    async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      arrived.resolve();
      await gate.promise;
      return route.fallback();
    },
  );
  return { arrived: arrived.promise, release: () => gate.resolve() };
}

/** Hold only the next GET whose path matches, until the test lets it go. */
export async function holdNext(page: Page, path: RegExp) {
  const gate = Promise.withResolvers<void>();
  const arrived = Promise.withResolvers<void>();
  let held = false;
  await page.route(
    (url) => path.test(url.pathname),
    async (route) => {
      if (held || route.request().method() !== "GET") return route.fallback();
      held = true;
      arrived.resolve();
      await gate.promise;
      return route.fallback();
    },
  );
  return { arrived: arrived.promise, release: () => gate.resolve() };
}
