import { expect, test } from "@playwright/test";

import { relocateHistoricalDocument } from "../../dist/review/historical_document.js";

test("an injected historical base preserves SVG paint and sprite fragments", async ({
  page,
}) => {
  const relocated = relocateHistoricalDocument(
    `<!doctype html><html><head><title>Historical SVG</title></head><body>
      <svg width="140" height="50">
        <defs>
          <linearGradient id="gradient"><stop stop-color="red"></stop><stop offset="1" stop-color="blue"></stop></linearGradient>
          <symbol id="icon" viewBox="0 0 20 20"><circle cx="10" cy="10" r="10"></circle></symbol>
        </defs>
        <rect id="gradient-target" width="40" height="40" fill="url(#gradient)" pointer-events="visiblePainted"></rect>
        <use id="href-use" href="#icon" x="50" width="20" height="20"></use>
        <use id="xlink-use" xlink:href="#icon" x="80" width="20" height="20"></use>
      </svg>
    </body></html>`,
    "design/browse/foo.desktop.html",
    "screens/foo.desktop.html",
  );
  const requested: string[] = [];
  page.on("request", (request) => requested.push(request.url()));
  await page.route("http://historical.test/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/screens/foo.desktop.html")
      await route.fulfill({ body: relocated, contentType: "text/html" });
    else await route.fulfill({ body: "missing", status: 404 });
  });

  await page.goto("http://historical.test/screens/foo.desktop.html");

  await expect
    .poll(() =>
      page.evaluate(() => {
        const box = (id: string) =>
          document.querySelector<SVGGraphicsElement>(id)?.getBBox().width ?? 0;
        return {
          gradientHit: document.elementFromPoint(20, 20)?.id,
          hrefWidth: box("#href-use"),
          xlinkWidth: box("#xlink-use"),
        };
      }),
    )
    .toEqual({ gradientHit: "gradient-target", hrefWidth: 20, xlinkWidth: 20 });
  expect(
    requested.filter(
      (url) => new URL(url).pathname === "/design/browse/foo.desktop.html",
    ),
  ).toEqual([]);
});
