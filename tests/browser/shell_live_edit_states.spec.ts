/**
 * The states of live prop edits in Serve, under the component controls and
 * shell delivery contracts: an edit through a forwarded port and Reset,
 * navigation cancels a pending edit, fields stay read-only until the live
 * descriptor installs, a failed descriptor offers Try again, a failed render
 * keeps the last valid preview, and a newer edit replaces a held render.
 */

import { expect, type Route } from "@playwright/test";

import { test } from "./browser_test.js";
import { frameTexts, openProps, showProps } from "./live_props.js";
import {
  closeServe,
  forwardServe,
  isRender,
  renderBody,
  serveLiveCatalogue,
} from "./live_shell_fixture.js";
import { responseFailure } from "./shell_error_allowances.js";

for (const hostname of ["127.0.0.1", "localhost"])
  test(`${hostname}: an edit through a forwarded port renders, and Reset restores the saved props`, async ({
    page,
  }) => {
    const server = await serveLiveCatalogue();
    const forwarder = await forwardServe(server.url);
    try {
      expect(String(forwarder.port)).not.toBe(new URL(server.url).port);
      const host = `${hostname}:${forwarder.port}`;
      const props = await openProps(page, `http://${host}`);
      const label = props.getByRole("textbox", { name: "label" });
      const rendered = page.waitForResponse((response) =>
        isRender(response.request()),
      );
      await label.fill("Edited");
      expect((await rendered).status()).toBe(200);
      await expect
        .poll(() => frameTexts(page))
        .toEqual([
          expect.stringContaining("Edited 1"),
          expect.stringContaining("Edited 1"),
        ]);
      await props.getByRole("button", { name: "Reset to Card" }).click();
      await expect(label).toHaveValue("Hello");
      await expect
        .poll(() => frameTexts(page))
        .toEqual([
          expect.stringContaining("Hello 1"),
          expect.stringContaining("Hello 1"),
        ]);
      expect(new Set(forwarder.hosts)).toEqual(new Set([host]));
    } finally {
      await closeServe(page, forwarder, server);
    }
  });

test("navigation cancels a pending edit, and returning shows the saved props", async ({
  page,
}) => {
  const server = await serveLiveCatalogue();
  try {
    const props = await openProps(page, server.url);
    const held: Route[] = [];
    await page.route("**/mokly-viewer/components/render", (route) => {
      held.push(route);
    });
    const cancelled: string[] = [];
    page.on("requestfailed", (request) => {
      if (isRender(request)) cancelled.push(request.failure()?.errorText ?? "");
    });
    await props.getByRole("textbox", { name: "label" }).fill("Never shown");
    await expect.poll(() => held.length).toBe(2);
    await expect(page.getByText("Updating preview…").first()).toBeVisible();

    await page.locator('a[data-entry-id="home"][data-nav-row]').click();
    await expect(page.locator("#mb-main h2")).toHaveText("Home");
    await expect
      .poll(() => cancelled)
      .toEqual(["net::ERR_ABORTED", "net::ERR_ABORTED"]);
    await expect(page.getByText("Updating preview…")).toHaveCount(0);

    await page.goBack();
    await expect(page.locator("#mb-main h2")).toHaveText("Card");
    await showProps(page);
    await expect(props.getByRole("textbox", { name: "label" })).toHaveValue(
      "Hello",
    );
    await expect
      .poll(() => frameTexts(page))
      .toEqual([
        expect.stringContaining("Hello 1"),
        expect.stringContaining("Hello 1"),
      ]);
  } finally {
    await closeServe(page, server);
  }
});

