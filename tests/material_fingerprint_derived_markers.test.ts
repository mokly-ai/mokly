import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { fingerprintComparison } from "./helpers/fingerprint_comparison.js";
import { assertGuardedMaterials } from "./helpers/fingerprint_guard_assertions.js";
import { inlineChangesFixture } from "./helpers/inline_changes.js";
import { pageFixtureInput } from "./helpers/page_fixture_inputs.js";

const style = "<style>.entry{color:red}</style>";
const digest = createHash("sha256").update(style).digest("base64url");
const region = (id: string, text: string) =>
  `<!--mokly-review-ignore:start:${id}-->${text}<!--mokly-review-ignore:end:${id}-->`;
const signal = `<!--mokly-review-material:clock:${"a".repeat(64)}-->`;
const material = (id: string) =>
  `<!--mokly-review-material:${id}:${"a".repeat(64)}-->`;
const collision = (id: string) =>
  `<!--mokly-in<!--mokly-review-mate${region("z", `rial:${id}:${"a".repeat(64)}-->`)}line-style:${digest}-->`;
const shared = region("x", "X") + region("y", "Y");
const derivedSignal = `<!--mokly-review-mate${region("join", `rial:clock:${"a".repeat(64)}-->`)}`;

for (const mode of ["committed", "derived"] as const)
  for (const [name, before, after] of [
    [
      "nested derived-signal collision",
      style + collision("y") + shared + material("x") + material("z"),
      collision("x") + style + shared + material("y"),
    ],
    [
      "unfinished derived marker",
      `<${style}!--mokly-review-ignore:start:x`,
      `<${style.replace("red", "blue")}!--mokly-review-ignore:start:x`,
    ],
    [
      "derived plain inline prefix",
      `${style}${signal}${region("clock", "same")}`,
      `${style}mokly-in${derivedSignal}line-style:${digest}-->${region("clock", "same")}`,
    ],
  ])
    test(`${mode}: ${name} retains delivered text/validation`, async (context) => {
      assert.ok(
        !before!.includes("mokly-inline-") && !after!.includes("mokly-inline-"),
      );
      const fixture = await inlineChangesFixture(context, before!, after!, {
        colorSchemes: false,
      });
      const input = await pageFixtureInput(fixture, mode);
      const text = await fingerprintComparison(input, false);
      if (name === "nested derived-signal collision") {
        assert.equal(text.kind, "result");
        if (text.kind === "result") {
          assert.equal(text.result.view.state, "changed");
          assert.equal(text.result.view.material, true);
        }
      }
      if (name === "unfinished derived marker") {
        assert.equal(text.kind, "error");
        if (text.kind === "error")
          assert.match(text.message, /malformed or unterminated marker/);
      }
      await assertGuardedMaterials(input, name!);
    });
