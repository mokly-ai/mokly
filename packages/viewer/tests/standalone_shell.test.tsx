import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import {
  MoklyVersionError,
  VERSION_ERROR_MESSAGE,
} from "../src/catalogue/version_error.js";
import { readStandalonePreferences } from "../src/standalone/preferences.js";
import { StandaloneShell, type ShellWindow } from "../src/standalone/shell.js";
import { VersionFailure } from "../src/standalone/version_failure.js";

function storage(values: Record<string, string>) {
  return { getItem: (key: string) => values[key] ?? null };
}

/** A window whose index never arrives, with an appearance when one is given. */
function pendingWindow(theme?: "dark"): ShellWindow {
  return {
    location: { href: "http://localhost:4810/view/guide/", reload() {} },
    fetch: () => new Promise<Response>(() => {}),
    ...(theme
      ? { __moklyAppearance: { current: () => ({ theme, scheme: theme }) } }
      : {}),
  } as unknown as ShellWindow;
}

test("the standalone shell paints its loading state before the index arrives", () => {
  const html = renderToStaticMarkup(
    <StandaloneShell
      preferences={{ colorScheme: "light" }}
      win={pendingWindow()}
    />,
  );
  assert.equal(
    html,
    '<div aria-busy="true" class="mbk mbk-empty mbk-reset" tabindex="-1" data-mokly-theme="auto"><p class="mbk-reset" role="status">Loading catalogue…</p></div>',
  );
});

test("the loading root states the document's appearance", () => {
  const html = renderToStaticMarkup(
    <StandaloneShell
      preferences={{ colorScheme: "dark" }}
      win={pendingWindow("dark")}
    />,
  );
  assert.match(
    html,
    /^<div[^>]* class="mbk mbk-empty mbk-reset"[^>]* data-mokly-theme="dark">/u,
  );
});

test("a version failure shows the one headline and Reload", () => {
  const html = renderToStaticMarkup(
    <VersionFailure
      error={new MoklyVersionError("catalogue", 10, 9)}
      reload={() => undefined}
      root={{ kind: "standalone", theme: "dark" }}
    />,
  );
  assert.equal(
    VERSION_ERROR_MESSAGE,
    "This catalogue needs a compatible viewer",
  );
  assert.equal(
    html,
    '<div class="mbk mbk-empty mbk-reset" data-mokly-version-error="" role="alert" data-mokly-theme="dark"><h2 class="mbk-reset">This catalogue needs a compatible viewer</h2><button class="mbk-empty-link mbk-reset" type="button">Reload</button></div>',
  );
});

test("stored preferences restore disclosures, Details and a clamped width", () => {
  const preferences = readStandalonePreferences(
    {
      innerWidth: 1200,
      localStorage: storage({
        "mokly:nav-disclosure:v4": JSON.stringify({
          "section:specs": false,
          "folder:specs:product": "yes",
        }),
        "mokly:details-disclosure": "open",
        "mokly:navigation-width:v1": "9999",
      }),
    },
    "dark",
  );
  assert.deepEqual(preferences, {
    colorScheme: "dark",
    disclosures: { "section:specs": false },
    detailsOpen: true,
    navigationMaximum: 480,
    navigationWidth: 480,
  });
  assert.equal(
    readStandalonePreferences(
      {
        innerWidth: 500,
        localStorage: storage({ "mokly:navigation-width:v1": "100" }),
      },
      "light",
    ).navigationWidth,
    192,
  );
});

test("a blocked or invalid store is a missing preference", () => {
  const blocked = {
    getItem() {
      throw new Error("blocked");
    },
  };
  assert.deepEqual(
    readStandalonePreferences(
      { innerWidth: 900, localStorage: blocked },
      "light",
    ),
    { colorScheme: "light", disclosures: {}, navigationMaximum: 450 },
  );
  assert.deepEqual(
    readStandalonePreferences(
      {
        innerWidth: 900,
        localStorage: storage({
          "mokly:nav-disclosure:v4": "not json",
          "mokly:details-disclosure": "maybe",
          "mokly:navigation-width:v1": "wide",
        }),
      },
      "light",
    ),
    { colorScheme: "light", disclosures: {}, navigationMaximum: 450 },
  );
});
