import assert from "node:assert/strict";
import { test } from "node:test";

import { ApiError } from "../api/errors";
import { formError } from "../api/form-error";
import { askAnOwnerToUpgrade, planLabel, publicOnFree } from "../api/labels";
import type { Billing, Subscription } from "../api/types";
import {
  day,
  money,
  planSituation,
  seatConsequence,
  seatKindOf,
  seatRows,
  trialDays,
} from "../settings/panes/billing-facts";
import { paneRoute } from "../settings/routes";

const editorCents = 2000;
const collaboratorCents = 500;

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

function billing(over: Partial<Billing> = {}): Billing {
  return {
    plan: "team",
    seats: [
      { kind: "editor", inUse: 3, unitAmountCents: editorCents },
      { kind: "collaborator", inUse: 1, unitAmountCents: collaboratorCents },
    ],
    subscription: subscription(),
    manageable: true,
    checkoutAvailable: false,
    ...over,
  };
}

test("the pane states the Team trial length and seat prices", () => {
  // The trial length is the one catalogue value the read does not carry, so
  // the pane writes it from its own constant.
  assert.equal(trialDays, 7);
  // Nothing in the product types the seat prices, so the test states what the
  // pane prints for the amounts the API answers with.
  assert.equal(money(2000), "$20");
  assert.equal(money(500), "$5");
});

test("an amount is written with cents only when it has them", () => {
  assert.equal(money(0), "$0");
  assert.equal(money(2000), "$20");
  assert.equal(money(500), "$5");
  assert.equal(money(1999), "$19.99");
});

test("a date reads the same way wherever the product was built", () => {
  assert.equal(day("2030-10-15T12:00:00Z"), "15 Oct");
  assert.equal(day("2030-09-29T12:00:00Z"), "29 Sep");
  assert.equal(day("not a date"), undefined);
});

test("the situation a read describes is the one the reader must act on", () => {
  assert.equal(planSituation(billing()), "team");
  assert.equal(
    planSituation(
      billing({ subscription: subscription({ status: "trialing" }) }),
    ),
    "trial",
  );
  assert.equal(
    planSituation(
      billing({ subscription: subscription({ cancelAtPeriodEnd: true }) }),
    ),
    "ending",
  );
  assert.equal(
    planSituation(
      billing({ subscription: subscription({ status: "past_due" }) }),
    ),
    "past-due",
  );
  // A failed invoice is the payment-failed state even while Stripe still calls
  // the subscription active, and it is read before a cancellation.
  assert.equal(
    planSituation(
      billing({
        subscription: subscription({
          cancelAtPeriodEnd: true,
          paymentFailedAt: "2030-10-01T00:00:00Z",
        }),
      }),
    ),
    "past-due",
  );
  assert.equal(planSituation(billing({ subscription: null })), "team");
});

test("the monthly total is computed from the counts and the amounts", () => {
  const rows = seatRows(billing(), "team");
  assert.deepEqual(rows, [
    ["Plan", "Team"],
    ["Editors", "3 in use · $20 each a month"],
    ["Collaborators", "1 in use · $5 each a month"],
    ["Monthly total", "$65"],
    ["Renews", "15 Oct"],
  ]);
});

test("a trial and a cancellation carry their date instead of a renewal", () => {
  const trial = seatRows(
    billing({
      subscription: subscription({
        status: "trialing",
        trialEnd: "2030-09-29T12:00:00Z",
      }),
    }),
    "trial",
  );
  assert.deepEqual(trial[0], [
    "Plan",
    "Team until 29 Sep, then billed monthly",
  ]);
  assert.ok(!trial.some(([label]) => label === "Renews"));
  const ending = seatRows(
    billing({ subscription: subscription({ cancelAtPeriodEnd: true }) }),
    "ending",
  );
  assert.deepEqual(ending[0], ["Plan", "Team ends 15 Oct"]);
  assert.ok(!ending.some(([label]) => label === "Renews"));
});

test("an amount the deployment could not verify is left out, never guessed", () => {
  const unpriced = billing({
    seats: [
      { kind: "editor", inUse: 3, unitAmountCents: null },
      { kind: "collaborator", inUse: 1, unitAmountCents: null },
    ],
  });
  assert.deepEqual(seatRows(unpriced, "team"), [
    ["Plan", "Team"],
    ["Renews", "15 Oct"],
  ]);
});

test("a seat kind is derived from a role and never set on its own", () => {
  assert.equal(seatKindOf("reviewer"), "collaborator");
  for (const role of ["owner", "admin", "member"]) {
    assert.equal(seatKindOf(role), "editor");
  }
});

test("each invitation names the seat it adds and what that seat costs", () => {
  assert.equal(
    seatConsequence(billing(), "reviewer"),
    "Adds a Collaborator seat, $5 a month.",
  );
  assert.equal(
    seatConsequence(billing(), "member"),
    "Adds an Editor seat, $20 a month.",
  );
  // Nothing to say where there is no amount, and nothing invented either.
  assert.equal(seatConsequence(undefined, "member"), undefined);
});

test("the billing pane has a durable route", () => {
  const route = paneRoute("billing", { workspaceSlug: "org" });
  assert.equal(route, "/org/-/settings/billing");
});

test("the plan reads in the product's own words everywhere it is named", () => {
  assert.equal(planLabel("free"), "Free");
  assert.equal(planLabel("team"), "Team");
  assert.equal(publicOnFree, "Projects are public on the free plan.");
  assert.equal(askAnOwnerToUpgrade, "Ask an owner to upgrade to Team.");
});

test("a refused private-visibility write supplies the modal's cause", () => {
  const refused = new ApiError({
    code: "failed-precondition",
    reason: "plan-required",
    message: "Upgrade to Team to use this feature.",
    requestId: "01994f10-0000-7000-8000-0000000000bb",
    status: 400,
    data: { requiredPlan: "team", feature: "private-projects" },
  });
  // No field owns it, so the visibility modal's write-failure fragment owns it.
  assert.deepEqual(formError(refused, {}), {
    field: undefined,
    message: "Private projects are on Team.",
  });
});
