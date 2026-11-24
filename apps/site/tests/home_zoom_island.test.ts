/**
 * The decisions of the home zoom island, as the Home zoom section of
 * docs/protocol/cloud/site-chrome.md and the Zoom of
 * docs/protocol/cloud/site-design-pages.md fix them: the control replaces
 * the depicted pill, each press zooms the home's main and its footer frame
 * at once, the pill keeps its place in the window, the window's centre keeps
 * its place above 100%, a button at its end does nothing, and each press
 * tells the other islands. Each case runs the island against the stub home
 * of `tests/helpers/home-zoom.ts`, whose layout gives the hand-worked
 * places. `tests/home_zoom.test.ts` checks the zoom steps, and the home zoom
 * browser spec checks the island against real layout.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { HOME_ZOOM_EVENT } from "../src/components/home/zoom.js";

import { openZoom } from "./helpers/home-zoom.js";

/** The scroll position at the page's end: 6000 + 300 - 900. */
const END = 5400;

test("on start the control replaces the depicted pill, at 100%", () => {
  const home = openZoom({ y: END });
  assert.deepEqual(home.shown(), {
    atEnd: [],
    control: true,
    depiction: false,
    zoom: "100%",
  });
  assert.deepEqual(home.drawn(), {
    parts: ["", ""],
    property: undefined,
    zoomedIn: false,
  });
  assert.deepEqual(home.log, [], "nothing moves at start");
});

test("each press zooms main and the footer frame at once, and above 100% the root grows the page", () => {
  const home = openZoom({ y: END });
  home.press("out");
  assert.equal(home.shown().zoom, "80%");
  assert.deepEqual(home.drawn(), {
    parts: ["0.8", "0.8"],
    property: "0.8",
    zoomedIn: false,
  });
  home.press("in");
  assert.equal(home.shown().zoom, "100%");
  assert.deepEqual(home.drawn(), {
    parts: ["", ""],
    property: undefined,
    zoomedIn: false,
  });
  home.press("in");
  assert.equal(home.shown().zoom, "125%");
  assert.deepEqual(home.drawn(), {
    parts: ["1.25", "1.25"],
    property: "1.25",
    zoomedIn: true,
  });
});

test("a button at its end of the range takes aria-disabled, and a press on it does nothing", () => {
  const home = openZoom({ y: END });
  home.press("in", 4);
  assert.deepEqual(home.shown().atEnd, ["in"]);
  assert.equal(home.shown().zoom, "200%");
  const before = [...home.log];
  home.press("in");
  assert.deepEqual(home.log, before, "no scroll and no event at the end");
  assert.equal(home.shown().zoom, "200%");
  assert.deepEqual(home.drawn().parts, ["2", "2"]);

  home.press("out");
  assert.deepEqual(home.shown().atEnd, [], "Zoom in leaves its end");
  // From 160%: two presses to 100%, twelve to 8%, and six that stop.
  home.press("out", 20);
  assert.deepEqual(home.shown().atEnd, ["out"]);
  assert.equal(home.shown().zoom, "8%");
});

test("after each press the pill keeps its place in the window, also where the browser anchors the scroll", () => {
  const end = openZoom({ y: END });
  assert.deepEqual(end.place(), { pill: 800, x: 0, y: 5400 });
  end.press("in");
  // At 125% the pill's top is 7700px down the page.
  assert.deepEqual(end.place(), { pill: 800, x: 125, y: 6900 });
  end.press("out");
  assert.deepEqual(end.place(), { pill: 800, x: 0, y: 5400 });
  end.press("out");
  // At 80% the page ends at 5100px, and the browser stops the scroll at 4200.
  assert.deepEqual(end.place(), { pill: 800, x: 0, y: 4200 });

  // WebKit first keeps the window's top at 4600 × 1.25 = 5750, with the pill
  // then at 1950, so the island scrolls on by 350.
  const anchored = openZoom({ anchors: true, y: 4600 });
  assert.equal(anchored.place().pill, 1600);
  anchored.press("in");
  assert.deepEqual(anchored.place(), { pill: 1600, x: 125, y: 6100 });
  anchored.press("out");
  assert.deepEqual(anchored.place(), { pill: 1600, x: 0, y: 4600 });
});

test("where the browser scrolls in whole pixels, a run of presses keeps the pill within a pixel of its place", () => {
  // At 850px the pill is 50px above its place at the page's end, so no step
  // from 100% to 26% and back reaches an end of the page. Most of those
  // steps leave a fraction of a pixel that the browser drops.
  const home = openZoom({ wholePixels: true, y: 5350 });
  const tops: number[] = [];
  for (const step of ["out", "in"] as const)
    for (let press = 0; press < 6; press += 1) {
      home.press(step);
      tops.push(Math.floor(home.place().pill));
    }
  assert.deepEqual(
    tops,
    Array.from({ length: 12 }, () => 850),
  );
});

test("above 100% the point of the content at the window's centre stays at the centre", () => {
  const home = openZoom({ y: END });
  home.press("in");
  // The centre, 500px into the window, is 625px into the content at 125%.
  assert.equal(home.place().x, 125);
  home.scrollSideways(200);
  home.press("in");
  // 700px at 125% is 560px of the content, which is 875px at 156.25%.
  assert.equal(home.place().x, 375);
  home.press("out");
  assert.equal(home.place().x, 200);
  home.press("out");
  assert.equal(home.place().x, 0, "at 100% the page does not scroll sideways");
});

test("each press that changes the zoom moves the page, then fires the zoom event once", () => {
  const home = openZoom({ y: END });
  home.press("in");
  assert.deepEqual(home.log, ["scroll 125 6900", `event ${HOME_ZOOM_EVENT}`]);
  home.press("in", 4);
  assert.equal(
    home.log.filter((entry) => entry === `event ${HOME_ZOOM_EVENT}`).length,
    4,
    "three more presses reach 200%, and the fourth does nothing",
  );
});

test("without the mark of a zoomed part the depicted pill stays", () => {
  const home = openZoom({ unmarked: true, y: END });
  assert.deepEqual(home.shown(), {
    atEnd: [],
    control: false,
    depiction: true,
    zoom: "100%",
  });
  home.press("in");
  assert.equal(home.shown().zoom, "100%");
  assert.deepEqual(home.log, []);
});
