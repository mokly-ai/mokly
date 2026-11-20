import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import { billing, seatAmounts, trialDays } from "../fixtures/product-states";

const contract = readFileSync(
  resolve(import.meta.dirname, "../../../protocol/cloud/billing.md"),
  "utf8",
);

/** One Markdown section, without letting a later table satisfy an assertion. */
function section(heading: string, next: string): string {
  const start = contract.indexOf("## " + heading);
  const end = contract.indexOf("## " + next, start + 1);
  assert.ok(start >= 0, heading + " section");
  assert.ok(end > start, next + " section");
  return contract.slice(start, end);
}

/** Compare copy without typography that only closes the sentence. */
function sentence(text: string): string {
  return text.trim().replace(/[.…]+$/u, "");
}

test("billing fixture amounts and trial follow the Plan Catalogue", () => {
  const catalogue = section("Plan Catalogue", "Seats");
  const amounts =
    /Editor `(\d+)` USD cents, Collaborator `(\d+)` USD cents/.exec(catalogue);
  assert.ok(amounts, "seat prices");
  assert.deepEqual(seatAmounts, {
    editor: Number(amounts[1]),
    collaborator: Number(amounts[2]),
  });
  const trial = /\| Trial\s+\| `(\d+)` days/.exec(catalogue);
  assert.ok(trial, "trial length");
  assert.equal(trialDays, Number(trial[1]));
});

/** Markdown table rows keyed by the state in their first cell. */
function copyRows(copy: string): Map<string, string> {
  return new Map(
    [...copy.matchAll(/^\|\s*([^|]+?)\s*\|\s*(.*?)\s*\|$/gm)]
      .map((match) => [match[1].trim(), match[2]] as const)
      .filter(([state]) => state !== "State" && !state.startsWith("---")),
  );
}

/**
 * Copy-table rows another pane owns, which the Billing fixture therefore does
 * not quote: the deletion confirmation belongs to Danger. Named rather than
 * sliced off the end, so a row added to the table is checked against the
 * fixture unless somebody decides it belongs elsewhere — a slice let two rows
 * the fixture does hold go unchecked, and would have hidden every row appended
 * after them. Each name must still be a row, so an exclusion cannot outlive it.
 */
const otherPanes = new Set(["Delete workspace on Team"]);

test("billing fixture and the Copy table quote the same pane sentences", () => {
  const copy = contract.slice(contract.indexOf("## Copy"));
  const quoted = [...copy.matchAll(/"([^"]+)"/g)].map((match) =>
    sentence(match[1]),
  );
  assert.ok(quoted.length > 0, "quoted copy");
  for (const [name, value] of Object.entries(billing.copy))
    assert.ok(quoted.includes(sentence(value)), name + ": " + value);

  const fixture = Object.values(billing.copy).map(sentence);
  for (const [state, text] of copyRows(copy)) {
    if (otherPanes.has(state)) continue;
    for (const match of text.matchAll(/"([^"]+)"/g)) {
      // Date placeholders are templates rather than exact fixture sentences.
      if (match[1].includes("<")) continue;
      assert.ok(fixture.includes(sentence(match[1])), state + ": " + match[1]);
    }
  }
  for (const state of otherPanes) assert.ok(copyRows(copy).has(state), state);
});
