import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import { serveCatalogue } from "./catalogue_fixture.js";

const parityCss = `
.x {
  border-inline-start-style: solid;
  position: relative;
  width: -webkit-fill-available; width: -moz-available; width: stretch;
  -webkit-backdrop-filter: blur(2px); backdrop-filter: blur(2px);
  height: 100vh; height: 100dvh;
  top: 0; right: 0; bottom: 0; left: 0;
  background-color: rgba(0, 0, 255, .5);
  & .child { font-style: italic; }
}
.x:dir(rtl) {
  inset-inline-start: 14px;
  color: light-dark(rgb(200, 0, 0), rgb(0, 0, 200));
}
@supports(display: grid) { .x { display: grid; } }
@media(min-width: 600px) { .x { padding-inline-end: 5px; } }
@layer component { .x { border-inline-start-width: 3px; } }
`;

let fixture: Awaited<ReturnType<typeof serveCatalogue>>;
test.beforeAll(async () => {
  fixture = await serveCatalogue(
    {
      "specs/module.mockup.tsx": `import React from "react";
import {defineScreen} from "@mokly/mokly";
import styles from "./theme.module.css";
export default defineScreen({title: "Module", description: "", relatedDocs: [], props: {}, render: () => <main>
<div dir="rtl"><div id="probe" className={styles.x}><span className={styles.child}>Child</span></div></div><button className={styles.button}>Button</button><section className={styles.scope}><p className={styles.target}>Inside</p><div className={styles.limit}><p className={styles.target}>Limited</p></div></section><p className={styles.target}>Outside</p>
<div className={styles["a+b"]}>Plus</div><div className={styles["hover:state"]}>Colon</div><div className={styles["café"]}>Unicode</div>
</main>});`,
      "specs/plain.screen.html": `---
title: Plain
---
<main><div dir="rtl"><div id="probe" class="x"><span class="child">Child</span></div></div><button class="plain-button">Button</button><section class="plain-scope"><p class="plain-target">Inside</p><div class="plain-limit"><p class="plain-target">Limited</p></div></section><p class="plain-target">Outside</p></main>`,
      "specs/theme.module.css":
        parityCss +
        `.button {color: rgb(10, 20, 30); border-radius: 9px; padding: 12px}
@scope (.scope) to (.limit) { .target {color: rgb(60, 70, 80)} }
.a\\+b {color: rgb(11, 22, 33)}
.hover\\:state {color: rgb(44, 55, 66)}
.café {color: rgb(77, 88, 99)}`,
      "plain.css":
        parityCss +
        `.plain-button {color: rgb(10, 20, 30); border-radius: 9px; padding: 12px}
@scope (.plain-scope) to (.plain-limit) { .plain-target {color: rgb(60, 70, 80)} }`,
    },
    {
      colorSchemes: ["light", "dark"],
      stylesheets: [{ match: "plain/**", stylesheets: ["plain.css"] }],
    },
  );
});
test.afterAll(async () => fixture?.close());

for (const scheme of ["light", "dark"] as const)
  test(`plain and module CSS compute the same browser styles in ${scheme} RTL`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 900, height: 700 });
    await page.emulateMedia({ colorScheme: scheme });
    const results = [];
    for (const entry of ["plain", "module"]) {
      await page.goto(
        `${fixture.url}/static/mokly-generated/${entry}/index.mobile${scheme === "dark" ? ".dark" : ""}.html`,
      );
      results.push(
        await page.locator("#probe").evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            color: style.color,
            right: style.right,
            width: style.width,
            height: style.height,
            background: style.backgroundColor,
            backdrop: style.backdropFilter,
            display: style.display,
            paddingInlineEnd: style.paddingInlineEnd,
            borderInlineStartWidth: style.borderInlineStartWidth,
            childStyle: getComputedStyle(element.querySelector("span")!)
              .fontStyle,
          };
        }),
      );
    }
    expect(results[1]).toEqual(results[0]);
    expect(results[0]).toMatchObject({
      color: scheme === "dark" ? "rgb(0, 0, 200)" : "rgb(200, 0, 0)",
      height: "700px",
      backdrop: "blur(2px)",
      display: "grid",
      paddingInlineEnd: "5px",
      borderInlineStartWidth: "3px",
      childStyle: "italic",
    });
  });

test("@scope with to-names styles only content before the limit", async ({
  page,
}) => {
  const colors: string[][] = [];
  for (const entry of ["plain", "module"]) {
    await page.goto(
      `${fixture.url}/static/mokly-generated/${entry}/index.mobile.html`,
    );
    const values = [];
    for (const label of ["Inside", "Limited", "Outside"])
      values.push(
        await page
          .getByText(label, { exact: true })
          .evaluate((node) => getComputedStyle(node).color),
      );
    colors.push(values);
  }
  expect(colors[0]![0]).toBe("rgb(60, 70, 80)");
  expect(colors[1]).toEqual(colors[0]);
  expect(colors[0]![1]).not.toBe(colors[0]![0]);
  expect(colors[0]![2]).not.toBe(colors[0]![0]);
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
