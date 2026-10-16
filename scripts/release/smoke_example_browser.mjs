/**
 * The packed example smoke's browser half: open one screen per authoring kind
 * in the Browse shell in headless Chrome, from Serve or from a plain file
 * server that serves the built site.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";

import { chromium } from "@playwright/test";

import { expectedConsoleNotice } from "../../tests/browser/console_notices.js";

/** One screen per authoring kind, with text its desktop view shows. */
export const SCREENS = [
  { path: "example/screens/welcome", text: "View details" },
  { path: "design/browse/views/screen", text: "Search catalogue…" },
  { path: "example/team/members", text: "Invite teammate" },
];

/**
 * Requests that end without failing: Serve's event stream, which stays open
 * until a navigation cancels it, and the index and entry detail refresh,
 * which the shell cancels when a newer revision arrives
 * (`mokly-shell-delivery.md`).
 */
function cancellable(url) {
  const { pathname } = new URL(url);
  return (
    pathname === "/mokly-viewer/events" ||
    pathname === "/mokly-viewer/index.json" ||
    pathname.startsWith("/mokly-viewer/entries/")
  );
}

/** Open each screen in the Browse shell at `url` and wait for its desktop frame. */
export async function browse(url, label) {
  const browser = await chromium.launch(
    process.env.MOKLY_SMOKE_CHROME
      ? {
          executablePath: process.env.MOKLY_SMOKE_CHROME,
          args: ["--no-sandbox"],
        }
      : {},
  );
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    const problems = [];
    page.on("pageerror", (error) => problems.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" && !expectedConsoleNotice(message))
        problems.push(`${message.text()} ${message.location().url}`);
    });
    page.on("response", (response) => {
      if (response.status() >= 400)
        problems.push(`${response.status()} ${response.url()}`);
    });
    // A navigation cancels the previous page's requests that are still open.
    let navigating = false;
    page.on("requestfailed", (request) => {
      const failure = request.failure()?.errorText;
      const cancelled =
        failure === "net::ERR_ABORTED" &&
        (navigating || cancellable(request.url()));
      if (!cancelled) problems.push(`${failure} ${request.url()}`);
    });
    for (const screen of SCREENS) {
      navigating = true;
      await page.goto(`${url}/view/${screen.path}/`, { waitUntil: "load" });
      navigating = false;
      const frame = page.frameLocator(
        `iframe[src*="/${screen.path}/index.desktop.html"]`,
      );
      await frame
        .getByText(screen.text, { exact: true })
        .first()
        .waitFor({ timeout: 60_000 });
      process.stdout.write(`${label} ${screen.path} in the Browse shell.\n`);
    }
    assert.deepEqual(problems, []);
  } finally {
    await browser.close();
  }
}

const TYPES = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

/**
 * Serve the built site from a plain file server, with no Mokly process, and
 * open the screens. The static catalogue requests no live endpoint.
 */
export async function browseSite(site) {
  const requests = [];
  const server = http.createServer(async (request, response) => {
    const route = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname,
    );
    requests.push(route);
    const file = path.resolve(
      site,
      `.${route.endsWith("/") ? `${route}index.html` : route}`,
    );
    if (!file.startsWith(site + path.sep)) {
      response.writeHead(400).end();
      return;
    }
    try {
      const bytes = await fs.readFile(file);
      response.setHeader(
        "content-type",
        TYPES[path.extname(file)] ?? "application/octet-stream",
      );
      response.end(bytes);
    } catch {
      response.writeHead(404).end("Not found");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await browse(`http://127.0.0.1:${server.address().port}`, "Built");
    assert.deepEqual(
      requests.filter((route) =>
        /^\/mokly-viewer\/(live\.json|events|components\/render)/u.test(route),
      ),
      [],
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}