test("fields stay read-only until the live descriptor installs", async ({
  page,
}) => {
  const server = await serveLiveCatalogue();
  try {
    let release!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/mokly-viewer/live.json", async (route) => {
      await released;
      await route.continue();
    });
    const props = await openProps(page, server.url, { editable: false });
    const label = props.getByRole("textbox", { name: "label" });
    await expect(props.getByText("Preparing to edit props…")).toBeVisible();
    await expect(label).toHaveValue("Hello");
    await expect(label).not.toBeEditable();
    await expect(
      props.getByRole("checkbox", { name: "active" }),
    ).toBeDisabled();
    release();
    await expect(label).toBeEditable();
    await expect(props.getByText("Preparing to edit props…")).toHaveCount(0);
  } finally {
    await closeServe(page, server);
  }
});

test("a failed live descriptor offers Try again, which installs it", async ({
  page,
  allowBrowserError,
}) => {
  const server = await serveLiveCatalogue();
  try {
    allowBrowserError(
      responseFailure(server.url, "/mokly-viewer/live.json", 503),
    );
    let failing = true;
    await page.route("**/mokly-viewer/live.json", (route) =>
      failing ? route.fulfill({ status: 503, body: "" }) : route.continue(),
    );
    const props = await openProps(page, server.url, { editable: false });
    const label = props.getByRole("textbox", { name: "label" });
    await expect(props.getByText("Editing could not start.")).toBeVisible();
    await expect(label).not.toBeEditable();
    failing = false;
    await props.getByRole("button", { name: "Try again" }).click();
    await expect(label).toBeEditable();
    await expect(props.getByText("Editing could not start.")).toHaveCount(0);
  } finally {
    await closeServe(page, server);
  }
});

test("a failed render keeps the last valid preview, and Try again renders the edit", async ({
  page,
  allowBrowserError,
}) => {
  const server = await serveLiveCatalogue();
  try {
    allowBrowserError(
      responseFailure(server.url, "/mokly-viewer/components/render", 422),
    );
    const props = await openProps(page, server.url);
    const label = props.getByRole("textbox", { name: "label" });
    await label.fill("First");
    await expect
      .poll(() => frameTexts(page))
      .toEqual([
        expect.stringContaining("First 1"),
        expect.stringContaining("First 1"),
      ]);
    let failing = true;
    await page.route("**/mokly-viewer/components/render", (route) =>
      failing
        ? route.fulfill({
            status: 422,
            contentType: "application/json",
            body: JSON.stringify({ code: "render-failed", message: "failed" }),
          })
        : route.continue(),
    );
    await label.fill("Second");
    await expect(
      props.getByText("The preview could not be updated"),
    ).toBeVisible();
    expect(await frameTexts(page)).toEqual([
      expect.stringContaining("First 1"),
      expect.stringContaining("First 1"),
    ]);
    await expect(label).toHaveValue("Second");
    failing = false;
    await props.getByRole("button", { name: "Try again" }).click();
    await expect
      .poll(() => frameTexts(page))
      .toEqual([
        expect.stringContaining("Second 1"),
        expect.stringContaining("Second 1"),
      ]);
    await expect(
      props.getByText("The preview could not be updated"),
    ).toHaveCount(0);
  } finally {
    await closeServe(page, server);
  }
});

test("a newer edit aborts the held render, and both frames show the newest text", async ({
  page,
}) => {
  const server = await serveLiveCatalogue();
  try {
    const props = await openProps(page, server.url);
    const label = props.getByRole("textbox", { name: "label" });
    const held: Route[] = [];
    await page.route("**/mokly-viewer/components/render", (route) => {
      if (renderBody(route.request()).label === "Hang") held.push(route);
      else void route.continue();
    });
    const aborted: unknown[] = [];
    page.on("requestfailed", (request) => {
      if (isRender(request)) aborted.push(renderBody(request).label);
    });
    await label.fill("Hang");
    await expect.poll(() => held.length).toBe(2);
    await label.fill("Newest");
    await expect.poll(() => aborted).toEqual(["Hang", "Hang"]);
    await expect
      .poll(() => frameTexts(page))
      .toEqual([
        expect.stringContaining("Newest 1"),
        expect.stringContaining("Newest 1"),
      ]);
    await expect(label).toHaveValue("Newest");
  } finally {
    await closeServe(page, server);
  }
});
