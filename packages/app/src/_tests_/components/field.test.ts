import assert from "node:assert/strict";
import { test } from "node:test";

import { createElement } from "react";

import { tabAt } from "../page-window";
import { draw, recordingPage } from "../server-render";

/**
 * A slug or another identifier is typed exactly: the keyboard neither
 * capitalises, corrects nor marks it. Prose keeps the keyboard's help.
 */

/** The keyboard attributes of the one input a Field of `type` draws. */
async function keyboard(type: "identifier" | "text") {
  const { Field } = await import("../../components/field");
  const { html } = draw(
    recordingPage(tabAt()).page,
    createElement(Field, {
      label: "Slug",
      name: "slug",
      type,
      value: "acme",
      onChange: () => undefined,
    }),
  );
  const inputs = html.match(/<input [^>]*>/g) ?? [];
  assert.equal(inputs.length, 1, type);
  const attribute = (name: string) =>
    new RegExp(` ${name}="([^"]*)"`).exec(inputs[0])?.[1];
  return {
    autoCapitalize: attribute("autoCapitalize"),
    autoCorrect: attribute("autoCorrect"),
    spellCheck: attribute("spellCheck"),
  };
}

test("an identifier field is never rewritten by the keyboard", async () => {
  assert.deepEqual(await keyboard("identifier"), {
    autoCapitalize: "none",
    autoCorrect: "off",
    spellCheck: "false",
  });
});

test("a prose field keeps the keyboard's capitals, corrections and spelling", async () => {
  assert.deepEqual(await keyboard("text"), {
    autoCapitalize: "sentences",
    autoCorrect: "on",
    spellCheck: "true",
  });
});
