/**
 * The compare modes of the right panel's Changes tab, the band, read through
 * its hooks: the `Comparison mode` group of mode tiles, the `Scroll together`
 * switch, whose label draws its track, and Refresh. The Scroll together specs
 * read the band's geometry, the order of its controls and the drawn state of
 * the switch, whose knob a translation carries to the far end when it is on.
 */

import type { Locator, Page } from "@playwright/test";

/** A rectangle on the page. */
export type Box = { bottom: number; left: number; right: number; top: number };

/** The band's Refresh. */
export function refreshButton(page: Page): Locator {
  return page.getByRole("button", { name: "Refresh comparison", exact: true });
}

/**
 * Geometry and drawn state of the band's controls: the band's content
 * edges, the box of the modes, of the switch's label and of Refresh, the
 * palette tokens that draw them, and the switch's track and knob. `order`
 * names the visible controls, `modes`, `switch` and `refresh`, in the
 * band's order.
 */
export function bandFacts(page: Page) {
  return page
    .getByRole("group", { name: "Comparison mode" })
    .evaluate((modes) => {
      const toolbar = modes.parentElement!;
      const control = toolbar
        .querySelector('[role="switch"]')!
        .closest("label")!;
      const track = control.querySelector('[aria-hidden="true"]')!;
      const button = toolbar.querySelector("[data-diff-refresh]")!;
      const box = (element: Element): Box => {
        const rect = element.getBoundingClientRect();
        return {
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          top: rect.top,
        };
      };
      const style = getComputedStyle(toolbar);
      const knob = getComputedStyle(track, "::after");
      // The knob's drawn place: its offset and the translation that carries
      // it to the far end of the track.
      const knobLeft =
        parseFloat(knob.left) + new DOMMatrixReadOnly(knob.transform).m41;
      const token = (name: string) => {
        const probe = document.createElement("span");
        probe.style.color = `var(${name})`;
        toolbar.append(probe);
        const colour = getComputedStyle(probe).color;
        probe.remove();
        return colour;
      };
      /** A focus glow of the reset class, as a shadow of a probe. */
      const glow = (name: string) => {
        const probe = document.createElement("span");
        probe.className = "mbk-reset";
        probe.style.boxShadow = `var(${name})`;
        toolbar.append(probe);
        const shadow = getComputedStyle(probe).boxShadow;
        probe.remove();
        return shadow;
      };
      const names = new Map<Element, string>([
        [modes, "modes"],
        [control, "switch"],
        [button, "refresh"],
      ]);
      return {
        content: {
          left:
            toolbar.getBoundingClientRect().left +
            parseFloat(style.paddingLeft),
          right:
            toolbar.getBoundingClientRect().right -
            parseFloat(style.paddingRight),
        },
        control: box(control),
        label: control.textContent,
        modes: box(modes),
        order: [...names.keys()]
          .filter((element) => element.getClientRects().length > 0)
          .sort((one, other) =>
            one.compareDocumentPosition(other) &
            Node.DOCUMENT_POSITION_FOLLOWING
              ? -1
              : 1,
          )
          .map((element) => names.get(element)),
        refresh: box(button),
        tokens: {
          accent: token("--mbk-accent-deep"),
          edge: token("--chrome-control-edge"),
          glow: glow("--mbk-focus-glow"),
          ink: token("--chrome-ink-2"),
          onAccent: token("--_mokly-private-on-accent-deep"),
          surface: token("--chrome-surface"),
        },
        track: {
          background: getComputedStyle(track).backgroundColor,
          border: getComputedStyle(track).borderTopColor,
          height: track.getBoundingClientRect().height,
          knob: {
            colour:
              parseFloat(knob.borderTopWidth) > 0
                ? knob.borderTopColor
                : knob.backgroundColor,
            left: `${knobLeft}px`,
            size: [knob.width, knob.height],
            top: knob.top,
          },
          outline: [
            getComputedStyle(track).outlineStyle,
            getComputedStyle(track).outlineWidth,
            getComputedStyle(track).outlineColor,
            getComputedStyle(track).outlineOffset,
          ],
          shadow: getComputedStyle(track).boxShadow,
          width: track.getBoundingClientRect().width,
        },
        text: {
          colour: getComputedStyle(control).color,
          size: getComputedStyle(control).fontSize,
          weight: getComputedStyle(control).fontWeight,
        },
      };
    });
}
