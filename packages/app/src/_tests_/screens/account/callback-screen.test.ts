import assert from "node:assert/strict";
import { test } from "node:test";

import { createElement } from "react";
import type { ComponentProps } from "react";

import { ApiError } from "../../../api/errors";
import type { ApiCode } from "../../../api/errors";
import { signInPath } from "../../../navigation/paths";
import type { CallbackRecovery } from "../../../screens/account/callback-screen";
import { tabAt, withWindow } from "../../page-window";
import { seen } from "../../press-doubles";
import { draw } from "../../server-render";

/** The request ID of each refusal below, which its Details name. */
const requestId = "01994f10-0000-7000-8000-0000000000dd";

/** The API's refusal of the token, with the code and status of its reason. */
function refused(code: ApiCode, reason: string, status: number) {
  return {
    error: new ApiError({
      code,
      reason,
      message: "Refused.",
      requestId,
      status,
    }),
  };
}

/**
 * Each failed row of the email callback table: the heading the landing draws,
 * and the request that its Details name, or none where it draws no Details.
 */
const rows: readonly {
  row: string;
  failure: ComponentProps<typeof CallbackRecovery>;
  heading: string;
  details: string | undefined;
}[] = [
  {
    row: "missing input",
    failure: { missing: true },
    heading: "This link isn’t valid",
    details: undefined,
  },
  {
    row: "magic-link-invalid",
    failure: refused("bad-request", "magic-link-invalid", 400),
    heading: "This link isn’t valid",
    details: requestId,
  },
  {
    row: "magic-link-expired",
    failure: refused("failed-precondition", "magic-link-expired", 400),
    heading: "This link has expired",
    details: requestId,
  },
  {
    row: "magic-link-used",
    failure: refused("failed-precondition", "magic-link-used", 400),
    heading: "This link has already been used",
    details: requestId,
  },
  {
    row: "any other failure",
    failure: refused("unavailable", "unavailable", 503),
    heading: "We couldn’t sign you in",
    details: requestId,
  },
];

/** What one failed landing draws in a tab, and where pressing each action goes. */
async function landing(failure: ComponentProps<typeof CallbackRecovery>) {
  const { CallbackRecovery } =
    await import("../../../screens/account/callback-screen");
  const page = { location: tabAt() };
  const { html, buttons } = draw(
    page,
    createElement(CallbackRecovery, failure),
  );
  withWindow(page, () => {
    for (const button of buttons) button.onPress?.();
  });
  return {
    heading: /<h1>([^<]*)<\/h1>/.exec(html)?.[1],
    details:
      /<summary>Details<\/summary>.*?Reference <code[^>]*>([^<]*)<\/code>/s.exec(
        html,
      )?.[1],
    actions: buttons.map((button) => button.label),
    pushed: [...seen.pushed],
  };
}

test("each failed email landing draws its state's heading, an API failure's Details and Back to sign in", async () => {
  for (const { row, failure, heading, details } of rows) {
    assert.deepEqual(
      await landing(failure),
      {
        heading,
        details,
        actions: ["Back to sign in"],
        pushed: [signInPath],
      },
      row,
    );
  }
});
