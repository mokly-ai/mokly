/**
 * The decisions of the home demos island, as
 * docs/protocol/cloud/site-delivery-islands.md and the Specs panel of
 * docs/protocol/cloud/site-design-pages.md fix them. The Specs scroll spy
 * marks the row of the section in view, and the demos wait armed out of view
 * and play once in view. Each case runs the spy or the demos against the
 * stub page of `tests/helpers/home-island.ts`. The home browser spec checks
 * the spy against real layout.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  type Tops,
  openDemos,
  openSpy,
  stubDemo,
} from "./helpers/home-island.js";

/** The sections when the reader has scrolled into the Review module. */
const AT_REVIEW: Tops = {
  hero: -2400,
  features: -1600,
  browse: -700,
  review: 450,
  edit: 451,
  foundation: 2200,
  footer: 4100,
};

test("the row of the last section whose top passed 45% of the window is current", () => {
  const page = openSpy({
    innerHeight: 1000,
    scrollHeight: 9000,
    scrollY: 2600,
    tops: AT_REVIEW,
  });
  assert.equal(page.frame(), 1);
  assert.deepEqual(page.current(), {
    attribute: ["review"],
    class: ["review"],
  });
});

test("at the end of the page the Footer row is current", () => {
  const tops: Tops = {
    hero: -8000,
    features: -7200,
    browse: -6300,
    review: -4400,
    edit: -2600,
    foundation: -300,
    footer: 520,
  };
  const end = openSpy({
    innerHeight: 1000,
    scrollHeight: 9004,
    scrollY: 8000,
    tops,
  });
  end.frame();
  assert.deepEqual(end.current(), { attribute: ["footer"], class: ["footer"] });

  const short = openSpy({
    innerHeight: 1000,
    scrollHeight: 9005,
    scrollY: 8000,
    tops,
  });
  short.frame();
  assert.deepEqual(short.current(), {
    attribute: ["foundation"],
    class: ["foundation"],
  });
});

test("the spy reads the layout again on scroll, resize and a zoom change, once a frame", () => {
  const top: Tops = {
    hero: 0,
    features: 1100,
    browse: 1900,
    review: 3800,
    edit: 5600,
    foundation: 7700,
    footer: 9100,
  };
  const page = openSpy({
    innerHeight: 1000,
    scrollHeight: 10000,
    scrollY: 0,
    tops: top,
  });
  assert.equal(page.frame(), 1);
  assert.deepEqual(page.current(), { attribute: ["hero"], class: ["hero"] });

  const below: Tops = { ...top, hero: -800, features: 300, browse: 1100 };
  page.scroll(below, 800);
  page.scroll(below, 800);
  page.resize(1000);
  assert.equal(page.frame(), 1, "three events wait for one frame");
  assert.deepEqual(page.current(), {
    attribute: ["features"],
    class: ["features"],
  });

  page.resize(600);
  assert.equal(page.frame(), 1);
  assert.deepEqual(page.current(), { attribute: ["hero"], class: ["hero"] });

  // A press of the zoom pill moves the sections with no scroll and no
  // resize: Zoom in moves Features below the window's 45% line, and Zoom
  // out brings Browse above it.
  page.resize(1000);
  page.frame();
  page.zoom({ ...below, features: 600, browse: 1400 });
  assert.equal(page.frame(), 1);
  assert.deepEqual(page.current(), { attribute: ["hero"], class: ["hero"] });
  page.zoom({ ...below, features: 200, browse: 300 });
  assert.equal(page.frame(), 1);
  assert.deepEqual(page.current(), {
    attribute: ["browse"],
    class: ["browse"],
  });
});

test("a demo out of view waits armed and plays once it comes into view", () => {
  const demo = stubDemo(1500, 600);
  const page = openDemos([demo], { innerHeight: 900 });
  assert.equal(demo.state, "armed");
  assert.deepEqual(page.observed(), [demo]);

  page.report(demo, 0.3, 180);
  assert.equal(demo.state, "armed", "30% of a demo is not yet in view");
  page.report(demo, 0.35, 210);
  assert.equal(demo.state, "play");
  assert.deepEqual(page.observed(), [], "a demo plays once");
});

test("a demo in view at start stays as built", () => {
  const seen = stubDemo(600, 600);
  const below = stubDemo(1500, 600);
  const page = openDemos([seen, below], { innerHeight: 900 });
  assert.equal(seen.state, undefined);
  assert.equal(below.state, "armed");
  assert.deepEqual(page.observed(), [below]);
});

test("a demo taller than the window plays once it fills 35% of its height", () => {
  const tall = stubDemo(1000, 3000);
  const page = openDemos([tall], { innerHeight: 900 });
  page.report(tall, 0.1, 300);
  assert.equal(tall.state, "armed", "300px is less than 35% of 900px");
  page.report(tall, 0.15, 450);
  assert.equal(tall.state, "play");
});

test("under reduced motion, or without an observer, no demo takes a state", () => {
  for (const setting of [
    { innerHeight: 900, reduced: true },
    { innerHeight: 900, observer: false },
  ]) {
    const demo = stubDemo(1500, 600);
    const page = openDemos([demo], setting);
    assert.equal(demo.state, undefined, JSON.stringify(setting));
    assert.equal(page.made, 0, JSON.stringify(setting));
  }
});

test("asking for reduced motion shows every waiting demo finished at once", () => {
  const waiting = stubDemo(1500, 600);
  const page = openDemos([waiting], { innerHeight: 900 });
  assert.equal(waiting.state, "armed");
  page.reduceMotion();
  assert.equal(waiting.state, undefined);
  assert.deepEqual(page.observed(), []);
});
