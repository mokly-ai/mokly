import test from "node:test";

import {
  assertStyleRoute,
  styleRouteFixture,
  withHeadStyles,
} from "./helpers/style_route.js";

test("style route rejects markup, ineligible spans and child-content selectors", async (context) => {
  const fixture = await styleRouteFixture(context);
  const style = (text: string) => `<style>${text}</style>`;
  const before = style(".entry{color:red}");
  const after = style(".entry{color:blue}");
  for (const [name, left, right] of [
    ["tag edit", before, before.replace("<style>", "<STYLE>")],
    ["end-tag edit", before, before.replace("</style>", "</STYLE>")],
    ["attribute edit", before, before.replace("<style>", '<style id="sheet">')],
    ["markup edit", `${before}<meta name="old">`, `${after}<meta name="new">`],
    ["multiple edited elements", before + before, after + after],
    [
      "media style",
      before.replace("<style>", '<style media="screen">'),
      after.replace("<style>", '<style media="screen">'),
    ],
    [
      "non-css type",
      before.replace("<style>", '<style type="text/plain">'),
      after.replace("<style>", '<style type="text/plain">'),
    ],
    [
      "inert style",
      `<template>${before}</template>`,
      `<template>${after}</template>`,
    ],
    ["foreign style", `<svg>${before}</svg>`, `<svg>${after}</svg>`],
    [
      "unchanged parse failure",
      style(".broken{") + before,
      style(".broken{") + after,
    ],
  ])
    await context.test(name!, async () => {
      await assertStyleRoute(
        withHeadStyles(fixture, left!, right!),
        "complete",
      );
    });
  for (const selector of [
    ".entry:empty",
    "style:parent ~ main",
    'style:contains("red") ~ main',
    'style:icontains("RED") ~ main',
    ".entry:not(:empty)",
    ".entry:is(:parent)",
    'main:has(style:contains("red"))',
    'main:where(:icontains("red"))',
    ".entry:nth-child(1 of :parent)",
  ])
    await context.test(selector, async () => {
      await assertStyleRoute(
        withHeadStyles(
          fixture,
          style(`${selector}{color:red}`),
          style(`${selector}{color:blue}`),
        ),
        "complete",
      );
    });
  for (const parent of [
    ":empty",
    ":parent",
    ':contains("red")',
    ':icontains("red")',
  ])
    await context.test(`nesting parent ${parent}`, async () => {
      await assertStyleRoute(
        withHeadStyles(
          fixture,
          style(`style${parent}{& ~ main{color:red}}`),
          style(`style${parent}{& ~ main{color:blue}}`),
        ),
        "complete",
      );
    });
  // Bypass the earlier quick check to exercise the style route's span guards.
  const ignore = (text: string) =>
    `<!--mokly-review-ignore:start:clock-->${text}<!--mokly-review-ignore:end:clock-->`;
  for (const [name, left, right] of [
    ["style within paired ignore", ignore(before), ignore(after)],
    [
      "window within raw paired ignore",
      style(`.entry{color:/*${ignore("red")}*/red}`),
      style(`.entry{color:/*${ignore("blue")}*/red}`),
    ],
    [
      "material signal",
      style(
        `/*<!--mokly-review-material:clock:${"a".repeat(64)}-->*/.entry{color:red}`,
      ) + ignore("same"),
      style(
        `/*<!--mokly-review-material:clock:${"b".repeat(64)}-->*/.entry{color:red}`,
      ) + ignore("same"),
    ],
  ])
    await context.test(name!, async () => {
      await assertStyleRoute(
        withHeadStyles(fixture, left!, right!),
        "complete",
        "home",
        false,
      );
    });
});
