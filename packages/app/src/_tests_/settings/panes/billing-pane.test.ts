import assert from "node:assert/strict";
import { test } from "node:test";

import { createElement } from "react";

import { ApiError } from "../../../api/errors";
import type { Billing, Subscription, Workspace } from "../../../api/types";
import { tabAt } from "../../page-window";
import { answers, failures } from "../../resource-doubles";
import { draw, recordingPage } from "../../server-render";

/**
 * What the Billing pane draws for each answer of the billing read: the
 * branches the pane chooses between, rendered in Node with the read answered.
 * The amounts and dates are the read's own, so the pane writes them back.
 */

const workspace: Workspace = {
  id: "01994f10-0000-7000-8000-000000000077",
  name: "Acme",
  slug: "acme",
  role: "owner",
  plan: "team",
  githubInstallationState: "absent",
  version: 1,
};

function subscription(over: Partial<Subscription> = {}): Subscription {
  return {
    status: "active",
    trialEnd: null,
    currentPeriodEnd: "2030-10-15T12:00:00Z",
    cancelAtPeriodEnd: false,
    paymentFailedAt: null,
    ...over,
  };
}

function team(over: Partial<Billing> = {}): Billing {
  return {
    plan: "team",
    seats: [
      { kind: "editor", inUse: 2, unitAmountCents: 2000 },
      { kind: "collaborator", inUse: 1, unitAmountCents: 500 },
    ],
    subscription: subscription(),
    manageable: true,
    checkoutAvailable: false,
    ...over,
  };
}

/** Draw the pane over one answer, or one failure, of the billing read. */
async function pane(read: Billing | ApiError) {
  const { BillingPane } = await import("../../../settings/panes/billing-pane");
  if (read instanceof ApiError) failures.set("billing:", read);
  else answers.set("billing:", read);
  try {
    const { html, buttons } = draw(
      recordingPage(tabAt()).page,
      createElement(BillingPane, { workspace }),
    );
    return { html, testIDs: buttons.map((button) => button.testID) };
  } finally {
    answers.delete("billing:");
    failures.delete("billing:");
  }
}

/** One row of the pane's facts, as the reader reads it. */
function fact(label: string, value: string): string {
  return `<dt>${label}</dt><dd>${value}</dd>`;
}

test("an owner on Team reads both seat kinds and their monthly total", async () => {
  const { html, testIDs } = await pane(team());
  assert.ok(html.includes(fact("Editors", "2 in use · $20 each a month")));
  assert.ok(html.includes(fact("Collaborators", "1 in use · $5 each a month")));
  assert.ok(html.includes(fact("Monthly total", "$45")));
  assert.ok(!html.includes("An owner manages billing."));
  assert.deepEqual(testIDs, ["manage-billing"]);
});

test("an admin reads the same facts with a sentence where the owner's control is", async () => {
  const { html, testIDs } = await pane(team({ manageable: false }));
  assert.ok(html.includes(fact("Plan", "Team")));
  assert.ok(html.includes(fact("Editors", "2 in use · $20 each a month")));
  assert.ok(html.includes("An owner manages billing."));
  assert.deepEqual(testIDs, []);
});

test("a failed payment an admin reads names itself and offers no control", async () => {
  const { html, testIDs } = await pane(
    team({
      manageable: false,
      subscription: subscription({ status: "past_due" }),
    }),
  );
  assert.ok(html.includes("Payment failed"));
  assert.ok(html.includes("An owner manages billing."));
  assert.deepEqual(testIDs, []);
});

test("the trial, the cancellation and the failed payment each name themselves", async () => {
  const trial = await pane(
    team({
      subscription: subscription({
        status: "trialing",
        trialEnd: "2030-09-29T12:00:00Z",
      }),
    }),
  );
  assert.ok(
    trial.html.includes(fact("Plan", "Team until 29 Sep, then billed monthly")),
  );
  assert.ok(!trial.html.includes("Renews"));

  const ending = await pane(
    team({ subscription: subscription({ cancelAtPeriodEnd: true }) }),
  );
  assert.ok(ending.html.includes(fact("Plan", "Team ends 15 Oct")));

  // A failed invoice replaces Manage billing with the one thing to do.
  const failed = await pane(
    team({
      subscription: subscription({ paymentFailedAt: "2030-10-01T00:00:00Z" }),
    }),
  );
  assert.ok(failed.html.includes("Payment failed"));
  assert.deepEqual(failed.testIDs, ["update-payment-method"]);
});

test("a deployment with no billing configured says so where its facts would be", async () => {
  const { html, testIDs } = await pane(
    new ApiError({
      code: "failed-precondition",
      reason: "operation-unavailable",
      message: "Billing is not configured.",
      requestId: "01994f10-0000-7000-8000-0000000000cc",
      status: 400,
    }),
  );
  assert.ok(html.includes("Billing opens soon."));
  assert.ok(!html.includes("Billing couldn’t load"));
  assert.deepEqual(testIDs, []);
});

test("an unverified price offers Team without an amount and links the plans", async () => {
  const { html, testIDs } = await pane({
    plan: "free",
    seats: [
      { kind: "editor", inUse: 1, unitAmountCents: null },
      { kind: "collaborator", inUse: 0, unitAmountCents: null },
    ],
    subscription: null,
    manageable: true,
    checkoutAvailable: false,
  });
  assert.ok(html.includes("Free for open-source catalogues"));
  assert.deepEqual(testIDs, ["upgrade-to-team"]);
  assert.match(
    html,
    /<a [^>]*href="[^"]*\/pricing"[^>]*><span>Pricing<\/span>/,
  );
  assert.ok(!html.includes("a month"));
  assert.ok(!html.includes("Team starts with a 7-day trial."));
});
