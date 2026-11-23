import assert from "node:assert/strict";
import { test } from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { themeChoiceKey } from "../../theme/choice";
import { AppTheme } from "../../theme/provider";
import {
  usePreviewScheme,
  useReaderScheme,
  useThemeChoice,
} from "../../theme/scheme";
import { memoryStorage, withWindow } from "../page-window";

/** What each surface reads of the schemes, as one line of text. */
function Probe() {
  return createElement(
    "output",
    null,
    [
      "app=" + useReaderScheme(),
      "theme=" + useThemeChoice().scheme,
      "preview=" + usePreviewScheme(),
    ].join(" "),
  );
}

/**
 * The schemes the application reads under one stored Theme. Node has no
 * system preference, which the application reads as light.
 */
function schemes(stored?: string): string {
  const localStorage = memoryStorage();
  if (stored !== undefined) localStorage.setItem(themeChoiceKey, stored);
  let html = "";
  withWindow({ localStorage }, () => {
    html = renderToStaticMarkup(
      createElement(AppTheme, null, createElement(Probe)),
    );
  });
  return /<output>([^<]*)<\/output>/.exec(html)?.[1] ?? html;
}

test("before a choice the application and the previews follow the system preference", () => {
  assert.equal(schemes(), "app=light theme=light preview=light");
});

test("the Theme the device keeps draws the application and never the previews", () => {
  assert.equal(schemes("dark"), "app=dark theme=dark preview=light");
  assert.equal(schemes("light"), "app=light theme=light preview=light");
});

test("a stored value that names no scheme leaves the system preference in force", () => {
  assert.equal(schemes("sepia"), "app=light theme=light preview=light");
});
