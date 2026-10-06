/** Safe rendering and validation helpers for terminal-bound text. */

const CONTROL_CHARACTER = /\p{Cc}/u;
const CONTROL_CHARACTERS = /\p{Cc}/gu;

/** Return whether text contains a C0 or C1 terminal control character. */
export function hasTerminalControlCharacters(value: string): boolean {
  return CONTROL_CHARACTER.test(value);
}

/** Render every C0 or C1 control as a visible lowercase JSON-style escape. */
export function escapeTerminalControlCharacters(value: string): string {
  return value.replace(CONTROL_CHARACTERS, (character) => {
    const code = character.codePointAt(0)?.toString(16).padStart(4, "0");
    return `\\u${code ?? "fffd"}`;
  });
}
