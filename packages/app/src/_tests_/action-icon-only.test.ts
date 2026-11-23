import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

import { SharedUiThemeProvider } from "@firna/ui/theme";
import { paletteUiTheme } from "@mokly-cloud/tokens/shared-ui-theme";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { ActionProps } from "../components/action";

// Expo Router cannot load outside its runtime, so the router resolves to the
// press doubles. The package Button stays the real one, because the icon-only
// form is its own square box. The hook belongs to this file's own process.
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

/** The words of each visible text element the markup draws. */
function words(html: string): string[] {
  return [...html.matchAll(/<div [^>]*dir="auto"[^>]*>([^<]*)<\/div>/g)].map(
    (match) => match[1] ?? "",
  );
}

test("an icon-only Action draws its icon alone, named and titled by its label", async () => {
  const html = await drawn({
    label: "History",
    icon: "history",
    iconOnly: true,
    tone: "quiet",
    size: "sm",
    onPress: () => {},
  });
  assert.equal([...html.matchAll(/<button\b/g)].length, 1);
  assert.equal([...html.matchAll(/<svg\b/g)].length, 1);
  assert.match(html, /<button[^>]*aria-label="History"/);
  assert.deepEqual(words(html), []);
  // The tooltip's holder takes no box, so the control keeps its own place.
  assert.match(html, /<span style="display:contents" title="History"><button/);
});

test("a caller's accessible name names and titles an icon-only Action", async () => {
  const html = await drawn({
    label: "Settings",
    accessibilityLabel: "Workspace settings",
    icon: "settings",
    iconOnly: true,
    tone: "quiet",
    size: "sm",
    onPress: () => {},
  });
  assert.match(html, /<button[^>]*aria-label="Workspace settings"/);
  assert.match(html, /<span [^>]*title="Workspace settings"><button/);
  assert.deepEqual(words(html), []);
});

test("an Action without the form draws its label as before", async () => {
  const plain = await drawn({
    label: "History",
    icon: "history",
    tone: "quiet",
    size: "sm",
    onPress: () => {},
  });
  assert.deepEqual(words(plain), ["History"]);
  assert.doesNotMatch(plain, /<span style="display:contents"/);
  assert.doesNotMatch(plain, /aria-label=|title=/);
  // A labelled drawing of a control that switches keeps the holder, with no
  // tooltip, so the control stays mounted; and the form needs an icon.
  for (const props of [
    { icon: "history", iconOnly: false },
    { iconOnly: true },
  ] as const) {
    const html = await drawn({
      label: "History",
      tone: "quiet",
      size: "sm",
      onPress: () => {},
      ...props,
    });
    assert.deepEqual(words(html), ["History"], JSON.stringify(props));
    assert.match(html, /<span style="display:contents"><button/);
    assert.doesNotMatch(html, /aria-label=|title=/);
  }
});
