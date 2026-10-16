import { expect, type Page } from "@playwright/test";

/** Observe actual browser requests across navigation, history, and fake-clock work. */
export function staticRequests(page: Page) {
  const urls: string[] = [];
  const failed: string[] = [];
  page.on("request", (request) => {
    urls.push(request.url());
  });
  page.on("response", (response) => {
    if (response.status() >= 400)
      failed.push(`${response.status()} ${response.url()}`);
  });
  return {
    urls,
    assert() {
      expect(failed, "every requested file exists").toEqual([]);
      expect(
        urls.filter((url) =>
          /\/mokly-viewer\/(?:events|live\.json|components\/renders?|diffs\/review\.json)(?:[/?]|$)/u.test(
            url,
          ),
        ),
        "static output has no live requests",
      ).toEqual([]);
    },
  };
}
