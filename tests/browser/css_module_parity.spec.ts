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

test("@scope with to-names styles only content before the limit", async ({
  page,
}) => {
  const css = "@scope (.button) to (.footer){.target{color:rgb(210, 0, 0)}}";
  const plain = await styleFixture(css);
  const module = await styleFixture(css, { module: true });
  try {
    const plainOutput = (
      await compileCatalogue(await loadConfig(plain.root))
    ).outputs.get(entryStyle) as string;
    const moduleOutput = (
      await compileCatalogue(await loadConfig(module.root))
    ).outputs.get(entryStyle) as string;
    const name = (local: string) =>
      new RegExp(`\\.(mokly_[a-f0-9]{12}_${local})\\b`).exec(moduleOutput)?.[1];
    const button = name("button");
    const footer = name("footer");
    const target = name("target");
    expect(button && footer && target).toBeTruthy();
    await page.setContent(`<style>${plainOutput}</style><style>${moduleOutput}</style>
      <div class="button"><span id="plain-inside" class="target">Inside</span><div class="footer"><span id="plain-limit" class="target">Limit</span></div></div><span id="plain-outside" class="target">Outside</span>
      <div class="${button}"><span id="module-inside" class="${target}">Inside</span><div class="${footer}"><span id="module-limit" class="${target}">Limit</span></div></div><span id="module-outside" class="${target}">Outside</span>`);
    const colors = await page.evaluate(() =>
      Object.fromEntries(
        [
          "plain-inside",
          "plain-limit",
          "plain-outside",
          "module-inside",
          "module-limit",
          "module-outside",
        ].map((id) => [
          id,
          getComputedStyle(document.getElementById(id)!).color,
        ]),
      ),
    );
    expect(colors["plain-inside"]).toBe("rgb(210, 0, 0)");
    expect(colors["module-inside"]).toBe(colors["plain-inside"]);
    expect(colors["module-limit"]).toBe(colors["plain-limit"]);
    expect(colors["module-outside"]).toBe(colors["plain-outside"]);
    expect(colors["plain-limit"]).not.toBe(colors["plain-inside"]);
  } finally {
    await Promise.all([removeFixture(plain), removeFixture(module)]);
  }
});
