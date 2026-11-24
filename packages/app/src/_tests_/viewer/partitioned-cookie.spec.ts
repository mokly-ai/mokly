import type { Response } from "@playwright/test";

import { expect, open, test } from "../harness";

import { canvasFrame, publishedProject } from "./support";

const catalogueCookie = "__Host-mkc_catalogue";

test.use({
  launchOptions: {
    args: [
      // Playwright disables ThirdPartyStoragePartitioning by default.
      "--disable-features=",
      "--enable-features=ThirdPartyStoragePartitioning",
      "--test-third-party-cookie-phaseout",
    ],
  },
});

test("a private publication opens with third-party cookies blocked", async ({
  context,
  page,
}) => {
  const { catalogueUrl, publicationPath } = await publishedProject(
    page,
    "partitioned-cookie",
  );
  if (catalogueUrl === null) throw new Error("Expected a publication URL");
  const origin = new URL(catalogueUrl).origin;
  const reads = new Map<string, Response>();
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin === origin && response.request().method() === "GET") {
      // The frame adapter adds a query parameter to the document URL.
      reads.set(url.pathname, response);
    }
  });

  const [access] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url() === `${origin}/` &&
        response.request().method() === "GET",
    ),
    open(page, publicationPath),
  ]);
  expect(access.status(), "private catalogue access check").toBe(200);

  await page
    .getByRole("navigation", { name: "Catalogue" })
    .getByRole("link", { name: /^Start( Changed)?$/ })
    .click();
  const frame = canvasFrame(page, "Start — desktop");
  await expect(
    frame.contentFrame().getByRole("heading", {
      level: 1,
      name: "Publish the draft",
    }),
  ).toBeVisible();
  const frameSource = await frame.getAttribute("src");
  if (frameSource === null) throw new Error("Expected a Start frame URL");

  for (const [path, kind, label] of [
    ["/mokly-viewer/index.json", "fetch", "catalogue index"],
    ["/mokly-viewer/entries/start.json", "fetch", "entry detail"],
    [frameSource, "document", "Start frame"],
  ]) {
    const read = reads.get(new URL(path, origin).pathname);
    expect(read?.status(), `${label} status`).toBe(200);
    expect(read?.request().resourceType(), `${label} request type`).toBe(kind);
    expect(read?.frame() === page.mainFrame(), `${label} top-level read`).toBe(
      kind === "fetch",
    );
    expect(read?.fromServiceWorker(), `${label} is served directly`).toBe(
      false,
    );
    expect(
      read?.request().headers().authorization,
      `${label} uses cookie access`,
    ).toBeUndefined();
  }

  const cookie = (await context.cookies(catalogueUrl)).find(
    ({ name }) => name === catalogueCookie,
  );
  const { protocol, hostname } = new URL(page.url());
  expect(cookie?.partitionKey).toBe(`${protocol}//${hostname}`);
});
