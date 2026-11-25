/**
 * The decisions of the measurements island, which writes the rendered size,
 * font size or gap that each measured size tag, type badge and redline value
 * shows, as docs/protocol/cloud/site-design-components.md and
 * docs/protocol/cloud/site-delivery-islands.md fix them. Each case runs the
 * island against the stub page of `tests/helpers/measurements.ts`, whose
 * targets lie where `TARGETS` puts them. The browser spec of the page that
 * draws the parts checks the values against real layout.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  measureGap,
  measureSize,
  measureType,
} from "../src/components/measurements.js";

import {
  type Drawing,
  type Layout,
  type StubPage,
  openPage,
} from "./helpers/measurements.js";

/** Fractions of a pixel that binary floating point holds exactly. */
const TARGETS: Readonly<Record<string, Layout>> = {
  download: { height: 48, left: 250.25, top: 406, width: 180 },
  lead: { height: 69, left: 78, top: 302.125, width: 690 },
  start: { height: 48, left: 78, top: 406, width: 160.625 },
  title: {
    fontSize: "161.625px",
    height: 155.625,
    left: 78,
    top: 86.25,
    width: 1033.375,
  },
};

test("each measured part shows the rounded size, font size or gap of its targets", () => {
  const page = openPage(TARGETS, [
    { attributes: measureSize("title") },
    { attributes: measureType("title"), badge: "Geist Semibold " },
    { attributes: measureGap("vertical", "title", "lead") },
    { attributes: measureGap("horizontal", "start", "download") },
  ]);
  assert.deepEqual(page.shown(), [null, null, null, null], "before a frame");
  page.frame();
  assert.deepEqual(page.shown(), [
    "1033 × 156",
    "Geist Semibold 162",
    "60",
    "12",
  ]);
  assert.deepEqual(page.errors, []);
});

test("a resize of a target or of the window, a change of the home's zoom or the loaded fonts rewrite a value in the next frame", async () => {
  const cases: ReadonlyArray<{
    name: string;
    change: (page: StubPage) => Promise<void> | void;
    shown: readonly string[];
  }> = [
    {
      name: "an observed resize of the title",
      change: (page) => {
        page.move("title", { width: 1040.75 });
        page.resize("title");
      },
      shown: ["1041 × 156", "60"],
    },
    {
      name: "a window resize that moves the lead",
      change: (page) => {
        page.move("lead", { top: 310.125 });
        page.resizeWindow();
      },
      shown: ["1033 × 156", "68"],
    },
    {
      name: "a change of the home's zoom that moves the lead",
      change: (page) => {
        page.move("lead", { top: 306.125 });
        page.changeZoom();
      },
      shown: ["1033 × 156", "64"],
    },
    {
      name: "fonts that set the title shorter",
      change: async (page) => {
        page.move("title", { height: 158.25 });
        await page.loadFonts();
      },
      shown: ["1033 × 158", "58"],
    },
  ];
  for (const { name, change, shown } of cases) {
    const page = openPage(TARGETS, [
      { attributes: measureSize("title") },
      { attributes: measureGap("vertical", "title", "lead") },
    ]);
    page.frame();
    await change(page);
    assert.deepEqual(page.shown(), ["1033 × 156", "60"], `${name}: no frame`);
    page.frame();
    assert.deepEqual(page.shown(), shown, name);
    assert.deepEqual(page.errors, [], name);
  }
});

test("at any zoom of the home each part shows its target's own CSS pixels, not the scaled ones", () => {
  // A heading half a pixel from whole ones, 879.5px by 131.5px, shows
  // 880 × 132 at every zoom. At 80% a browser draws its width as
  // 703.5999755859375px, which is less than 879.5px times 0.8.
  const heading: Layout = { height: 131.5, left: 78, top: 86.25, width: 879.5 };
  const drawings: readonly Drawing[] = [
    { scale: 2 },
    { scale: 0.8 },
    { scale: 0.4096 },
  ];
  for (const drawing of drawings) {
    const page = openPage(
      { ...TARGETS, heading },
      [
        { attributes: measureSize("title") },
        { attributes: measureSize("heading") },
        { attributes: measureType("title"), badge: "Geist Semibold " },
        { attributes: measureGap("vertical", "title", "lead") },
        { attributes: measureGap("horizontal", "start", "download") },
      ],
      drawing,
    );
    page.frame();
    assert.deepEqual(
      page.shown(),
      ["1033 × 156", "880 × 132", "Geist Semibold 162", "60", "12"],
      JSON.stringify(drawing),
    );
    assert.deepEqual(page.errors, [], JSON.stringify(drawing));
  }
});

test("a part with a missing target stays hidden, and the others still show", () => {
  const page = openPage(TARGETS, [
    { attributes: measureSize("gone") },
    { attributes: measureType("gone"), badge: "Geist Semibold " },
    { attributes: measureGap("vertical", "title", "gone") },
    { attributes: measureGap("horizontal", undefined, "download") },
    { attributes: measureSize("title") },
  ]);
  page.frame();
  assert.deepEqual(page.shown(), [null, null, null, null, "1033 × 156"]);
  assert.deepEqual(page.errors, []);
});
