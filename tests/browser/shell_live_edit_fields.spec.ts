/**
 * Live prop edits field by field in Serve, under the component controls
 * contract and its design: a number outside its bounds keeps the last valid
 * preview, focus stays in an edited field, a select edit renders at once, and
 * a negative zero keeps its sign through the render.
 */

import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import { frameText, openProps, renders } from "./live_props.js";
import {
  cardFile,
  closeServe,
  isRender,
  serveLiveCatalogue,
} from "./live_shell_fixture.js";

/** The card with a whole count from 0 to 24. */
const BOUNDED = cardFile().replace(
  "count: {type: number}",
  "count: {type: integer, minimum: 0, maximum: 24}",
);

/** The card with a count from 0 to 24 and an optional tone that a select edits. */
const TONED = cardFile()
  .replace(
    "count: {type: number}",
    "count: {type: number, minimum: 0, maximum: 24}, tone: {enum: [plain, bold]}",
  )
  .replace(
    "props: {label: Hello, count: 1, active: false}",
    "props: {label: Hello, count: 1, active: false, tone: plain}",
  )
  .replace(
    '<span class="count">{{count}}</span>',
    '<span class="count">{{count}}</span> <span class="tone">{{tone}}</span>',
  );

test("a number outside its bounds marks the field and keeps the last valid preview", async ({
  page,
}) => {
  const server = await serveLiveCatalogue({
    files: { "specs/card.component.html": BOUNDED },
  });
  try {
    const props = await openProps(page, server.url, {
      query: "?viewport=desktop",
    });
    const sent = renders(page);
    const label = props.getByRole("textbox", { name: "label" });
    const count = props.locator('[data-prop-control="count"]');
    await expect(count).toHaveAccessibleDescription("0–24");
    // A valid edit renders, and focus stays in its field.
    await label.fill("Valid");
    await expect
      .poll(() => frameText(page, "desktop"))
      .toMatch(/^Valid 1\s*$/u);
    await expect(label).toBeFocused();

    await count.fill("30");
    await expect(count).toHaveAttribute("aria-invalid", "true");
    await expect(count).toHaveAccessibleDescription(
      "Enter a number from 0 to 24.",
    );
    await expect(props.getByRole("alert")).toHaveText(
      "Check the highlighted values. The preview shows the last valid props.",
    );
    // A boolean edit renders at once, but not while another value is invalid.
    await props.locator('[data-prop-control="active"]').check();
    await count.fill("2.5");
    await expect(count).toHaveAccessibleDescription(
      "Enter a whole number from 0 to 24.",
    );
    // The preview keeps the last valid values: the edited label.
    await expect
      .poll(() => frameText(page, "desktop"))
      .toMatch(/^Valid 1\s*$/u);

    await count.fill("7");
    await expect(count).not.toHaveAttribute("aria-invalid");
    await expect(count).toHaveAccessibleDescription("0–24");
    await expect(props.getByRole("alert")).toHaveCount(0);
    await expect
      .poll(() => frameText(page, "desktop"))
      .toMatch(/^Valid 7Active/u);
    // Every render that the edits sent carried only valid values.
    const validLabel = { kind: "set", value: "Valid" };
    const valid = [
      { label: validLabel },
      {
        label: validLabel,
        active: { kind: "set", value: true },
        count: { kind: "set", value: 7 },
      },
    ];
    expect(sent.length).toBeGreaterThan(1);
    for (const request of sent)
      expect(valid).toContainEqual(request.postDataJSON().overrides);
  } finally {
    await closeServe(page, server);
  }
});

test("a select edit renders at once, and a negative zero keeps its sign", async ({
  page,
}) => {
  const server = await serveLiveCatalogue({
    files: { "specs/card.component.html": TONED },
  });
  try {
    const props = await openProps(page, server.url, {
      query: "?viewport=desktop",
    });
    await props
      .locator('[data-prop-control="tone"]')
      .selectOption({ label: "bold" });
    await expect
      .poll(() => frameText(page, "desktop"))
      .toMatch(/^Hello 1 bold\s*$/u);

    const count = props.locator('[data-prop-control="count"]');
    const rendered = page.waitForResponse(
      (response) =>
        isRender(response.request()) &&
        (response.request().postData() ?? "").includes('"count"'),
    );
    await count.fill("-0");
    const response = await rendered;
    // The shell sends the sign, and Serve's validated props keep it.
    expect(response.request().postData()).toContain(
      '"count":{"kind":"set","value":-0}',
    );
    expect(response.status()).toBe(200);
    expect(((await response.json()) as { props: object }).props).toMatchObject({
      count: ["number", "-0"],
    });
    // An HTML template writes the number as JavaScript does, so it shows 0.
    await expect
      .poll(() => frameText(page, "desktop"))
      .toMatch(/^Hello 0 bold\s*$/u);
    await expect(count).toHaveValue("-0");
  } finally {
    await closeServe(page, server);
  }
});
