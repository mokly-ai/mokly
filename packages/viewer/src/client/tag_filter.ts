/** Tag chips as a search control: selecting a chip writes the matching
 * `tag:<tag>` term into the search field, so one entered query drives both the
 * filtered catalogue tree and the chips that show which tag is selected. The
 * search field's tag button opens a picker over the catalogue's own chips: it
 * lands focus on the selected chip, roves Left and Right across the row and
 * wraps at both ends, and closes on a selection, on Escape, or on a click
 * outside. Closing never strands focus in the hidden panel. The open panel is
 * ephemeral and nothing about it is remembered. */

import { clearTagTerm, parseSearchQuery, setTagTerm } from "./search_query.js";

const CHIP = "[data-mokly-tag]";
const SEARCH = "[data-mokly-search]";
const TOGGLE = "[data-mokly-tag-toggle]";

/** The search field's tag button with the panel of chips it controls. */
interface TagPicker {
  chips: readonly HTMLElement[];
  panel: HTMLElement;
  toggle: HTMLElement;
}

/** Mark every rendered tag chip selected when the entered query names its tag. */
export function syncTagChips(doc: Document): void {
  const query = parseSearchQuery(searchField(doc)?.value ?? "");
  for (const chip of doc.querySelectorAll<HTMLElement>(CHIP)) {
    const selected = query.tags.includes(chipTag(chip));
    chip.classList.toggle("active", selected);
    chip.setAttribute("aria-pressed", selected ? "true" : "false");
  }
}

/**
 * Handle one document click for the tag controls. Returns true when the click
 * belonged to a tag control and further click handling should stop. The tag
 * button opens and closes the picker. Selecting a chip on either surface
 * replaces any entered tag term, and selecting the selected chip clears it; a
 * chip chosen in the picker also closes it and hands focus back to the button.
 * Every other click outside an open panel closes it and leaves focus where the
 * click left it, unless the panel still holds it.
 */
export function handleTagControlClick(doc: Document, target: Element): boolean {
  const picker = tagPicker(doc);
  if (target.closest(TOGGLE)) {
    if (!picker) return true;
    if (picker.panel.hidden) openPicker(doc, picker);
    else closePicker(doc, picker, true);
    return true;
  }
  const inPicker = picker !== undefined && picker.panel.contains(target);
  if (picker && !inPicker) closePicker(doc, picker, false);
  const chip = target.closest<HTMLElement>(CHIP);
  if (!chip) return false;
  selectChipTag(doc, chip);
  if (picker && inPicker) closePicker(doc, picker, true);
  return true;
}

/**
 * Handle one document keydown for the picker. Returns true when the open panel
 * consumed the key, so the panel answers Escape ahead of the surfaces behind
 * it and the caller can prevent that key's default. Escape closes the panel
 * and returns focus to the tag button without touching the entered query, Left
 * and Right step across the chips and wrap at both ends, and Home and End jump
 * to them. Enter and Space are left to the chip, which activates as any button
 * does even while the roving tab stop sits elsewhere.
 */
export function handleTagPickerKeydown(
  doc: Document,
  key: string,
  target: Element | undefined,
): boolean {
  const picker = tagPicker(doc);
  if (!picker || picker.panel.hidden) return false;
  if (key === "Escape") {
    closePicker(doc, picker, true);
    return true;
  }
  const next = movedChip(picker.chips, key, target?.closest<HTMLElement>(CHIP));
  if (!next) return false;
  focusChip(picker, next);
  return true;
}

/** Open the panel and land focus on the selected chip, else on the first. */
function openPicker(doc: Document, picker: TagPicker): void {
  setPanelOpen(picker, true);
  const query = parseSearchQuery(searchField(doc)?.value ?? "");
  const selected = picker.chips.find((chip) =>
    query.tags.includes(chipTag(chip)),
  );
  focusChip(picker, selected ?? picker.chips[0]);
}

/**
 * Close an open panel, optionally handing focus back to the tag button. Focus
 * returns to the button unasked whenever the closing panel still holds it,
 * because a browser that does not focus a clicked button would otherwise
 * strand focus in the hidden subtree.
 */
function closePicker(
  doc: Document,
  picker: TagPicker,
  restoreFocus: boolean,
): void {
  if (picker.panel.hidden) return;
  const held = picker.panel.contains(doc.activeElement);
  setPanelOpen(picker, false);
  if (restoreFocus || held) picker.toggle.focus();
}

/** The one place the panel's `hidden` and the button's `aria-expanded` move. */
function setPanelOpen(picker: TagPicker, open: boolean): void {
  picker.panel.hidden = !open;
  picker.toggle.setAttribute("aria-expanded", open ? "true" : "false");
}

/** Focus one chip and give it the chip row's only tab stop. */
function focusChip(picker: TagPicker, chip: HTMLElement | undefined): void {
  if (!chip) return;
  for (const other of picker.chips)
    other.setAttribute("tabindex", other === chip ? "0" : "-1");
  chip.focus();
}

function movedChip(
  chips: readonly HTMLElement[],
  key: string,
  from: HTMLElement | null | undefined,
): HTMLElement | undefined {
  const index = from ? chips.indexOf(from) : -1;
  const last = chips.length - 1;
  if (index < 0) return undefined;
  if (key === "ArrowLeft") return chips[index === 0 ? last : index - 1];
  if (key === "ArrowRight") return chips[index === last ? 0 : index + 1];
  if (key === "Home") return chips[0];
  if (key === "End") return chips[last];
  return undefined;
}

function tagPicker(doc: Document): TagPicker | undefined {
  const toggle = doc.querySelector<HTMLElement>(TOGGLE);
  if (!toggle) return undefined;
  const panel = doc.getElementById(toggle.getAttribute("aria-controls") ?? "");
  if (!panel) return undefined;
  return {
    chips: [...panel.querySelectorAll<HTMLElement>(CHIP)],
    panel,
    toggle,
  };
}

function selectChipTag(doc: Document, chip: HTMLElement): void {
  const tag = chipTag(chip);
  const search = searchField(doc);
  if (tag === "" || !search) return;
  const selected = parseSearchQuery(search.value).tags.includes(tag);
  search.value = selected
    ? clearTagTerm(search.value, tag)
    : setTagTerm(search.value, tag);
  search.dispatchEvent(new Event("input", { bubbles: true }));
}

function chipTag(chip: Element): string {
  return (chip.getAttribute("data-mokly-tag") ?? "").toLowerCase();
}

function searchField(doc: Document): HTMLInputElement | null {
  return doc.querySelector<HTMLInputElement>(SEARCH);
}
