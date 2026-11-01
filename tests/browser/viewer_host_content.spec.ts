import { expect } from "@playwright/test";

import { viewerFixture } from "../../packages/viewer/tests/browser_fixture.js";

import { test } from "./browser_test.js";

import type {} from "./viewer_harness.js";

let fixture: Awaited<ReturnType<typeof viewerFixture>>;

test.beforeAll(async () => {
  fixture = await viewerFixture();
});

test.afterAll(async () => {
  await fixture?.close();
});

/**
 * Host markup: ordinary elements, and class names that package rules also
 * use, such as the device chrome's `address` and `browser-frame`.
 */
const HOST_MARKUP =
  '<div class="host-content" data-host-content=""><a class="address" href="#host">Host link</a><p class="flow-step-head">Host text</p><h2 class="mb-pane">Host title</h2><span class="browser-frame lights"><i>Host i</i></span><button class="browser-expand" type="button">Host button</button><input aria-label="Host field"><iframe title="Host frame"></iframe></div>';

test("no viewer rule matches the host page or host slot content", async ({
  page,
}) => {
  await page.goto(fixture.host.url);
  await page.waitForFunction(() => Boolean(window.viewerHarness));
  await page.evaluate((markup) => {
    document.body.insertAdjacentHTML("afterbegin", markup);
    window.viewerHarness.start("one", { slots: true });
  }, HOST_MARKUP);
  const root = page.locator("#one .mbk[data-mokly-shell]");
  await expect(root).toBeVisible();
  await page.evaluate((markup) => {
    for (const slot of document.querySelectorAll("#one [data-mokly-slot]"))
      slot.insertAdjacentHTML("beforeend", markup);
  }, HOST_MARKUP);
  // The browser's own styles stay on host content in a Light root: a host
  // link keeps the link colour, and a host paragraph keeps its margin.
  const link = page.locator('#one [data-mokly-slot="sidePanel"] a.address');
  await expect(link).toHaveCSS("color", "rgb(0, 0, 238)");
  await expect(link).toHaveCSS("box-sizing", "content-box");
  await expect(
    page.locator('#one [data-mokly-slot="sidePanel"] p.flow-step-head'),
  ).not.toHaveCSS("margin-top", "0px");
  await page.evaluate(() => {
    // Every mark of the root at once, so a rule that applies only while one
    // holds also meets the host content.
    const shell = document.querySelector("#one .mbk[data-mokly-shell]")!;
    shell.classList.add(
      "frame-expanded",
      "mbk-nav-resizing",
      "mbk-inspector-resizing",
    );
    shell.setAttribute("data-mokly-theme", "dark");
    shell.setAttribute("data-mokly-color-scheme", "dark");
    shell.setAttribute("data-drawer", "open");
  });
  const report = await page.evaluate(() => {
    const sheet = [...document.styleSheets].find((candidate) =>
      candidate.href?.endsWith("/viewer.css"),
    )!;
    const rules: CSSStyleRule[] = [];
    const collect = (list: CSSRuleList) => {
      for (const rule of list)
        if (rule instanceof CSSStyleRule) rules.push(rule);
        else if ("cssRules" in rule) collect(rule.cssRules as CSSRuleList);
    };
    collect(sheet.cssRules);
    // A rule of a pseudo-element styles its originating element's content.
    const subjects = rules.map((rule) =>
      rule.selectorText.replace(/::[\w-]+(?:\([^)]*\))?/gu, ""),
    );
    const host = [
      ...document.querySelectorAll(
        "[data-host-content], [data-host-content] *, [data-mokly-slot] > :not([data-host-content])",
      ),
    ];
    const matches: string[] = [];
    for (const element of host)
      subjects.forEach((subject, index) => {
        if (subject.trim() && element.matches(subject))
          matches.push(
            `${element.outerHTML.slice(0, 60)} <- ${rules[index]!.selectorText}`,
          );
      });
    return {
      rules: rules.length,
      checked: host.length,
      slotted: document.querySelectorAll(
        "#one [data-mokly-slot] [data-host-content]",
      ).length,
      matches,
    };
  });
  expect(report.rules).toBeGreaterThan(400);
  expect(report.slotted).toBe(8);
  expect(report.checked).toBeGreaterThan(80);
  expect(report.matches).toEqual([]);
});
