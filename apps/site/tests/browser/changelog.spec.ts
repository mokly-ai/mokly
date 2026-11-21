import { expect, test } from "@playwright/test";

import { SITE_PATHS } from "../../src/navigation.js";

import {
  DESKTOP,
  FULL_FRAMES,
  NOTE_ROWS,
  RELEASES,
  choose,
  filter,
  frame,
  history,
  lists,
  notes,
  row,
  size,
  status,
} from "./changelog.js";

/**
 * The changelog page in a real browser: the release frames, the note filter
 * and its status, a link to a release that the filter hides, the release in
 * view and a link into a closed disclosure. changelog-layout.spec.ts holds
 * the layout and the page without script, and the page walk of
 * pages.spec.ts checks its title, its heading and the shared accessibility
 * rules; tests/changelog.test.ts checks the releases that the page draws.
 */

test(
  "every release draws as a frame, newest first, and the older ones as Earlier releases",
  DESKTOP,
  async ({ page }) => {
    await page.goto(SITE_PATHS.changelog);
    const [newest] = RELEASES;
    if (newest === undefined) throw new Error("the changelog has no release");
    await expect(page.getByRole("main").getByRole("article")).toHaveCount(
      RELEASES.length,
    );
    const first = page.getByRole("main").getByRole("article").first();
    await expect(first).toHaveAccessibleName(`Mokly CLI ${newest.version}`);
    await expect(first.locator("time")).toHaveAttribute(
      "datetime",
      newest.date,
    );
    await expect(first.locator("time")).toHaveText(newest.readableDate);
    await expect(first.getByText("Latest", { exact: true })).toBeVisible();
    await expect(
      first.getByRole("link", { name: "Read release details" }),
    ).toHaveAttribute("href", newest.link ?? "");
    await expect(
      page
        .getByRole("group", { name: "Earlier releases" })
        .getByRole("article"),
    ).toHaveCount(RELEASES.length - FULL_FRAMES);
    for (const release of RELEASES.filter((each) => each.link === null))
      await expect(
        frame(page, release.version).getByRole("link", {
          name: "Read release details",
        }),
      ).toHaveCount(0);
  },
);

test(
  "a filter choice shows only its notes and the releases that list them",
  DESKTOP,
  async ({ page }) => {
    await page.goto(SITE_PATHS.changelog);
    await expect(status(page)).toHaveText(
      `${notes()} notes in ${RELEASES.length} releases`,
    );
    const quiet = RELEASES.find(
      (release) => lists(release, "breaking") && lists(release, "features"),
    );
    if (quiet === undefined) throw new Error("no release lists both groups");
    const chip = frame(page, quiet.version)
      .getByRole("link", { name: /^Features \d+$/ })
      .locator(".site-chip");
    const shown = await chip.evaluate(
      (node) => getComputedStyle(node).backgroundColor,
    );

    await choose(page, "Breaking");
    await expect(
      filter(page).getByRole("radio", { name: /^Breaking \d+$/ }),
    ).toBeChecked();
    const listed = RELEASES.filter((release) => lists(release, "breaking"));
    await expect(status(page)).toHaveText(
      `${notes("breaking")} breaking changes in ${listed.length} releases`,
    );
    for (const release of RELEASES)
      await expect(frame(page, release.version), release.version).toBeVisible({
        visible: listed.includes(release),
      });
    await expect(page.locator(NOTE_ROWS).filter({ visible: true })).toHaveCount(
      notes("breaking"),
    );
    await expect(
      page
        .getByRole("main")
        .getByRole("heading", { level: 3 })
        .filter({ hasNotText: /^(Breaking changes \d+|Upgrade notes)$/ }),
    ).toHaveCount(0);
    // The chip of a group that the filter hides goes quiet: it drops its fill.
    await expect(chip).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

    await choose(page, "All");
    await expect(status(page)).toHaveText(
      `${notes()} notes in ${RELEASES.length} releases`,
    );
    await expect(
      page.getByRole("main").getByRole("article").filter({ visible: true }),
    ).toHaveCount(RELEASES.length);
    await expect(chip).toHaveCSS("background-color", shown);
  },
);

test(
  "a link to a release that the filter hides returns the filter to All",
  DESKTOP,
  async ({ page }) => {
    await page.goto(SITE_PATHS.changelog);
    const hidden = RELEASES.find((release) => !lists(release, "performance"));
    if (hidden === undefined)
      throw new Error("every release lists performance");
    await choose(page, "Performance");
    await expect(frame(page, hidden.version)).toBeHidden();
    await row(page, hidden.version).click();
    await expect(
      filter(page).getByRole("radio", { name: /^All \d+$/ }),
    ).toBeChecked();
    await expect(page).toHaveURL(new RegExp(`#${hidden.anchor}$`));
    await expect(frame(page, hidden.version)).toBeInViewport();
  },
);

test(
  "the release in view takes the selection, its Version history row and the playhead",
  DESKTOP,
  async ({ page }) => {
    await page.goto(SITE_PATHS.changelog);
    const [newest, , third] = RELEASES;
    if (newest === undefined || third === undefined)
      throw new Error("the changelog has fewer than three releases");
    await expect(row(page, newest.version)).toHaveAttribute(
      "aria-current",
      "true",
    );
    const count = (release: typeof newest) =>
      release.groups.reduce((sum, group) => sum + group.notes.length, 0);

    await row(page, third.version).click();
    await expect(page).toHaveURL(new RegExp(`#${third.anchor}$`));
    await expect(row(page, third.version)).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expect(history(page).locator('[aria-current="true"]')).toHaveCount(1);
    // The selection and the timeline are depictions, hidden from assistive
    // technology, so they are found by their drawn text and their parts.
    await expect(
      frame(page, third.version).getByText(size(count(third)), {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      frame(page, newest.version).getByText(size(count(newest)), {
        exact: true,
      }),
    ).toHaveCount(0);
    const playhead = page.locator(".site-changelog-playhead");
    await expect(playhead).toHaveText(`v${third.version}`);
    const key = page.locator(
      `.site-changelog-keys > [data-release="${third.anchor}"]`,
    );
    await expect
      .poll(async () => {
        const [line, diamond] = await Promise.all([
          playhead.boundingBox(),
          key.boundingBox(),
        ]);
        if (!line || !diamond) return Number.POSITIVE_INFINITY;
        return Math.abs(
          line.x + line.width / 2 - (diamond.x + diamond.width / 2),
        );
      })
      .toBeLessThan(1);
  },
);

test(
  "a link to a part inside a closed disclosure opens it",
  DESKTOP,
  async ({ page }) => {
    await page.goto(SITE_PATHS.changelog);
    const older = RELEASES.slice(FULL_FRAMES).find((release) =>
      lists(release, "fixes"),
    );
    const fixes = older?.groups.find((group) => group.kind === "fixes");
    if (older === undefined || fixes === undefined)
      throw new Error("no earlier release lists bug fixes");
    const heading = frame(page, older.version).getByRole("heading", {
      level: 3,
      name: `Bug fixes ${fixes.notes.length}`,
    });
    await expect(heading).toBeHidden();
    await frame(page, older.version)
      .getByRole("link", { name: `Fixes ${fixes.notes.length}` })
      .click();
    await expect(page).toHaveURL(new RegExp(`#${fixes.id}$`));
    await expect(heading).toBeInViewport();
    await expect(
      frame(page, older.version).getByText("Hide notes", { exact: true }),
    ).toBeVisible();
  },
);
