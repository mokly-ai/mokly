/**
 * The keys of the canvas: `+` or `=` zooms in, `-` zooms out, Shift+0 shows
 * 100% and Shift+1 fits. The host listens where its keys belong, such as the
 * whole document of a standalone shell or only an embedded root, and passes
 * each key down here.
 */

/** What a key asks the canvas to do. */
export type CanvasCommand = "actual-size" | "fit" | "zoom-in" | "zoom-out";

/** The parts of a key event that decide its command. */
export interface CanvasKeyEvent {
  altKey: boolean;
  code: string;
  ctrlKey: boolean;
  defaultPrevented: boolean;
  key: string;
  metaKey: boolean;
  shiftKey: boolean;
  target: EventTarget | null;
}

/** The input types whose keys type no text. */
const NON_TEXT_INPUTS = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

/** Whether keys typed at a target enter text, so they stay the field's own. */
function inTextField(target: EventTarget | null): boolean {
  if (target === null || !("tagName" in target)) return false;
  const element = target as HTMLElement;
  if (element.isContentEditable) return true;
  switch (element.tagName) {
    case "TEXTAREA":
    case "SELECT":
      return true;
    case "INPUT":
      return !NON_TEXT_INPUTS.has(
        (element.getAttribute("type") ?? "text").toLowerCase(),
      );
    default:
      return false;
  }
}

/**
 * The command of a key, or nothing. Keys act only while focus is not in a
 * text field and while no ⌘, Ctrl or Alt is held. Shift+0 and Shift+1 match
 * the key's place, `Digit0` and `Digit1`, because the character that a
 * shifted digit types depends on the keyboard layout; they win over the
 * characters, so a layout whose Shift+0 types `=` still shows 100%.
 */
export function canvasKeyCommand(
  event: CanvasKeyEvent,
): CanvasCommand | undefined {
  if (event.defaultPrevented) return undefined;
  if (event.metaKey || event.ctrlKey || event.altKey) return undefined;
  if (inTextField(event.target)) return undefined;
  if (event.shiftKey && event.code === "Digit0") return "actual-size";
  if (event.shiftKey && event.code === "Digit1") return "fit";
  if (event.key === "+" || event.key === "=") return "zoom-in";
  if (event.key === "-") return "zoom-out";
  return undefined;
}
