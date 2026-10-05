import { expect, test, type Locator, type Page } from "@playwright/test";

import { documentTemplate } from "../../dist/documents/template.js";

/** The design's Payment terms document, as the Markdown renderer emits it. */
const body = `<h1 id="payment-terms">Payment terms</h1>
<p>When an invoice is due, and what a customer sees once it is late.</p>
<h2 id="due-dates">Due dates</h2>
<p>Every invoice is due 30 days after it is issued, and invoice numbers keep the form <code>INV-1042</code>.</p>
<h2 id="overdue-invoices">Overdue invoices</h2>
<p>An overdue invoice shows a reminder, as the <a href="#overdue-invoices">overdue invoice</a> shows.</p>
<table><thead><tr><th>Days overdue</th><th>Reminder</th></tr></thead>
<tbody><tr><td>1</td><td>Reminder email</td></tr><tr><td>7</td><td>Second email</td></tr></tbody></table>
<h2 id="payment-methods">Payment methods</h2>
<ul><li>Card</li><li>Bank transfer</li></ul>`;

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
        return Object.fromEntries(
          names.map((name) => [
            name,
            style.getPropertyValue(
              name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
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
  await page.setContent(documentTemplate("Payment terms", body, "light"));
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
    const rendered = await templateParts(await browser.newPage(), width);
    expect(rendered).toEqual(design);
    expect(design.tableFillsMeasure).toBe(true);
  });
