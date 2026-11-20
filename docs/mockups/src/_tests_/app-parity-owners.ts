import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { declared, ownerOf, parityPages, repository } from "./app-owners";
import { dataLabel, drawnLabels, source, written } from "./app-parity-reads";
import {
  announcers,
  baseAnnouncer,
  forwardingAnnouncers,
} from "./app-state-titles";

/** Every application source the announcer contract is checked against. */
function appSources(): string[] {
  return readdirSync(resolve(repository, "apps/app/src"), {
    recursive: true,
    encoding: "utf8",
  }).filter((path) => path.endsWith(".tsx") || path.endsWith(".ts"));
}

/** Every label one screen draws, gathered across all of its own pages. */
function drawnByScreen(): Map<string, Set<string>> {
  const drawn = new Map<string, Set<string>>();
  for (const page of parityPages()) {
    if (!ownerOf(page.screen).files) continue;
    const labels = drawn.get(page.screen) ?? new Set<string>();
    for (const label of drawnLabels(page.file, page.screen)) labels.add(label);
    drawn.set(page.screen, labels);
  }
  return drawn;
}

/**
 * Whether the owner table is still true of the application. A path map with no
 * liveness property degrades quietly the first time the application moves a
 * file: the check keeps comparing against a file that no longer draws the
 * screen, reports labels the product does write, and credits none it stopped
 * writing. Three properties keep it honest, and each names its own repair.
 *
 * The third is per screen. A file credited for writing any screen's label used
 * to keep its place in every screen's row, so a screen that stopped drawing
 * from one of its declared files never noticed: the entry stayed, and it went
 * on widening the text `labelDivergences()` searches for that screen, which is
 * a parity pass the screen did not earn. Each screen now credits its own files
 * against its own drawings.
 */
export function ownerViolations(): string[] {
  const problems: string[] = [];
  for (const [screen, owner] of declared()) {
    if (!owner.files) {
      if (existsSync(resolve(repository, "apps/app/src", owner.pending)))
        problems.push(
          "declare the new owner for " +
            screen +
            ": " +
            owner.pending +
            " now exists",
        );
      continue;
    }
    for (const path of owner.files)
      if (!existsSync(resolve(repository, "apps/app/src", path)))
        problems.push("declare the new owner for " + screen + ": " + path);
  }
  if (problems.length > 0) return problems;
  const drawn = drawnByScreen();
  for (const [screen, owner] of declared()) {
    if (!owner.files) continue;
    const labels = drawn.get(screen);
    // A screen that draws no label in its own region cannot be compared at all,
    // which is a gap rather than a pass: it once let two pages whose whole
    // subject was the slot bar sit outside the check entirely. Say so.
    if (!labels || labels.size === 0) {
      problems.push("draws no label in its own region: " + screen);
      continue;
    }
    // Only copy can credit a declaration. A page whose region draws nothing but
    // data would otherwise credit every file named on it.
    const copy = [...labels].filter((label) => !dataLabel(label));
    for (const path of owner.files)
      if (!copy.some((label) => written(label, source(path))))
        problems.push(
          "owner writes nothing this screen draws, for " + screen + ": " + path,
        );
  }
  return [...new Set(problems)];
}

/**
 * Whether the announcer map still describes the application.
 *
 * The map is what `stateTitlesWritten()` reads titles through, so a component
 * that starts forwarding a caller's sentence without being listed makes every
 * sentence its callers write invisible — the exact failure the symmetric check
 * exists to prevent, one level up. Every forwarding component in the
 * application must therefore be in the map under the prop its callers use, and
 * every listed component must still exist.
 */
export function announcerViolations(): string[] {
  const problems: string[] = [];
  const seen = new Set<string>([baseAnnouncer]);
  for (const path of appSources()) {
    for (const forwarder of forwardingAnnouncers(source(path))) {
      seen.add(forwarder.component);
      const listed = (announcers as Record<string, string | undefined>)[
        forwarder.component
      ];
      if (listed === undefined)
        problems.push(
          "announces a state and is not in the map, in " +
            path +
            ": " +
            forwarder.component,
        );
      else if (listed !== forwarder.prop)
        problems.push(
          "announces through " +
            forwarder.prop +
            ", not " +
            listed +
            ", in " +
            path +
            ": " +
            forwarder.component,
        );
    }
  }
  for (const component of Object.keys(announcers))
    if (!seen.has(component))
      problems.push("no longer announces anything: " + component);
  return problems;
}
