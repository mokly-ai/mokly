import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import { serveCatalogue } from "./catalogue_fixture.js";

let fixture: Awaited<ReturnType<typeof serveCatalogue>>;
test.beforeAll(async () => {
  fixture = await serveCatalogue(
    {
      "specs/module.mockup.tsx": `import React from "react";
import {defineScreen} from "@mokly/mokly";
import styles from "./theme.module.css";
export default defineScreen({title: "Module", description: "", relatedDocs: [], props: {}, render: () => <main>
<button className={styles.button}>Button</button><section className={styles.scope}><p className={styles.target}>Inside</p><div className={styles.limit}><p className={styles.target}>Limited</p></div></section>
<div className={styles["a+b"]}>Plus</div><div className={styles["hover:state"]}>Colon</div><div className={styles["café"]}>Unicode</div>
</main>});`,
      "specs/plain.screen.html": `---
title: Plain
---
<main><button class="plain-button">Button</button><section class="plain-scope"><p class="plain-target">Inside</p><div class="plain-limit"><p class="plain-target">Limited</p></div></section></main>`,
      "specs/theme.module.css": `.button {color: rgb(10, 20, 30); border-radius: 9px; padding: 12px}
@scope (.scope) to (.limit) { .target {color: rgb(60, 70, 80)} }
.a\\+b {color: rgb(11, 22, 33)}
.hover\\:state {color: rgb(44, 55, 66)}
.café {color: rgb(77, 88, 99)}`,
      "plain.css": `.plain-button {color: rgb(10, 20, 30); border-radius: 9px; padding: 12px}
@scope (.plain-scope) to (.plain-limit) { .plain-target {color: rgb(60, 70, 80)} }`,
    },
    { stylesheets: [{ match: "plain/**", stylesheets: ["plain.css"] }] },
  );
});
test.afterAll(async () => fixture?.close());

test("plain and module CSS compute the same browser styles", async ({
  page,
}) => {
  const styles = [];
  for (const entry of ["plain", "module"]) {
    await page.goto(
      `${fixture.url}/static/mokly-generated/${entry}/index.mobile.html`,
    );
    styles.push(
      await page.getByRole("button", { name: "Button" }).evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          color: style.color,
          padding: style.padding,
          radius: style.borderRadius,
        };
      }),
    );
  }
  expect(styles[0]).toEqual({
    color: "rgb(10, 20, 30)",
    padding: "12px",
    radius: "9px",
  });
  expect(styles[1]).toEqual(styles[0]);
});

test("@scope with to-names styles only content before the limit", async ({
  page,
}) => {
  await page.goto(
    `${fixture.url}/static/mokly-generated/module/index.mobile.html`,
  );
  await expect(page.getByText("Inside", { exact: true })).toHaveCSS(
    "color",
    "rgb(60, 70, 80)",
  );
  await expect(page.getByText("Limited", { exact: true })).not.toHaveCSS(
    "color",
    "rgb(60, 70, 80)",
  );
});

test("scoped escaped CSS names keep Chrome selector meaning", async ({
  page,
}) => {
  await page.goto(
    `${fixture.url}/static/mokly-generated/module/index.mobile.html`,
  );
  for (const [label, color] of [
    ["Plus", "rgb(11, 22, 33)"],
    ["Colon", "rgb(44, 55, 66)"],
    ["Unicode", "rgb(77, 88, 99)"],
  ])
    await expect(page.getByText(label!, { exact: true })).toHaveCSS(
      "color",
      color!,
    );
});
