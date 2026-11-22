import { type Page, expect } from "@playwright/test";

/**
 * The first shadow layer that each focus glow of
 * docs/protocol/cloud/site-design.md computes to in the page's scheme: the
 * glow of the signal ink outside and inside a control, and the glow of the
 * signal inside the code panel.
 */
export async function focusGlows(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const glow = (role: string) =>
      `color-mix(in srgb, var(--mk-color-${role}) 75%, transparent)`;
    const probe = document.createElement("span");
    document.body.append(probe);
    const layers = [
      `0 0 0 4px ${glow("signal-deep")}`,
      `inset 0 0 0 4px ${glow("signal-deep")}`,
      `inset 0 0 0 4px ${glow("signal")}`,
    ].map((layer) => {
      probe.style.boxShadow = layer;
      return getComputedStyle(probe).boxShadow;
    });
    probe.remove();
    return layers;
  });
}

/**
 * Every control that takes focus shows a focus glow on the box that draws
 * it, a hidden radio on its segment, and keeps a 2px system outline in
 * forced colours. One press of Tab gives the page keyboard focus first, so
 * each control that the walk focuses next matches :focus-visible, as it does
 * from the keyboard. A frame, such as the view of an HTML sample, holds the
 * focus in its own document, so it matches neither :focus nor :focus-visible,
 * and the box around it draws its focus.
 */
async function assertFocusGlow(page: Page): Promise<void> {
  const glows = await focusGlows(page);
  // Two islands show controls once the browser is idle: Copy in each code
  // panel's head and the controls of each HTML sample. Wait for them, so the
  // walk checks them too.
  await expect(page.locator(".site-code-copy")).toHaveCount(
    await page.locator(".site-code-copy-slot").count(),
  );
  await expect(
    page.locator(".site-docs-sample:not([data-sample-ready])"),
  ).toHaveCount(0);
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus-visible")).toHaveCount(1);
  for (const forced of [false, true]) {
    await page.emulateMedia({ forcedColors: forced ? "active" : "none" });
    const { checked, misses } = await page.evaluate(
      ({ forced, glows }) => {
        const misses: string[] = [];
        let checked = 0;
        const controls = document.querySelectorAll<HTMLElement>(
          "a[href], button, input, select, textarea, summary, iframe, [tabindex]",
        );
        /** Whether a box's own style draws the focus of this mode. */
        const draws = (node: Element): boolean => {
          const style = getComputedStyle(node);
          if (forced)
            return (
              `${style.outlineStyle} ${style.outlineWidth}` === "solid 2px"
            );
          return glows.some(
            (layer) =>
              style.boxShadow === layer ||
              style.boxShadow.startsWith(`${layer}, `),
          );
        };
        for (const control of controls) {
          if (control.tabIndex < 0 || !control.checkVisibility()) continue;
          control.focus({ preventScroll: true });
          if (document.activeElement !== control) continue;
          checked++;
          const name = control.outerHTML.slice(0, 120);
          const frame = control instanceof HTMLIFrameElement;
          const hidden = control.getBoundingClientRect().width <= 1;
          let host: Element = (hidden && control.closest("label")) || control;
          if (frame) {
            let node = control.parentElement;
            while (node && !draws(node)) node = node.parentElement;
            host = node ?? control;
          }
          for (const animation of host.getAnimations()) animation.finish();
          const style = getComputedStyle(host);
          const outline = `${style.outlineStyle} ${style.outlineWidth}`;
          const glow = !forced && draws(host);
          if (!frame && !control.matches(":focus-visible"))
            misses.push(`${name}: no visible focus`);
          else if (forced && outline !== "solid 2px")
            misses.push(`${name}: outline ${outline}`);
          else if (!forced && (!glow || style.outlineStyle !== "none"))
            misses.push(`${name}: ${style.boxShadow}; outline ${outline}`);
        }
        (document.activeElement as HTMLElement | null)?.blur();
        return { checked, misses };
      },
      { forced, glows },
    );
    // The shared chrome alone holds more controls: the skip link, the two
    // brands, the header's controls, the eight footer links and two radios.
    expect(checked).toBeGreaterThan(12);
    expect(misses).toEqual([]);
  }
  await page.emulateMedia({ forcedColors: "none" });
}

/** Deterministic accessibility checks shared by every published route. */
export async function assertAccessibility(page: Page): Promise<void> {
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.locator("html")).toHaveAttribute("lang", /\S+/);
  await expect(
    page.locator('img:not([alt]):not([aria-hidden="true"])'),
  ).toHaveCount(0);
  for (const role of ["button", "link"] as const) {
    await expect(page.getByRole(role, { name: /^\s*$/ })).toHaveCount(0);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await assertFocusGlow(page);
}
