import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

import { SharedUiThemeProvider } from "@firna/ui/theme";
import { paletteUiTheme } from "@mokly-cloud/tokens/shared-ui-theme";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { ActionProps } from "../components/action";

// Expo Router cannot load outside its runtime, so the router resolves to the
// press doubles. The package Button stays the real one, because the lead is
// drawn inside it. The hook belongs to this file's own test process.
const doubles = new URL("./press-doubles.ts", import.meta.url).href;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "expo-router")
      return { url: doubles, shortCircuit: true };
    return next(specifier, context);
  },
});

const theme = paletteUiTheme("light");

/** One Action, drawn under the application's light Canvas theme. */
async function drawn(props: ActionProps): Promise<string> {
  const { Action } = await import("../components/action");
  return renderToStaticMarkup(
    createElement(SharedUiThemeProvider, {
      theme,
      children: createElement(Action, props),
    }),
  );
}

/** A colour as the web runtime writes it inline, from a `#rrggbb` value. */
function inline(hex: string): string {
  const [red, green, blue] = [1, 3, 5].map((at) =>
    Number.parseInt(hex.slice(at, at + 2), 16),
  );
  return `rgba(${red},${green},${blue},1.00)`;
}

/** The inline style of the one text element that holds exactly this text. */
function styleOf(html: string, text: string): string {
  const found = [
    ...html.matchAll(
      /<div dir="auto"[^>]*style="([^"]*)"[^>]*>([^<]*)<\/div>/g,
    ),
  ].filter((match) => match[2] === text);
  assert.equal(found.length, 1, text);
  return found[0]?.[1] ?? "";
}

test("a lead draws before the label in the muted role, inside one Button named by the whole text", async () => {
  const html = await drawn({
    label: "Mokly Cloud",
    lead: "Mokly Team",
    tone: "quiet",
    size: "sm",
    chevron: true,
    singleLine: true,
    onPress: () => {},
  });
  assert.equal([...html.matchAll(/<button\b/g)].length, 1);
  assert.match(html, /<button[^>]*aria-label="Mokly Team \/ Mokly Cloud"/);
  const lead = html.indexOf(">Mokly Team<");
  const slash = html.indexOf("> / <");
  const label = html.indexOf(">Mokly Cloud<");
  assert.ok(lead > 0 && lead < slash && slash < label, "lead, slash, label");
  const muted = inline(theme.colors.muted);
  for (const part of ["Mokly Team", " / "]) {
    const style = styleOf(html, part);
    assert.ok(style.includes("color:" + muted), part + ": " + style);
    assert.ok(style.includes("font-weight:400"), part + ": " + style);
  }
  const labelStyle = styleOf(html, "Mokly Cloud");
  assert.ok(labelStyle.includes("color:" + inline(theme.colors.ink)));
  assert.ok(labelStyle.includes("font-weight:700"), labelStyle);
  // The switcher's chevron follows the label.
  assert.ok(html.indexOf("<svg", label) > label);
});

test("a caller's accessible name stays the control's name", async () => {
  const html = await drawn({
    label: "Mokly Cloud",
    lead: "mokly-team",
    accessibilityLabel: "Mokly Team / Mokly Cloud",
    tone: "quiet",
    size: "sm",
    onPress: () => {},
  });
  assert.match(html, /aria-label="Mokly Team \/ Mokly Cloud"/);
  assert.ok(html.includes(">mokly-team<"));
});

test("an Action without a lead draws the package Button's own label", async () => {
  const html = await drawn({
    label: "Mokly Cloud",
    tone: "quiet",
    size: "sm",
    singleLine: true,
    onPress: () => {},
  });
  const labels = [
    ...html.matchAll(/<div [^>]*dir="auto"[^>]*>([^<]*)<\/div>/g),
  ];
  assert.deepEqual(
    labels.map((match) => match[1]),
    ["Mokly Cloud"],
  );
  assert.ok(labels[0]?.[0].includes('class="firna-text"'));
  assert.doesNotMatch(html, /aria-label=|css-text-| \/ /);
});
