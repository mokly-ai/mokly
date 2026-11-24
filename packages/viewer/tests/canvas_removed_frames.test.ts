import assert from "node:assert/strict";
import { test } from "node:test";

import {
  removedReadingView,
  removedScreenAddresses,
  removedScreenFrames,
  removedSectionAxes,
  type RemovedFramePlan,
} from "../src/shell/canvas_removed_frames.js";
import { BOTH_SCHEMES } from "../src/shell/frames_filter.js";

type Viewport = "desktop" | "mobile";
type Scheme = "dark" | "light";

/** A historical view of a removed screen, at its snapshot address. */
function view(viewport: Viewport, colorScheme: Scheme) {
  return {
    colorScheme,
    url: `https://catalogue.test/before/retired/index.${viewport}.${colorScheme}.html`,
    viewport,
  };
}

/** What a reader sees of each frame or place on the canvas. */
function shown(frames: readonly RemovedFramePlan<ReturnType<typeof view>>[]) {
  return frames.map((frame) => ({
    cell: [frame.column, frame.row],
    hidden: frame.hidden,
    label: frame.label,
    ...(frame.lightOnly ? { lightOnly: true } : {}),
    shows: frame.view
      ? `${frame.view.viewport} ${frame.view.colorScheme}`
      : `note, other ${frame.otherShown ? "shown" : "not shown"}`,
  }));
}

test("a removed screen's section holds Desktop beside Mobile, its Light row above its Dark row", () => {
  const views = [
    view("mobile", "light"),
    view("mobile", "dark"),
    view("desktop", "light"),
    view("desktop", "dark"),
  ];
  assert.deepEqual(
    shown(removedScreenFrames(views, { compact: false, viewport: "both" })),
    [
      {
        cell: [0, 0],
        hidden: false,
        label: "Desktop · Light",
        shows: "desktop light",
      },
      {
        cell: [1, 0],
        hidden: false,
        label: "Mobile · Light",
        shows: "mobile light",
      },
      {
        cell: [0, 1],
        hidden: false,
        label: "Desktop · Dark",
        shows: "desktop dark",
      },
      {
        cell: [1, 1],
        hidden: false,
        label: "Mobile · Dark",
        shows: "mobile dark",
      },
    ],
  );
  // The viewport choice keeps one column, and the other stays out of sight.
  assert.deepEqual(
    removedScreenFrames(views, { compact: false, viewport: "mobile" }).map(
      ({ column, hidden, key }) => [key, column, hidden],
    ),
    [
      ["desktop-light", 0, true],
      ["mobile-light", 0, false],
      ["desktop-dark", 0, true],
      ["mobile-dark", 0, false],
    ],
  );
});

test("without a historical dark view, the section holds its Light row alone", () => {
  assert.deepEqual(
    shown(
      removedScreenFrames([view("mobile", "light"), view("desktop", "light")], {
        compact: false,
        viewport: "both",
      }),
    ),
    [
      {
        cell: [0, 0],
        hidden: false,
        label: "Desktop · Light",
        shows: "desktop light",
      },
      {
        cell: [1, 0],
        hidden: false,
        label: "Mobile · Light",
        shows: "mobile light",
      },
    ],
  );
});

test("a viewport never captured holds its note in its frame's place, which asks to switch only while no frame of the other viewport shows", () => {
  const views = [view("desktop", "light")];
  assert.deepEqual(
    shown(removedScreenFrames(views, { compact: false, viewport: "both" })),
    [
      {
        cell: [0, 0],
        hidden: false,
        label: "Desktop · Light",
        shows: "desktop light",
      },
      {
        cell: [1, 0],
        hidden: false,
        label: "Mobile · Light",
        shows: "note, other shown",
      },
    ],
  );
  // The viewport choice hides Desktop, and the compact layout shows one frame.
  assert.deepEqual(
    shown(removedScreenFrames(views, { compact: false, viewport: "mobile" })),
    [
      {
        cell: [0, 0],
        hidden: true,
        label: "Desktop · Light",
        shows: "desktop light",
      },
      {
        cell: [0, 0],
        hidden: false,
        label: "Mobile · Light",
        shows: "note, other not shown",
      },
    ],
  );
  assert.equal(
    removedScreenFrames(views, { compact: true, viewport: "both" })[1]
      ?.otherShown,
    false,
  );
});

test("in the Dark row, a viewport without a dark view keeps its Light view and says so", () => {
  const views = [
    view("desktop", "light"),
    view("desktop", "dark"),
    view("mobile", "light"),
  ];
  const frames = removedScreenFrames(views, {
    compact: false,
    viewport: "both",
  });
  assert.deepEqual(shown(frames).at(-1), {
    cell: [1, 1],
    hidden: false,
    label: "Mobile · Dark",
    lightOnly: true,
    shows: "mobile light",
  });
  assert.equal(frames.at(-1)?.scheme, "light");
  // Each shown frame's document loads once, the fallback's included.
  assert.deepEqual(removedScreenAddresses(views, "both"), [
    view("desktop", "light").url,
    view("mobile", "light").url,
    view("desktop", "dark").url,
  ]);
  assert.deepEqual(removedScreenAddresses(views, "mobile"), [
    view("mobile", "light").url,
  ]);
});

test("a removed document's reading frame shows its version of the preview scheme, or its Light version", () => {
  const light = { colorScheme: "light" as const, url: "terms.html" };
  const dark = { colorScheme: "dark" as const, url: "terms.dark.html" };
  const both = { kind: "document" as const, views: [light, dark] };
  assert.deepEqual(removedReadingView(both, "dark"), dark);
  assert.deepEqual(removedReadingView(both, "light"), light);
  assert.deepEqual(
    removedReadingView({ kind: "document", views: [light] }, "dark"),
    light,
  );
  assert.deepEqual(
    removedReadingView({ kind: "page", url: "handbook.html" }, "dark"),
    { colorScheme: "light", url: "handbook.html" },
  );
});

test("a removed screen's section shows the selection's viewport, and its compact frame a scheme that the Frames filter shows", () => {
  const selection = { colorScheme: "light", viewport: "desktop" } as const;
  assert.deepEqual(removedSectionAxes(BOTH_SCHEMES, selection, false), {
    colorScheme: "light",
    viewport: "desktop",
  });
  assert.deepEqual(
    removedSectionAxes({ dark: true, light: false }, selection, false),
    { colorScheme: "dark", viewport: "desktop" },
  );
  // The wide canvas shows the columns of the selection's viewport.
  assert.equal(
    removedSectionAxes(BOTH_SCHEMES, selection, true).viewport,
    "desktop",
  );
  assert.equal(
    removedSectionAxes(BOTH_SCHEMES, { ...selection, viewport: "both" }, true)
      .viewport,
    "both",
  );
});
