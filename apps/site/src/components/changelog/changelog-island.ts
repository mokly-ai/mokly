/**
 * The changelog island, which the changelog page loads as one same-origin
 * script without hydration. It runs the note filter, follows the release in
 * view through `release-view.ts`, and opens the closed disclosure that holds
 * a link's target. The built page draws the newest release in view and
 * every note shown, and the island moves nothing by animation, so reduced
 * motion changes nothing.
 *
 * - The filter. A choice shows only the note groups of its kind and the
 *   releases that list them; Breaking also keeps the upgrade notes of the
 *   releases it shows. The count chips of the hidden groups go quiet, each
 *   shown compact frame opens its notes, and the status line counts the
 *   notes and the releases on show. All shows everything again and closes
 *   the compact frames that the filter opened. When the release that the
 *   reader is in leaves, the nearest release that stays comes into view.
 * - A link to a target that the filter hides first returns the filter to
 *   All, and a link to a target inside a closed disclosure opens it, so the
 *   jump lands on a target that shows. A fragment that the address names on
 *   load or later is reached the same way.
 */

import { followReleaseInView, fragmentTarget } from "./release-view.js";
import { type FilterChoice, filterStatus, isFilterChoice } from "./status.js";

const frames = [
  ...document.querySelectorAll<HTMLElement>(
    ".site-changelog .site-release[id]",
  ),
];
const radios = [
  ...document.querySelectorAll<HTMLInputElement>(
    'input[name="site-changelog-filter"]',
  ),
];
const status = document.querySelector<HTMLElement>(
  ".site-changelog-filter-status",
);
const earlier = document.querySelector<HTMLElement>(".site-changelog-earlier");

/** The choice of the filter, and the compact frames that it opened. */
let choice: FilterChoice = "all";
const opened = new Set<HTMLDetailsElement>();

/** Whether a group of a kind shows under the filter's choice. */
function shows(kind: string | undefined): boolean {
  return (
    choice === "all" ||
    kind === choice ||
    (choice === "breaking" && kind === "upgrade")
  );
}

/** The frames that the filter shows, in page order. */
function shown(): HTMLElement[] {
  return frames.filter((frame) => frame.closest("[hidden]") === null);
}

const view = followReleaseInView(frames, shown);

/** Show the notes and the releases of a choice, and count them. */
function apply(next: FilterChoice): void {
  choice = next;
  let notes = 0;
  for (const frame of frames) {
    let lists = choice === "all";
    for (const group of frame.querySelectorAll<HTMLElement>(
      ".site-release-group[data-kind]",
    )) {
      const kind = group.dataset["kind"];
      group.hidden = !shows(kind);
      if (group.hidden || kind === "upgrade") continue;
      lists = true;
      notes += Number(group.dataset["notes"] ?? 0);
    }
    frame.hidden = !lists;
    for (const chip of frame.querySelectorAll<HTMLElement>(
      ".site-release-count[data-kind]",
    ))
      chip.toggleAttribute("data-quiet", !shows(chip.dataset["kind"]));
    const more = frame.querySelector<HTMLDetailsElement>(
      ":scope > .site-release-more",
    );
    if (more !== null && choice !== "all" && lists && !more.open) {
      more.open = true;
      opened.add(more);
    }
    if (more !== null && choice === "all" && opened.delete(more))
      more.open = false;
  }
  if (earlier !== null)
    earlier.hidden = !frames.some(
      (frame) =>
        frame.classList.contains("site-release--compact") && !frame.hidden,
    );
  if (status !== null)
    status.textContent = filterStatus(
      choice,
      notes,
      frames.filter((frame) => !frame.hidden).length,
    );
}

/**
 * Apply a choice. When the release that the reader is in leaves, bring the
 * nearest release that stays into view: the next one, else the one before.
 */
function choose(next: FilterChoice): void {
  const before = view.inView();
  apply(next);
  const left = before.frame;
  if (left !== undefined && before.passed && left.closest("[hidden]")) {
    const stays = shown();
    const after = stays.find(
      (frame) =>
        left.compareDocumentPosition(frame) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
    (after ?? stays.at(-1))?.scrollIntoView({ block: "start" });
  }
  view.queue();
}

/**
 * Make an element reachable: return the filter to All when it hides the
 * element, and open each closed disclosure around it. Says whether it had
 * to change the page.
 */
function reach(element: HTMLElement): boolean {
  let changed = false;
  if (choice !== "all" && element.closest("[hidden]") !== null) {
    const all = radios.find((radio) => radio.value === "all");
    if (all !== undefined) all.checked = true;
    choose("all");
    changed = true;
  }
  for (
    let details = element.closest("details");
    details !== null;
    details = details.parentElement?.closest("details") ?? null
  ) {
    changed ||= !details.open;
    details.open = true;
  }
  return changed;
}

/** Reach the target that the address names; scroll to it if it only now shows. */
function arrive(): void {
  const element = fragmentTarget(window.location.hash);
  if (element !== null && reach(element))
    element.scrollIntoView({ block: "start" });
}

for (const radio of radios)
  radio.addEventListener("change", () => {
    if (radio.checked && isFilterChoice(radio.value)) choose(radio.value);
  });

// A link's own jump follows the click, so the target shows by then.
document.addEventListener(
  "click",
  (event) => {
    const link =
      event.target instanceof Element
        ? event.target.closest<HTMLAnchorElement>('a[href^="#"]')
        : null;
    const element = link === null ? null : fragmentTarget(link.hash);
    if (element !== null) reach(element);
  },
  true,
);
window.addEventListener("hashchange", arrive);

// The browser restores a choice into its radios on a return to the page.
const restored = radios.find((radio) => radio.checked)?.value;
if (restored !== undefined && restored !== "all" && isFilterChoice(restored))
  choose(restored);
arrive();
