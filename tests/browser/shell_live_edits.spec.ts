/**
 * Live prop edits in Serve, under the component controls contract: text
 * edits wait for the 150 ms debounce on Playwright's clock, a boolean edit
 * renders at once, an edit renders again after a revision adoption or a
 * `live.generation` change, and a render that Serve rejects with a 409
 * retries after one index refresh, even while the event stream is down.
 */

import { expect, type Page, type Request } from "@playwright/test";

import { captureBrowserErrors } from "./browser_errors.js";
import { test } from "./browser_test.js";
import {
  cardFile,
  closeServe,
  isRender,
  liveIndex,
  renderBody,
  replaceFile,
  serveLiveCatalogue,
  settleLive,
  tourFile,
} from "./live_shell_fixture.js";

/** Open the card's Props panel once its live descriptor is installed. */
async function openProps(page: Page, url: string) {
  await page.goto(`${url}/view/card/`);
  await page.getByRole("tab", { name: "Props" }).click();
  const props = page.getByRole("tabpanel", { name: "Props" });
  await expect(props.getByRole("textbox", { name: "label" })).toBeEditable();
  return props;
}

/** Collect render requests; each visible view sends its own. */
function renders(page: Page): Request[] {
  const seen: Request[] = [];
  page.on("request", (request) => {
    if (isRender(request)) seen.push(request);
  });
  return seen;
}

/** The text that every stage frame shows, read through the parent page. */
function frameTexts(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLIFrameElement>("#mb-main iframe")].map(
      (frame) => frame.contentDocument?.body?.innerText ?? "",
    ),
  );
}

test("text edits wait for the 150 ms debounce; a boolean edit renders at once", async ({
  page,
}) => {
  const errors = captureBrowserErrors(page);
  const server = await serveLiveCatalogue();
  try {
    await page.clock.install();
    const props = await openProps(page, server.url);
    await expect
      .poll(() => frameTexts(page))
      .toEqual([
        expect.stringContaining("Hello 1"),
        expect.stringContaining("Hello 1"),
      ]);
    const sent = renders(page);
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1_000);
    const label = props.getByRole("textbox", { name: "label" });
    await label.fill("Ed");
    await page.clock.runFor(100);
    await label.fill("Edited");
    await page.clock.runFor(149);
    expect(sent).toHaveLength(0);
    await page.clock.runFor(1);
    await expect.poll(() => sent.length).toBe(2);
    expect(
      sent.map(renderBody).map(({ viewport, label }) => [viewport, label]),
    ).toEqual([
      ["mobile", "Edited"],
      ["desktop", "Edited"],
    ]);
    await props.getByRole("checkbox", { name: "active" }).check();
    await expect.poll(() => sent.length).toBe(4);
    await page.clock.resume();
    await expect
      .poll(() => frameTexts(page))
      .toEqual([
        expect.stringContaining("Edited 1Active"),
        expect.stringContaining("Edited 1Active"),
      ]);
    expect(errors).toEqual([]);
  } finally {
    await closeServe(page, server);
  }
});

test("an edit renders again after a revision adoption and after a live.generation change", async ({
  page,
}) => {
  const errors = captureBrowserErrors(page);
  const server = await serveLiveCatalogue();
  try {
    const props = await openProps(page, server.url);
    const sent = renders(page);
    await props.getByRole("textbox", { name: "label" }).fill("Kept edit");
    await expect.poll(() => sent.length).toBe(2);
    const first = await liveIndex(server.url);
    expect(sent.map((request) => renderBody(request).revision)).toEqual([
      first.revision,
      first.revision,
    ]);

    await replaceFile(
      server.root,
      "specs/tour.use-case.yaml",
      tourFile("Tour v2"),
    );
    // Serve can publish once more after it settles (a background render
    // completion carries no marker), so the render may use a later revision.
    const adopted = await settleLive(server.url, first.revision);
    await expect
      .poll(() => sent.at(-1) && renderBody(sent.at(-1)!).revision)
      .toBeGreaterThanOrEqual(adopted);
    expect((await liveIndex(server.url)).generation).toBe(first.generation);
    expect(renderBody(sent.at(-1)!).label).toBe("Kept edit");

    const descriptors: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/mokly-viewer/live.json")
        descriptors.push(request.url());
    });
    const count = sent.length;
    await replaceFile(
      server.root,
      "specs/card.component.html",
      cardFile('<i class="marker">v2</i>'),
    );
    // The tour edit can still publish above `adopted`, so the wait also needs
    // the card edit's own result: a new live generation.
    await settleLive(
      server.url,
      adopted,
      (index) => index.live?.generation !== first.generation,
    );
    await expect
      .poll(() => frameTexts(page))
      .toEqual([
        expect.stringContaining("v2Kept edit"),
        expect.stringContaining("v2Kept edit"),
      ]);
    expect((await liveIndex(server.url)).generation).not.toBe(first.generation);
    expect(descriptors.length).toBeGreaterThan(0);
    expect(sent.length).toBeGreaterThan(count);
    expect(renderBody(sent.at(-1)!).label).toBe("Kept edit");
    await expect(props.getByRole("textbox", { name: "label" })).toHaveValue(
      "Kept edit",
    );
    // One edit can publish more than once (the rebuild, then a background
    // render completion), and the shell renders again after each adoption. A
    // render that meets a newer revision gets a 409, and the shell retries
    // under that revision; no wait in the test can prevent it, and nothing
    // else may fail.
    expect(errors.filter((error) => !/\b409\b/.test(error))).toEqual([]);
  } finally {
    await closeServe(page, server);
  }
});

test("a 409 refreshes the index once and retries while the event stream is down", async ({
  page,
}) => {
  const errors = captureBrowserErrors(page);
  const server = await serveLiveCatalogue();
  try {
    await page.route("**/mokly-viewer/events", (route) => route.abort());
    const props = await openProps(page, server.url);
    const label = props.getByRole("textbox", { name: "label" });
    const sent = renders(page);
    const statuses: number[] = [];
    const rejected = new Set<number>();
    const indexReads: number[] = [];
    page.on("response", (response) => {
      if (!isRender(response.request())) return;
      statuses.push(response.status());
      if (response.status() === 409)
        rejected.add(renderBody(response.request()).revision);
    });
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/mokly-viewer/index.json")
        indexReads.push(sent.length);
    });
    await label.fill("Before the publication");
    await expect.poll(() => statuses).toEqual([200, 200]);
    const before = await liveIndex(server.url);

    await replaceFile(
      server.root,
      "specs/tour.use-case.yaml",
      tourFile("Tour v2"),
    );
    await settleLive(server.url, before.revision);
    await label.fill("After the publication");
    await expect
      .poll(() => frameTexts(page))
      .toEqual([
        expect.stringContaining("After the publication 1"),
        expect.stringContaining("After the publication 1"),
      ]);
    // The shell reads the index once for each revision that Serve rejected;
    // a background publication after the wait can add a second round.
    expect(rejected.size).toBeGreaterThan(0);
    expect(rejected.has(before.revision)).toBe(true);
    expect(statuses.at(-1)).toBe(200);
    expect(indexReads).toHaveLength(rejected.size);
    expect(renderBody(sent.at(-1)!).revision).toBeGreaterThan(before.revision);
    expect(errors.filter((error) => !/\b409\b|ERR_FAILED/.test(error))).toEqual(
      [],
    );
  } finally {
    await closeServe(page, server);
  }
});
