/** Reversible edits with visible effects in one screen, component, and stylesheet. */
import fs from "node:fs/promises";
import path from "node:path";

import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { firstScreen } from "./changes.js";
import type { PreparedFixture } from "./setup.js";

export async function fixtureEdits(
  fixture: PreparedFixture,
  timeoutMs = 60_000,
) {
  const html = fixture.variant === "html";
  const definitions = [
    {
      kind: "screen",
      file: html ? `specs/${firstScreen}.screen.html` : "src/screens.tsx",
      before: html ? "<h1>Activity 1</h1>" : "<h1>Activity {index + 1}</h1>",
      after: html
        ? "<h1>Benchmark screen</h1>"
        : '<h1>{area === "area-1" && index === 0 ? "Benchmark screen" : `Activity ${index + 1}`}</h1>',
      target: firstScreen,
      async verify(page: Page, edited: boolean) {
        await expect(
          page.frameLocator('[data-workspace-frame="desktop"]').locator("h1"),
        ).toHaveText(edited ? "Benchmark screen" : "Activity 1", {
          timeout: timeoutMs,
        });
      },
    },
    {
      kind: "component",
      file: html
        ? "specs/area-1/components/action.component.html"
        : "src/components.tsx",
      before: html ? ">{{label}}</button>" : "{props.label}",
      after: html
        ? ">{{label}} benchmark</button>"
        : '{props.label}{area === "area-1" ? " benchmark" : ""}',
      target: "area-1/components/action",
      async verify(page: Page, edited: boolean) {
        await expect(
          page
            .frameLocator('[data-workspace-frame="desktop"]')
            .getByRole("button", {
              name: edited ? "New record benchmark" : "New record",
              exact: true,
            }),
        ).toBeVisible({ timeout: timeoutMs });
      },
    },
    {
      kind: "stylesheet",
      file: "assets/catalogue.css",
      before: "",
      after: ".scale-screen { border-top: 7px solid rgb(4, 5, 6); }\n",
      target: firstScreen,
      async verify(page: Page, edited: boolean) {
        await expect(
          page
            .frameLocator('[data-workspace-frame="desktop"]')
            .locator(".scale-screen"),
        ).toHaveCSS("border-top-width", edited ? "7px" : "0px", {
          timeout: timeoutMs,
        });
      },
    },
  ] as const;
  return Promise.all(
    definitions.map(async (definition) => {
      const file = path.join(fixture.root, definition.file);
      const original = await fs.readFile(file, "utf8");
      const changed = definition.before
        ? original.replace(definition.before, definition.after)
        : original + definition.after;
      if (changed === original)
        throw new Error(`No edit target in ${definition.file}`);
      return { ...definition, file, original, changed };
    }),
  );
}

/** Restore the exact original bytes even when browser verification fails. */
export async function withFixtureEdit<T>(
  edit: { file: string; original: string; changed: string },
  measure: () => Promise<T>,
): Promise<T> {
  try {
    await fs.writeFile(edit.file, edit.changed);
    return await measure();
  } finally {
    await fs.writeFile(edit.file, edit.original);
  }
}
