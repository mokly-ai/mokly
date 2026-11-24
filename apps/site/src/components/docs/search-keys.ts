/**
 * The keys that open the documentation search on every docs page: ⌘K or
 * Ctrl K anywhere, and `/` without Ctrl, ⌘ or Alt outside a text field.
 * Shift may produce `/` on some keyboard layouts, so it does not stop `/`.
 * The search controls name the key: ⌘K on Apple platforms and Ctrl K
 * elsewhere, which is the text the built page carries.
 */

/** The input types that take typed text, where `/` types itself. */
const TEXT_INPUT_TYPES = new Set([
  "date",
  "datetime-local",
  "email",
  "month",
  "number",
  "password",
  "search",
  "tel",
  "text",
  "time",
  "url",
  "week",
]);

/** Whether a key press lands in a place that takes typed text. */
function inTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLInputElement) {
    return TEXT_INPUT_TYPES.has(target.type);
  }
  return (
    target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
  );
}

/** Whether a key press opens the documentation search. */
export function opensSearch(event: KeyboardEvent): boolean {
  if (event.isComposing || event.altKey) return false;
  if (event.metaKey || event.ctrlKey) {
    return !event.shiftKey && event.key.toLowerCase() === "k";
  }
  return event.key === "/" && !inTextField(event.target);
}

/** The key hint of the search controls on the reader's platform. */
export function keyHint(userAgent: string): string {
  return /Mac|iPhone|iPad|iPod/.test(userAgent) ? "⌘K" : "Ctrl K";
}
