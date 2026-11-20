import assert from "node:assert/strict";
import { test } from "node:test";

import { createElement } from "react";

import type { Billing, Workspace } from "../../api/types";
import { icons } from "../../components/icons";
import type { PageTrip } from "../../navigation/leave-page";
import type { Write } from "../../settings/write";
import { shellPage, tabAt, withWindow } from "../page-window";
import { answers } from "../resource-doubles";
import { draw, recordingPage } from "../server-render";

const workspace: Workspace = {
  id: "01994f10-0000-7000-8000-000000000066",
  name: "Acme",
  slug: "acme",
  role: "owner",
  plan: "free",
  githubInstallationState: "absent",
  version: 1,
};

const seats: Billing["seats"] = [
  { kind: "editor", inUse: 3, unitAmountCents: 2000 },
  { kind: "collaborator", inUse: 1, unitAmountCents: 500 },
];

const free: Billing = {
  plan: "free",
  seats,
  subscription: null,
  manageable: true,
  checkoutAvailable: true,
};

const team: Billing = {
  plan: "team",
  seats,
  subscription: {
    status: "active",
    trialEnd: null,
    currentPeriodEnd: "2030-10-15T12:00:00Z",
    cancelAtPeriodEnd: false,
    paymentFailedAt: null,
  },
  manageable: true,
  checkoutAvailable: false,
};

/** The glyph of the one button with `label` that the pane draws in a page. */
async function glyph(
  billing: Billing,
  label: string,
  location: ReturnType<typeof tabAt>,
) {
  const { BillingPane } = await import("../../settings/panes/billing-pane");
  answers.set("billing:", billing);
  try {
    const drawn = draw(
      recordingPage(location).page,
      createElement(BillingPane, { workspace }),
    ).buttons.filter((button) => button.label === label);
    assert.equal(drawn.length, 1, label);
    return drawn[0].icon;
  } finally {
    answers.delete("billing:");
  }
}

test("each Stripe action carries the external glyph in the window only", async () => {
  for (const [billing, label] of [
    [free, "Upgrade to Team"],
    [team, "Manage billing"],
  ] as const) {
    assert.equal(await glyph(billing, label, shellPage()), icons.external);
    assert.notEqual(await glyph(billing, label, tabAt()), icons.external);
  }
});

/** A write that records each trip it is asked to leave by. */
function recordingWrite(): { write: Write; trips: PageTrip[] } {
  const trips: PageTrip[] = [];
  const write = { leave: (...trip: PageTrip) => trips.push(trip) };
  return { write: write as unknown as Write, trips };
}

test("the window opens a Stripe page in the browser and a tab leaves for it", async () => {
  const { openStripe } = await import("../../settings/panes/billing-stripe");
  const address = "https://checkout.stripe.com/c/pay/cs_test";

  const shell = recordingPage(shellPage());
  const inShell = recordingWrite();
  withWindow(shell.page, () => openStripe(inShell.write, address));
  assert.deepEqual(shell.opened, [[address, "_blank", "noopener,noreferrer"]]);
  assert.deepEqual(inShell.trips, []);
  assert.deepEqual(shell.assigned, []);

  const tab = recordingPage(tabAt());
  const inTab = recordingWrite();
  withWindow(tab.page, () => openStripe(inTab.write, address));
  assert.deepEqual(tab.opened, []);
  assert.deepEqual(inTab.trips, [[address]]);
});
