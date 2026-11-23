import assert from "node:assert/strict";
import { test } from "node:test";

import type { EntryChangeReason, UseCaseStep } from "@mokly/model";

import { viewHref } from "../src/navigation/routes.js";
import { changedSteps } from "../src/shell/changed_steps.js";

import { publishedScreen } from "./published_entries_fixture.js";

/** The sign-in flow's screens: Sign in and Welcome changed, Verify did not. */
const screens = [
  publishedScreen("auth/sign-in", "Sign in", "changed"),
  publishedScreen("auth/verify", "Verify email"),
  publishedScreen("auth/welcome", "Welcome", "changed"),
];

/** The reasons of the flow's detail, one `screen` reason for each changed screen. */
const reasons: readonly EntryChangeReason[] = [
  { kind: "metadata" },
  { kind: "screen", screenPath: "auth/welcome" },
  { kind: "screen", screenPath: "auth/sign-in" },
];

test("each step whose screen changed gives one line in step order, titled by its own title or else its screen's, linking to its screen", () => {
  const steps: UseCaseStep[] = [
    { screenPath: "auth/sign-in", title: "Enter the password" },
    { screenPath: "auth/verify", title: "Confirm the address" },
    { screenPath: "auth/welcome" },
  ];
  assert.deepEqual(changedSteps(steps, reasons, screens), [
    {
      href: viewHref("auth/sign-in"),
      key: "step-0",
      title: "Enter the password",
    },
    { href: viewHref("auth/welcome"), key: "step-2", title: "Welcome" },
  ]);
});

test("two steps that show one changed screen give two lines", () => {
  const steps: UseCaseStep[] = [
    { screenPath: "auth/sign-in", title: "Sign in" },
    { screenPath: "auth/verify" },
    { screenPath: "auth/sign-in", title: "Sign in again" },
  ];
  assert.deepEqual(changedSteps(steps, reasons, screens), [
    { href: viewHref("auth/sign-in"), key: "step-0", title: "Sign in" },
    { href: viewHref("auth/sign-in"), key: "step-2", title: "Sign in again" },
  ]);
});

test("a changed step whose screen the catalogue does not hold gives no line", () => {
  const steps: UseCaseStep[] = [
    { screenPath: "auth/welcome", title: "Arrive" },
    { screenPath: "auth/sign-in", title: "Sign in" },
  ];
  assert.deepEqual(
    changedSteps(
      steps,
      reasons,
      screens.filter(({ path }) => path !== "auth/welcome"),
    ),
    [{ href: viewHref("auth/sign-in"), key: "step-1", title: "Sign in" }],
  );
});

test("no reasons, or reasons without a screen reason, give no line", () => {
  const steps: UseCaseStep[] = [
    { screenPath: "auth/sign-in" },
    { screenPath: "auth/welcome" },
  ];
  assert.deepEqual(changedSteps(steps, undefined, screens), []);
  assert.deepEqual(
    changedSteps(steps, [{ kind: "material" }, { kind: "metadata" }], screens),
    [],
  );
});
