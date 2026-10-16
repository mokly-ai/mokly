import { expect, type Locator, type Page } from "@playwright/test";

import { test } from "./browser_test.js";
import { serveCatalogue } from "./catalogue_fixture.js";

let fixture: Awaited<ReturnType<typeof serveCatalogue>>;
test.beforeAll(async () => {
  fixture = await serveCatalogue({
    "specs/payment.md": `---
title: Payment terms
---
# Payment terms

When an invoice is due, and what a customer sees once it is late.

## Due dates

Every invoice is due 30 days after it is issued, and invoice numbers keep the form \`INV-1042\`.

## Overdue invoices

An overdue invoice shows a reminder, as the [overdue invoice](#overdue-invoices) shows.

| Days overdue | Reminder |
| --- | --- |
| 1 | Reminder email |
| 7 | Second email |

## Payment methods

- Card
- Bank transfer
`,
  });
});
test.afterAll(async () => fixture?.close());

/** Computed properties compared for each depicted part of a document. */
const PROPERTIES = {
  body: [
    "fontSize",
    "lineHeight",
    "fontFamily",
    "color",
    "backgroundColor",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
  ],
  measure: ["maxWidth"],
  h1: [
    "fontSize",
    "fontWeight",
    "lineHeight",
    "letterSpacing",
    "marginTop",
    "marginBottom",
  ],
  h2: [
    "fontSize",
    "fontWeight",
    "lineHeight",
    "letterSpacing",
    "marginTop",
    "marginBottom",
  ],
  p: ["fontSize", "lineHeight", "marginTop", "marginBottom"],
  link: [
    "color",
    "fontWeight",
    "textDecorationLine",
    "textDecorationThickness",
    "textUnderlineOffset",
  ],
  code: [
    "fontSize",
    "fontFamily",
    "paddingTop",
    "paddingLeft",
    "borderTopWidth",
    "borderTopColor",
    "borderTopLeftRadius",
    "backgroundColor",
  ],
  table: ["fontSize", "borderCollapse", "marginBottom"],
  th: [
    "fontWeight",
    "paddingTop",
    "paddingLeft",
    "backgroundColor",
    "borderTopWidth",
    "borderTopColor",
    "textAlign",
    "verticalAlign",
  ],
  td: ["paddingTop", "paddingLeft", "borderTopColor", "textAlign"],
  ul: ["paddingLeft", "marginTop", "marginBottom"],
  secondItem: ["marginTop"],
} as const;

type Part = keyof typeof PROPERTIES;

const DESIGN: Record<Part, string> = {
  body: ".mbk-markdown",
  measure: ".mbk-markdown-body",
  h1: ".mbk-markdown h1",
  h2: ".mbk-markdown h2",
  p: ".mbk-markdown p",
  link: ".mbk-markdown .mbk-markdown-link",
  code: ".mbk-markdown code",
  table: ".mbk-markdown table",
  th: ".mbk-markdown th",
  td: ".mbk-markdown td",
  ul: ".mbk-markdown ul",
  secondItem: ".mbk-markdown li + li",
};

const TEMPLATE: Record<Part, string> = {
  body: "body",
  measure: "main",
  h1: "h1",
  h2: "h2",
  p: "p",
  link: "a",
  code: "code",
  table: "table",
  th: "th",
  td: "td",
  ul: "ul",
  secondItem: "li + li",
};

/** Read every compared property, and whether the table fills its measure. */
function computedParts(root: Locator, selectors: Record<Part, string>) {
  return root.evaluate(
    (_element, input) => {
      const read = (selector: string, names: readonly string[]) => {
        const element = document.querySelector(selector);
        if (!element) return `missing ${selector}`;
        const style = getComputedStyle(element);
        let surface = element;
        // Native documents paint the canvas on html; transparent descendants show that same surface.
        while (
          getComputedStyle(surface).backgroundColor === "rgba(0, 0, 0, 0)" &&
          surface.parentElement
        )
          surface = surface.parentElement;
        return Object.fromEntries(
          names.map((name) => [
            name,
            name === "backgroundColor"
              ? getComputedStyle(surface).backgroundColor
              : style.getPropertyValue(
                  name.replace(
                    /[A-Z]/g,
                    (letter) => `-${letter.toLowerCase()}`,
                  ),
                ),
          ]),
        );
      };
      const table = document.querySelector<HTMLElement>(input.selectors.table);
      const parent = table?.parentElement;
      return {
        ...Object.fromEntries(
          Object.entries(input.properties).map(([part, names]) => [
            part,
            read(input.selectors[part as Part], names),
          ]),
        ),
        tableFillsMeasure:
          table && parent
            ? Math.round(table.getBoundingClientRect().width) ===
              Math.round(
                parent.clientWidth -
                  parseFloat(getComputedStyle(parent).paddingLeft) -
                  parseFloat(getComputedStyle(parent).paddingRight),
              )
            : false,
      };
    },
    { properties: PROPERTIES, selectors },
  );
}

async function designParts(page: Page, viewport: "desktop" | "mobile") {
  await page.setViewportSize({ width: 1700, height: 1100 });
  await page.goto(`/view/design/browse/pages/document/?viewport=${viewport}`);
  const frame = page.frameLocator(`.mbk-frame-${viewport} iframe`);
  await expect(frame.locator(".mbk-markdown h1")).toHaveText("Payment terms");
  return computedParts(frame.locator("html"), DESIGN);
}

async function templateParts(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`${fixture.url}/static/mokly-generated/payment/index.html`);
  return computedParts(page.locator("html"), TEMPLATE);
}

for (const [viewport, width] of [
  ["desktop", 1200],
  ["mobile", 390],
] as const)
  test(`${viewport}: rendered documents use the Markdown design's typography`, async ({
    browser,
    page,
  }) => {
    const design = await designParts(page, viewport);
    const preview = await browser.newPage();
    const rendered = await templateParts(preview, width);
    await preview.close();
    expect(rendered).toEqual(design);
    expect(design.tableFillsMeasure).toBe(true);
  });
