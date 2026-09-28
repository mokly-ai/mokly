import { expect, test } from "@playwright/test";

import { compileCatalogue } from "../../dist/build/compile.js";
import { loadConfig } from "../../dist/config/load.js";
import { removeFixture } from "../helpers/fixture.js";
import {
  entryStyle,
  styleFixture,
} from "../helpers/imported_styles_fixture.js";

const css = `
.x {
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

test("plain and module CSS compute the same browser styles", async ({
  page,
}) => {
  const plain = await styleFixture(css);
  const module = await styleFixture(css, { module: true });
  try {
    const plainOutput = (
      await compileCatalogue(await loadConfig(plain.root))
    ).outputs.get(entryStyle) as string;
    const moduleOutput = (
      await compileCatalogue(await loadConfig(module.root))
    ).outputs.get(entryStyle) as string;
    const scoped = /\.(mokly_[A-Za-z0-9_-]+_x)\b/.exec(moduleOutput)?.[1];
    const child = /\.(mokly_[A-Za-z0-9_-]+_child)\b/.exec(moduleOutput)?.[1];
    expect(scoped).toBeTruthy();
    expect(child).toBeTruthy();
    await page.setViewportSize({ width: 900, height: 700 });
    await page.setContent(`
      <style>${plainOutput}</style><style>${moduleOutput}</style>
      <div dir="rtl" lang="en" style="color-scheme: light dark">
        <div id="plain" class="x"><span class="child">Text</span></div>
        <div id="module" class="${scoped}"><span class="${child}">Text</span></div>
      </div>
    `);
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      const computed = await page.evaluate(() => {
        const read = (id: string) => {
          const element = document.getElementById(id)!;
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
            childStyle: getComputedStyle(element.querySelector("span")!)
              .fontStyle,
          };
        };
        return { plain: read("plain"), module: read("module") };
      });
      expect(computed.module, colorScheme).toEqual(computed.plain);
    }
  } finally {
    await Promise.all([removeFixture(plain), removeFixture(module)]);
  }
});
