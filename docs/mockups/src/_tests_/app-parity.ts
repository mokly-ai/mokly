import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { missingOwner, ownerOf, parityPages, repository } from "./app-owners";
import {
  drawnLabels,
  drawnPendingLabels,
  drawnStateTitles,
  source,
  unwrittenLabels,
} from "./app-parity-reads";
import type { PendingLabelMode } from "./app-parity-reads";
import { sourcePendingLabels } from "./app-pending-labels";
import { stateTitlesWritten } from "./app-state-titles";

/** One pending-label visibility difference between a mockup and its app owner. */
export interface PendingModeDivergence {
  screen: string;
  label: string;
  mockupMode: PendingLabelMode;
  applicationMode: PendingLabelMode;
  pages: string[];
}

/**
 * Pending-label presentation the catalogue and its running screen disagree on.
 *
 * Copy parity alone cannot see whether a label is visible. This comparison
 * keeps the presentation decision tied to the same declared owner as the copy,
 * while leaving expressions and forwarded labels to their owning wrappers.
 */
export function pendingModeDivergences(): PendingModeDivergence[] {
  const found = new Map<string, PendingModeDivergence>();
  for (const page of parityPages()) {
    const owner = ownerOf(page.screen);
    if (!owner.files) continue;
    const application = owner.files.flatMap((path) =>
      sourcePendingLabels(source(path)),
    );
    for (const pending of drawnPendingLabels(page.file, page.screen)) {
      const matching = application.filter(
        (candidate) => candidate.label === pending.label,
      );
      if (!matching.length) continue;
      const modes = new Set(matching.map((candidate) => candidate.mode));
      if (modes.size === 1 && modes.has(pending.mode)) continue;
      const applicationMode = modes.has("screen-reader-only")
        ? "screen-reader-only"
        : "visible";
      const key =
        page.screen +
        " :: " +
        pending.label +
        " :: " +
        pending.mode +
        " :: " +
        applicationMode;
      const divergence = found.get(key) ?? {
        screen: page.screen,
        label: pending.label,
        mockupMode: pending.mode,
        applicationMode,
        pages: [],
      };
      divergence.pages.push(page.id);
      found.set(key, divergence);
    }
  }
  return [...found.values()].sort((left, right) =>
    (left.screen + left.label).localeCompare(right.screen + right.label),
  );
}

/** One label the catalogue draws that its owning screen does not write. */
export interface Divergence {
  screen: string;
  label: string;
  pages: string[];
}

/**
 * Every catalogued control label the running screen does not write. A screen
 * whose owner is still pending is skipped: there is nothing to disagree with
 * until the milestone that draws it lands.
 */
export function labelDivergences(): Divergence[] {
  const found = new Map<string, Divergence>();
  for (const page of parityPages()) {
    const owner = ownerOf(page.screen);
    if (!owner.files) continue;
    for (const path of owner.files)
      if (!existsSync(resolve(repository, "packages/app/src", path)))
        throw missingOwner(page.screen, path);
    const sources = owner.files.map(source).join("\n");
    for (const label of unwrittenLabels(
      drawnLabels(page.file, page.screen),
      sources,
    )) {
      const key = page.screen + " :: " + label;
      const entry = found.get(key) ?? {
        screen: page.screen,
        label,
        pages: [],
      };
      entry.pages.push(page.id);
      found.set(key, entry);
    }
  }
  return [...found.values()].sort((left, right) =>
    (left.screen + left.label).localeCompare(right.screen + right.label),
  );
}

/** One state the product announces that no screen drawing from it draws. */
export interface StateDivergence {
  file: string;
  title: string;
  screens: string[];
}

/**
 * Every state the running product names that the catalogue never draws.
 *
 * `labelDivergences()` reads one way only: it reports what the catalogue draws
 * and the product does not write, so a product that *grows* a state is
 * invisible to it, which is how the switcher gained an empty state the
 * catalogue had never drawn. This is the same comparison run the other way.
 *
 * It is answered per file rather than per screen, because several screens share
 * one: `stage.tsx` writes the card for an unpublished branch, an unpublished
 * pull request and a refused catalogue, and no single screen draws all three.
 * A title is drawn when any screen that declares the file writes it; only a
 * title no such screen draws at all is a state the catalogue is missing.
 */
export function stateTitleDivergences(): StateDivergence[] {
  const drawnFor = new Map<string, Set<string>>();
  const owners = new Map<string, Set<string>>();
  for (const page of parityPages()) {
    const owner = ownerOf(page.screen);
    if (!owner.files) continue;
    const titles = drawnStateTitles(page.file, page.screen);
    for (const path of owner.files) {
      const drawn = drawnFor.get(path) ?? new Set<string>();
      for (const title of titles) drawn.add(title);
      drawnFor.set(path, drawn);
      owners.set(path, (owners.get(path) ?? new Set()).add(page.screen));
    }
  }
  const found: StateDivergence[] = [];
  for (const [path, screens] of owners) {
    const drawn = drawnFor.get(path) ?? new Set<string>();
    for (const title of stateTitlesWritten(source(path)))
      if (!drawn.has(title))
        found.push({ file: path, title, screens: [...screens].sort() });
  }
  return found.sort((left, right) =>
    (left.file + left.title).localeCompare(right.file + right.title),
  );
}
