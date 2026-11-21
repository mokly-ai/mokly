import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CURRENCY,
  SEAT_PRICES_CENTS,
  TEAM_SEATS,
  TRIAL_DAYS,
} from "../src/components/pricing/plan-facts.js";
import { repositoryPath } from "../src/workspace.js";

/** The verified plan catalogue: the `CATALOGUE` constant of the Rust domain. */
async function catalogueSource(): Promise<string> {
  const source = await readFile(
    repositoryPath("crates/mkc-domain/src/billing.rs"),
    "utf8",
  );
  const start = source.indexOf("pub const CATALOGUE: Catalogue");
  assert.ok(start >= 0, "mkc_domain::billing declares CATALOGUE");
  return source.slice(start, source.indexOf("\n};", start));
}

/** A Rust integer literal, such as `2_000`, as a number. */
function integer(literal: string | undefined, label: string): number {
  assert.ok(literal, `CATALOGUE declares ${label}`);
  return Number(literal.replaceAll("_", ""));
}

test("the pricing page states the seat prices, trial and currency of the verified plan catalogue", async () => {
  const catalogue = await catalogueSource();
  const cents = (kind: string) =>
    integer(
      new RegExp(
        `kind: SeatKind::${kind},\\s*unit_amount_cents: ([\\d_]+)`,
      ).exec(catalogue)?.[1],
      `the ${kind} seat price`,
    );
  assert.deepEqual(SEAT_PRICES_CENTS, {
    collaborator: cents("Collaborator"),
    editor: cents("Editor"),
  });
  assert.equal(
    TRIAL_DAYS,
    integer(/trial_days: ([\d_]+)/.exec(catalogue)?.[1], "the trial length"),
  );
  assert.equal(CURRENCY, /currency: "([a-z]+)"/.exec(catalogue)?.[1]);
  // The page shows each seat's price in whole dollars, as the catalogue sets
  // it in cents.
  assert.deepEqual(
    TEAM_SEATS.map(({ amount, kind }) => [kind, amount]),
    [
      ["Editor", `$${cents("Editor") / 100}`],
      ["Collaborator", `$${cents("Collaborator") / 100}`],
    ],
  );
});
