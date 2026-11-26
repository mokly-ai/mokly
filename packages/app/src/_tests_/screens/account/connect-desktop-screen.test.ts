import "../../dom";

import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { afterEach, test } from "node:test";
import { setImmediate } from "node:timers/promises";

import { SharedUiThemeProvider } from "@firna/ui/theme";
import { paletteUiTheme } from "@mokly-cloud/tokens/shared-ui-theme";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";

import { ApiError } from "../../../api/errors";

import { boundary, settle } from "./connect-desktop-doubles";

/**
 * The desktop connect screen in a DOM, from rest: the reader presses one of
 * its two controls and only that control's request is refused. The refusal
 * has to reach the reader through the real `useWrite` and the real package
 * Button, beside the control that sent it: the cause as the one alert line
 * immediately above it, the control reading its way back, and Details with
 * the request's reference beneath it, all in its own `fo-write-failure`
 * frame. The other control stays at rest.
 *
 * Expo Router resolves to the press doubles, and the session and the grant
 * request to `connect-desktop-doubles.ts`. The hooks belong to this file's
 * own test process.
 */
const pressDoubles = new URL("../../press-doubles.ts", import.meta.url).href;
const doubles = new URL("./connect-desktop-doubles.ts", import.meta.url).href;
const doubled = ["/src/session/context.tsx", "/src/data/auth.ts"];
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "expo-router")
      return { url: pressDoubles, shortCircuit: true };
    const resolved = next(specifier, context);
    if (
      context.parentURL !== doubles &&
      doubled.some((path) => resolved.url.endsWith(path))
    )
      return { url: doubles, shortCircuit: true };
    return resolved;
  },
});

afterEach(settle);

const challenge = "_-BU_nrgy23GXDr5th1SCfQ5hR20PQulmXM33xVGaOs";

/** A refusal Mokly answered with: it was busy. */
function busy(requestId: string): ApiError {
  return new ApiError({
    code: "unavailable",
    reason: "unavailable",
    message: "The API is busy.",
    requestId,
    status: 503,
  });
}

/** The signed-in screen, drawn in the DOM at rest. */
async function drawScreen(): Promise<void> {
  const { ConnectDesktopScreen } =
    await import("../../../screens/account/connect-desktop-screen");
  render(
    createElement(SharedUiThemeProvider, {
      theme: paletteUiTheme("light"),
      children: createElement(ConnectDesktopScreen, {
        challenge,
        returnTo: undefined,
      }),
    }),
  );
}

/** Press one control, and let its write settle. */
async function press(control: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByTestId(control));
    await setImmediate();
  });
}

/**
 * What the innermost `fo-write-failure` frame around one control holds, in
 * document order: each cause, the control with its label, and each Details
 * with its reference.
 */
function failureAround(control: string): string[] {
  const button = screen.getByTestId(control);
  const frame = button.closest(".fo-write-failure");
  if (frame === null) return ["no fo-write-failure frame"];
  return [...frame.children].map((part) => {
    if (part.matches('p.fo-copy[role="alert"]'))
      return "cause: " + part.textContent;
    if (part.contains(button)) return "control: " + button.textContent;
    if (part.matches("details.fo-error-details"))
      return (
        part.querySelector("summary")?.textContent +
        ": " +
        part.querySelector("code")?.textContent
      );
    return "other: " + part.outerHTML;
  });
}

/** What one control at rest reads, or why it is not at rest. */
function atRest(control: string): string {
  const button = screen.getByTestId(control);
  if (button.closest(".fo-write-failure") !== null) return "refused frame";
  const frame = button.closest(".fo-write-frame");
  if (frame === null) return "no fo-write-frame";
  if (frame.querySelector('[role="alert"]') !== null) return "alert in frame";
  return "at rest: " + button.textContent;
}

test("a refused sign-out informs the reader beside Use another account only", async () => {
  boundary.signOut = () => Promise.reject(busy("req_sign_out_refused"));
  await drawScreen();
  await press("use-another-account");

  assert.deepEqual(failureAround("use-another-account"), [
    "cause: Mokly is busy. Try again in a moment.",
    "control: Try again",
    "Details: req_sign_out_refused",
  ]);
  assert.equal(atRest("open-mokly"), "at rest: Open Mokly");
  assert.equal(screen.getAllByRole("alert").length, 1);
});

test("a refused grant request informs the reader beside Open Mokly only", async () => {
  boundary.issueDesktopGrant = () => Promise.reject(busy("req_grant_refused"));
  await drawScreen();
  await press("open-mokly");

  assert.deepEqual(failureAround("open-mokly"), [
    "cause: Mokly is busy. Try again in a moment.",
    "control: Try again",
    "Details: req_grant_refused",
  ]);
  assert.equal(atRest("use-another-account"), "at rest: Use another account");
  assert.equal(screen.getAllByRole("alert").length, 1);
});
