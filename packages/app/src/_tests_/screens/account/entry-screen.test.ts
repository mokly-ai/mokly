import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { createElement } from "react";

import { ApiError } from "../../../api/errors";
import type { Configuration } from "../../../api/types";
import { shellPage, tabAt } from "../../page-window";
import type { TestLocation } from "../../page-window";
import { answers, failures } from "../../resource-doubles";
import { draw, recordingPage } from "../../server-render";

/** The shared account one deployment's configuration answer names. */
const account = "reviewer@example.com";

/** The configuration answer, with the shared account or without one. */
function configuration(
  previewPassword: Configuration["previewPassword"],
): Configuration {
  return { github: true, billing: false, previewPassword };
}

/** What one entry screen draws in one page, loaded through the doubles. */
async function entry(mode: "sign-in" | "sign-up", location: TestLocation) {
  const { EntryScreen } = await import("../../../screens/account/entry-screen");
  const { SessionProvider } = await import("../../../session/context");
  const screen = createElement(
    SessionProvider,
    null,
    createElement(EntryScreen, { mode, returnTo: "/acme/website" }),
  );
  const { html, buttons } = draw(recordingPage(location).page, screen);
  return {
    html,
    labels: buttons.map((button) => button.label),
    waits: html.includes('aria-busy="true"'),
    password: /<input[^>]*type="password"/.exec(html)?.[0],
  };
}

afterEach(() => {
  answers.clear();
  failures.clear();
});

test("sign in draws the password section only where the configuration answer names an account", async () => {
  answers.set("configuration", configuration({ account }));
  const named = await entry("sign-in", tabAt());
  assert.deepEqual(named.labels, [
    "Continue with GitHub",
    "Continue with email",
    "Continue as reviewer@example.com",
  ]);
  assert.equal(named.waits, false);
  assert.equal(named.html.match(/class="or-divider"/g)?.length, 2);
  // Masked, filled by a password manager, and never rewritten by the keyboard.
  // HTML attribute names ignore case, and server rendering keeps React's.
  const field = named.password ?? "";
  assert.match(field, / autocomplete="current-password"/i);
  assert.match(field, / autocapitalize="none"/i);
  assert.match(field, / autocorrect="off"/i);
  assert.match(field, / spellcheck="false"/i);
  const label = / aria-labelledby="([\w-]+)"/.exec(field)?.[1] ?? "";
  assert.match(named.html, new RegExp(` id="${label}"[^>]*>Password</`));

  // Sign up and the desktop app's window never draw it.
  const signUp = await entry("sign-up", tabAt());
  assert.deepEqual(signUp.labels, [
    "Continue with GitHub",
    "Continue with email",
  ]);
  assert.equal(signUp.password, undefined);
  const window = await entry("sign-in", shellPage());
  assert.deepEqual(window.labels, ["Continue in browser"]);

  answers.set("configuration", configuration(null));
  const unnamed = await entry("sign-in", tabAt());
  assert.deepEqual(unnamed.labels, [
    "Continue with GitHub",
    "Continue with email",
  ]);
  assert.equal(unnamed.password, undefined);
  assert.equal(unnamed.html.match(/class="or-divider"/g)?.length, 1);
});

test("while the configuration answer is read, sign in waits in its form without the section", async () => {
  const reading = await entry("sign-in", tabAt());
  assert.equal(reading.waits, true);
  assert.equal(reading.password, undefined);
  assert.deepEqual(reading.labels, [
    "Continue with GitHub",
    "Continue with email",
  ]);
  // Sign up draws no section, so it waits for nothing.
  assert.equal((await entry("sign-up", tabAt())).waits, false);
});

test("a failed configuration read draws email and GitHub sign-in only", async () => {
  failures.set(
    "configuration",
    new ApiError({
      code: "unavailable",
      reason: "unavailable",
      message: "Mokly is busy.",
      requestId: "01994f10-0000-7000-8000-0000000000cc",
      status: 503,
    }),
  );
  const failed = await entry("sign-in", tabAt());
  assert.equal(failed.waits, false);
  assert.equal(failed.password, undefined);
  assert.deepEqual(failed.labels, [
    "Continue with GitHub",
    "Continue with email",
  ]);
});
