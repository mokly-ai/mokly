import assert from "node:assert/strict";
import { test } from "node:test";

import {
  causes,
  fieldRefusals,
  notices,
  placeholders,
} from "../fixtures/product-states";

import { appSource } from "./app-parity-reads";

/**
 * Where each sentence the fixtures borrow is written in the product. One home
 * per sentence, because a fallback across three files lets a sentence move out
 * of one of them without anything noticing. `quoted` says whether the product
 * writes it as a string literal or as the text of an element.
 */
const causeHomes: Record<
  keyof typeof causes,
  { file: string; quoted: boolean }
> = {
  busy: { file: "api/form-error.ts", quoted: true },
  permission: { file: "api/form-error.ts", quoted: true },
  duplicate: { file: "api/form-error.ts", quoted: true },
  clipboard: { file: "settings/panes/tokens-create.tsx", quoted: true },
  planRequired: { file: "api/form-error.ts", quoted: true },
  closedPullRequest: { file: "api/form-error.ts", quoted: true },
  buildsUnavailable: { file: "api/labels.ts", quoted: true },
};

/**
 * Where each sentence a screen says beside a control, and is not a refusal, is
 * written. A notice offers no way back, so it is never the fragment's cause;
 * it still has to be the product's own words.
 */
const noticeHomes: Record<
  keyof typeof notices,
  { file: string; quoted: boolean }
> = {
  githubOpensSoon: {
    file: "screens/account/entry-screen.tsx",
    quoted: false,
  },
};

/**
 * Where each sentence a field draws is written. A form declares its own beside
 * the ownership it declares, so the sentence belongs to the one form drawing
 * it rather than to the shared copy every other form keeps.
 */
const fieldHomes: Record<
  keyof typeof fieldRefusals,
  { file: string; quoted: boolean }
> = {
  email: { file: "screens/account/entry-screen.tsx", quoted: true },
  tokenName: { file: "api/form-error.ts", quoted: true },
};

test("fixture copy is the application's own copy", () => {
  for (const [name, sentence] of Object.entries(causes)) {
    const home = causeHomes[name as keyof typeof causes];
    const text = appSource(home.file);
    assert.ok(
      text.includes(home.quoted ? '"' + sentence + '"' : sentence),
      name + " belongs to " + home.file,
    );
  }
  assert.ok(
    appSource("settings/panes/account-pane.tsx").includes(
      '"' + placeholders.name + '"',
    ),
  );
  for (const [name, sentence] of Object.entries(notices)) {
    const home = noticeHomes[name as keyof typeof notices];
    assert.ok(
      appSource(home.file).includes(
        home.quoted ? '"' + sentence + '"' : sentence,
      ),
      name + " belongs to " + home.file,
    );
  }
  for (const [name, sentence] of Object.entries(fieldRefusals)) {
    const home = fieldHomes[name as keyof typeof fieldRefusals];
    assert.ok(
      appSource(home.file).includes(
        home.quoted ? '"' + sentence + '"' : sentence,
      ),
      name + " belongs to " + home.file,
    );
  }
});
