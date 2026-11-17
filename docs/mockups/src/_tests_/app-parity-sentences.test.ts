import assert from "node:assert/strict";
import { test } from "node:test";

import {
  droppedSentences,
  ownerOf,
  parityPages,
  sentences,
} from "./app-owners";
import type { ScreenId } from "./app-owners";
import { allowedSentences, assertOwned } from "./app-parity-allowances";
import {
  declarationHolds,
  droppedPresence,
  saysSentence,
  sentencePresence,
} from "./app-parity-sentences";

test("a page no label can compare is compared by what it says", () => {
  for (const [screen, said] of Object.entries(sentences)) {
    const owner = ownerOf(screen as ScreenId);
    assert.ok(owner.files, screen + " declares no owner");
    const pages = parityPages().filter((page) => page.screen === screen);
    assert.ok(pages.length > 0, screen + " draws no page");
    for (const declaration of said) {
      const sentence =
        typeof declaration === "string" ? declaration : declaration.sentence;
      const presence = sentencePresence(screen as ScreenId, declaration);
      assert.ok(
        presence.declared,
        sentence + ": the named constant no longer holds the expected copy",
      );
      assert.deepEqual(
        presence.pages.sort(),
        pages.map((page) => page.id).sort(),
        screen + " does not draw " + sentence + " on every page",
      );
      const allowance = allowedSentences.find(
        (entry) => entry.screen === screen && entry.sentence === sentence,
      );
      if (allowance === undefined)
        assert.ok(presence.written, screen + " does not write " + sentence);
      else
        assert.equal(
          presence.written,
          false,
          "the application caught up; drop the sentence allowlist line: " +
            sentence,
        );
    }
  }
  for (const entry of allowedSentences) {
    const declared = sentences[entry.screen as ScreenId] ?? [];
    assert.ok(
      declared.some(
        (declaration) =>
          (typeof declaration === "string"
            ? declaration
            : declaration.sentence) === entry.sentence,
      ),
      "the sentence allowlist names a sentence no screen declares: " +
        entry.sentence,
    );
    assertOwned(entry.todo, entry.sentence);
  }
});

test("sentences dropped from the catalogue stay out of the application", () => {
  for (const [screen, dropped] of Object.entries(droppedSentences)) {
    const pages = parityPages().filter((page) => page.screen === screen);
    assert.ok(pages.length > 0, screen + " draws no page");
    for (const entry of dropped) {
      const said = typeof entry === "string" ? entry : entry.sentence;
      const presence = droppedPresence(screen as ScreenId, entry);
      assert.ok(
        presence.declared,
        said +
          ": the constant named no longer holds it, so the search below " +
          "looks for a name nothing answers to",
      );
      assert.deepEqual(presence.pages, [], screen + " still draws " + said);
      assert.equal(presence.written, false, screen + " still says " + said);
    }
  }
});

test("a declared sentence is found wherever the product would keep it", () => {
  const dropped = droppedSentences["product/account/project-created"];
  assert.ok(dropped, "the declaration this check is written against is gone");
  const declaration = dropped[0];
  // The screen this guard was written for drew the constant and none of the
  // sentence's words, which a search for the literal alone passed.
  assert.equal(
    saysSentence('<p className="fo-copy">{publicOnFree}</p>', declaration),
    true,
  );
  assert.equal(
    saysSentence("<p>Projects are public on the free plan.</p>", declaration),
    true,
  );
  // A longer name is another constant, and a screen that says neither is clear.
  assert.equal(saysSentence("<p>{publicOnFreePlan}</p>", declaration), false);
  assert.equal(saysSentence("<p>{planLabel(plan)}</p>", declaration), false);
});

test("positive sentence constants keep exact live bindings", () => {
  const declared = sentences["product/settings/billing/admin"]?.[0];
  assert.ok(declared && typeof declared !== "string");
  assert.equal(
    saysSentence('<p className="fo-copy">{ownerManagesBilling}</p>', declared),
    true,
  );
  assert.equal(
    saysSentence("<p>{ownerManagesBillingLabel}</p>", declared),
    false,
  );
  assert.equal(declarationHolds(declared), true);
  assert.equal(
    declarationHolds({ ...declared, sentence: "Owners manage billing." }),
    false,
  );
  assert.equal(
    declarationHolds({
      ...declared,
      constant: { ...declared.constant, name: "missingBillingOwnerCopy" },
    }),
    false,
  );
});
