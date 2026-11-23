import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

import { SharedUiThemeProvider } from "@firna/ui/theme";
import { paletteUiTheme } from "@mokly-cloud/tokens/shared-ui-theme";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { ActionProps } from "../components/action";

// Expo Router cannot load outside its runtime, so the router resolves to the
// press doubles. The package Button stays the real one, because the content
// is drawn inside it. The hook belongs to this file's own test process.
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

/** Parts in two faces: a reference in mono beside its state's phrase. */
const parts = createElement(
  "span",
  { className: "test-parts" },
  createElement("code", null, "main"),
  createElement("span", null, "Ready · 15 Sep"),
);

/** The package's own label text, which a Button with content does not draw. */
function packageLabels(html: string): string[] {
  return [
    ...html.matchAll(/<div [^>]*class="firna-text"[^>]*>([^<]*)<\/div>/g),
  ].map((match) => match[1] ?? "");
}

test("content draws inside one Button, in place of its label, and the label names it", async () => {
  const html = await drawn({
    label: "main, Ready · 15 Sep",
    tone: "quiet",
    size: "sm",
    content: parts,
    onPress: () => {},
  });
  assert.equal([...html.matchAll(/<button\b/g)].length, 1);
  assert.match(html, /<button[^>]*aria-label="main, Ready · 15 Sep"/);
  assert.match(
    html,
    /<button[^>]*><span class="test-parts"><code>main<\/code><span>Ready · 15 Sep<\/span><\/span><\/button>/,
  );
  assert.deepEqual(packageLabels(html), []);
});

test("a caller's accessible name names an Action with content", async () => {
  const html = await drawn({
    label: "main",
    accessibilityLabel: "main, Ready · 15 Sep",
    tone: "quiet",
    size: "sm",
    content: parts,
    onPress: () => {},
  });
  assert.match(html, /<button[^>]*aria-label="main, Ready · 15 Sep"/);
  assert.ok(html.includes('<span class="test-parts">'));
});

test("content takes the place of the lead, the icon and the chevron", async () => {
  const html = await drawn({
    label: "main",
    lead: "Mokly Team",
    icon: "history",
    chevron: true,
    tone: "quiet",
    size: "sm",
    content: parts,
    onPress: () => {},
  });
  assert.match(html, /<button[^>]*aria-label="main"/);
  assert.doesNotMatch(html, /Mokly Team|<svg\b/);
});

test("the icon-only form and a working word take the place of content", async () => {
  const glyph = await drawn({
    label: "History",
    icon: "history",
    iconOnly: true,
    tone: "quiet",
    size: "sm",
    content: parts,
    onPress: () => {},
  });
  assert.doesNotMatch(glyph, /test-parts/);
  assert.match(glyph, /<button[^>]*aria-label="History"/);
  const busy = await drawn({
    label: "Publishing",
    tone: "secondary",
    size: "sm",
    content: parts,
    write: { working: true, sendable: true },
    operation: "Publishing this branch",
    onPress: () => {},
  });
  assert.doesNotMatch(busy, /test-parts/);
  assert.deepEqual(packageLabels(busy), ["Publishing"]);
});
