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

test("the standalone shell paints its loading state before the index arrives", () => {
  const win = {
    location: { href: "http://localhost:4810/view/guide/", reload() {} },
    fetch: () => new Promise<Response>(() => {}),
  } as unknown as ShellWindow;
  const html = renderToStaticMarkup(
    <StandaloneShell preferences={{ colorScheme: "light" }} win={win} />,
  );
  assert.equal(
    html,
    '<div aria-busy="true" class="mbk mbk-empty" tabindex="-1"><p role="status">Loading catalogue…</p></div>',
  );
});

test("a version failure shows the one headline and Reload", () => {
  const html = renderToStaticMarkup(
    <VersionFailure
      error={new MoklyVersionError("catalogue", 8, 7)}
      reload={() => undefined}
    />,
  );
  assert.equal(
    VERSION_ERROR_MESSAGE,
    "This catalogue needs a compatible viewer",
  );
  assert.equal(
    html,
    '<div class="mbk mbk-empty" data-mokly-version-error="" role="alert"><h2>This catalogue needs a compatible viewer</h2><button class="mbk-empty-link" type="button">Reload</button></div>',
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
