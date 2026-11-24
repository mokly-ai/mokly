import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

import { SharedUiThemeProvider } from "@firna/ui/theme";
import { paletteUiTheme } from "@mokly-cloud/tokens/shared-ui-theme";
import { createElement } from "react";
import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { PublicationTrigger } from "../../viewer/pill";

// Expo Router cannot load outside its runtime, so the router resolves to the
// press doubles. The package Button stays the real one, because the pill's
// parts are drawn inside it. The hook belongs to this file's own process.
const doubles = new URL("../press-doubles.ts", import.meta.url).href;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "expo-router")
      return { url: doubles, shortCircuit: true };
    return next(specifier, context);
  },
});

const theme = paletteUiTheme("light");

type Pill = Omit<ComponentProps<typeof PublicationTrigger>, "open" | "onOpen">;

/** One publication pill in one composition of the bar, as static markup. */
async function drawn(props: Pill, compact: boolean): Promise<string> {
  const { PublicationTrigger } = await import("../../viewer/pill");
  const { CompactBarProvider } = await import("../../viewer/bar-width");
  return renderToStaticMarkup(
    createElement(SharedUiThemeProvider, {
      theme,
      children: createElement(CompactBarProvider, {
        compact,
        labels: true,
        children: createElement(PublicationTrigger, {
          ...props,
          open: false,
          onOpen: () => {},
        }),
      }),
    }),
  );
}

/** The one Button's accessible name, and the markup inside the Button. */
function control(html: string): { name: string; inside: string } {
  const buttons = [
    ...html.matchAll(
      /<button[^>]*aria-label="([^"]*)"[^>]*>([\s\S]*)<\/button>/g,
    ),
  ];
  assert.equal(buttons.length, 1);
  return { name: buttons[0]?.[1] ?? "", inside: buttons[0]?.[2] ?? "" };
}

/**
 * The text of the one element whose whole class is this, inside some markup:
 * every text up to the tag that closes it, through the elements it holds.
 */
function textOf(markup: string, className: string): string {
  const starts = [
    ...markup.matchAll(new RegExp(`<[a-z]+ class="${className}"[^>]*>`, "g")),
  ];
  assert.equal(starts.length, 1, className);
  const start = starts[0];
  const rest = markup.slice((start?.index ?? 0) + (start?.[0].length ?? 0));
  let depth = 1;
  let text = "";
  for (const piece of rest.matchAll(/<(\/?)[a-z][^>]*>|[^<]+/g)) {
    if (!piece[0].startsWith("<")) {
      text += piece[0];
      continue;
    }
    depth += piece[1] === "/" ? -1 : 1;
    if (depth === 0) break;
  }
  return text;
}

const branch: Pill = {
  label: "calummoore/sydney-v1",
  kind: "branch",
  state: "ready",
  detail: "Ready · 15 Sep",
  sha: "72d6047",
};

test("the full pill is one Button, named and titled by every word it shows", async () => {
  const html = await drawn(branch, false);
  const { name, inside } = control(html);
  assert.equal(name, "calummoore/sydney-v1, Ready · 15 Sep, 72d6047");
  // The frame holds the Button inside the boxless boundary of its scoped
  // theme, so the Button fills the frame.
  assert.match(
    html,
    /<span class="fo-canvas-pill" title="([^"]*)"><div style="display:contents;[^"]*"><button/,
  );
  assert.equal(html.match(/class="fo-canvas-pill" title="([^"]*)"/)?.[1], name);
  // The Button draws the branch in mono, the state's phrase and the short
  // SHA itself, and its name holds every word that they show.
  const shown = [
    textOf(inside, "fo-canvas-pill-name fo-canvas-pill-branch"),
    textOf(inside, "fo-top-state-detail"),
    textOf(inside, "mono-value"),
  ];
  assert.deepEqual(shown, [
    "calummoore/sydney-v1",
    "Ready · 15 Sep",
    "72d6047",
  ]);
  for (const words of shown) assert.ok(name.includes(words), words);
  assert.ok(inside.includes('class="fo-canvas-pill-glyph"'));
  assert.ok(inside.includes('class="fo-canvas-pill-chevron"'));
});

test("the compact pill shows the branch's last segment and keeps the whole name", async () => {
  const { name, inside } = control(await drawn(branch, true));
  assert.equal(name, "calummoore/sydney-v1, Ready · 15 Sep, 72d6047");
  const shown = textOf(inside, "fo-canvas-pill-name fo-canvas-pill-branch");
  assert.equal(shown, "sydney-v1");
  assert.ok(name.includes(shown));
  assert.ok(
    inside.startsWith(
      '<span class="fo-canvas-pill-content"><span class="fo-canvas-pill-dot">',
    ),
  );
});

test("a pull request keeps its number in semibold before its title in sans", async () => {
  const pull: Pill = {
    label: "#42 Name the pull request",
    kind: "pullRequest",
    state: "ready",
    detail: "Alex · Ready · 15 Sep",
    sha: "9c2f5ae",
  };
  for (const [compact, shown] of [
    [false, "#42 Name the pull request"],
    [true, "#42"],
  ] as const) {
    const { name, inside } = control(await drawn(pull, compact));
    assert.equal(
      name,
      "#42 Name the pull request, Alex · Ready · 15 Sep, 9c2f5ae",
    );
    assert.equal(textOf(inside, "fo-canvas-pill-name"), shown);
    assert.equal(textOf(inside, "fo-canvas-pill-number"), "#42");
    assert.doesNotMatch(inside, /fo-canvas-pill-branch/);
  }
});

test("a name that stands in for a reference draws no glyph and reads in sans", async () => {
  const { name, inside } = control(
    await drawn(
      { label: "This build", state: "none", detail: "Loading" },
      false,
    ),
  );
  assert.equal(name, "This build, Loading");
  assert.equal(textOf(inside, "fo-canvas-pill-name"), "This build");
  assert.doesNotMatch(inside, /fo-canvas-pill-glyph|fo-canvas-pill-branch/);
});
