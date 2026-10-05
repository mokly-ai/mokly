/**
 * The identities that pair an inner scroll region with its counterpart in
 * another version: an authored `data-mokly-scroll` name, a landmark or
 * structural role with its accessible name, and a text fingerprint. Every
 * function here only reads the document.
 */

/** The authored value that keeps a region from pairing with anything. */
const SCROLL_OFF = "off";

/** The attribute authors use to name a region or turn its pairing off. */
const NAME_ATTRIBUTE = "data-mokly-scroll";

/** The public lowercase kebab-case id grammar every authored name follows. */
const NAME_GRAMMAR = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Explicit roles that identify a region; any other explicit role has none. */
const ROLES = new Set([
  "complementary",
  "dialog",
  "feed",
  "grid",
  "list",
  "listbox",
  "log",
  "main",
  "navigation",
  "region",
  "table",
  "tabpanel",
  "tree",
]);

/** Implicit roles by element name; `section` is handled separately. */
const IMPLICIT_ROLES = new Map([
  ["aside", "complementary"],
  ["dialog", "dialog"],
  ["main", "main"],
  ["menu", "list"],
  ["nav", "navigation"],
  ["ol", "list"],
  ["table", "table"],
  ["ul", "list"],
]);

const ASCII_WHITESPACE = /[\t\n\f\r ]+/;
const WORD = /[\p{L}\p{N}]+/gu;
const HEADING = /^h[1-6]$/;

/** Words of a region's own text that its fingerprint keeps. */
const FINGERPRINT_WORDS = 200;

function firstToken(value: string): string | undefined {
  return value.split(ASCII_WHITESPACE).find((token) => token !== "");
}

function asciiLowercase(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}

function collapse(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** Whether a region is marked `data-mokly-scroll="off"`. */
export function isScrollOff(element: Element): boolean {
  return element.getAttribute(NAME_ATTRIBUTE) === SCROLL_OFF;
}

/** A region's valid authored name; `off` and malformed values are none. */
export function authoredName(element: Element): string | undefined {
  const value = element.getAttribute(NAME_ATTRIBUTE);
  return value !== null && value !== SCROLL_OFF && NAME_GRAMMAR.test(value)
    ? value
    : undefined;
}

/** A region's nonempty `id`, exactly as authored. */
export function regionId(element: Element): string | undefined {
  const value = element.getAttribute("id");
  return value ? value : undefined;
}

/** The first token of an explicit `role`, ASCII-lowercased. */
function explicitRole(element: Element): string | undefined {
  const value = element.getAttribute("role");
  const token = value === null ? undefined : firstToken(value);
  return token === undefined ? undefined : asciiLowercase(token);
}

/**
 * The accessible name: a present `aria-label`, else the text of the elements
 * `aria-labelledby` names, trimmed with whitespace runs collapsed.
 */
export function accessibleName(element: Element): string {
  const label = element.getAttribute("aria-label");
  if (label !== null) return collapse(label);
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy === null) return "";
  const texts: string[] = [];
  for (const id of labelledBy.split(ASCII_WHITESPACE)) {
    const target = id ? element.ownerDocument.getElementById(id) : null;
    if (target) texts.push(target.textContent ?? "");
  }
  return collapse(texts.join(" "));
}

/**
 * The role a region pairs by: a supported explicit role token, else the
 * implicit role of its element name. An unsupported explicit role has none,
 * and a `section` is a `region` only when it has an accessible name.
 */
export function regionRole(element: Element): string | undefined {
  const explicit = explicitRole(element);
  if (explicit !== undefined) return ROLES.has(explicit) ? explicit : undefined;
  if (element.localName === "section")
    return accessibleName(element) ? "region" : undefined;
  return IMPLICIT_ROLES.get(element.localName);
}

/** The `(role, name)` key rule 3 pairs by, or none without a role. */
export function regionRoleKey(element: Element): string | undefined {
  const role = regionRole(element);
  return role === undefined
    ? undefined
    : `${role}\u0000${accessibleName(element)}`;
}

function words(text: string, limit: number, into: string[]): void {
  let count = 0;
  for (const match of text.toLowerCase().matchAll(WORD)) {
    if (count >= limit) return;
    count += 1;
    into.push(match[0]);
  }
}

/**
 * The words of a region's descendant headings in tree order, then the first
 * {@link FINGERPRINT_WORDS} words of its own text: lowercased, split into runs
 * of letters and numbers, without words shorter than two code points.
 */
export function textFingerprint(region: Element): ReadonlySet<string> {
  const found: string[] = [];
  for (const element of region.querySelectorAll("*"))
    if (HEADING.test(element.localName) || explicitRole(element) === "heading")
      words(element.textContent ?? "", Infinity, found);
  words(region.textContent ?? "", FINGERPRINT_WORDS, found);
  return new Set(found.filter((word) => [...word].length >= 2));
}
