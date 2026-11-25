/** Format whole seconds as `28m 05s`, or `42s` below one minute. */
export function formatSeconds(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const rest = String(seconds % 60).padStart(2, "0");
  return `${Math.floor(seconds / 60)}m ${rest}s`;
}

/**
 * Escape text for one Markdown table cell: it cannot add HTML, a cell, or a
 * line.
 */
export function cell(text) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/[[\]|]/g, "\\$&")
    .replace(/\s*[\r\n]+\s*/g, " ");
}

/** Escape the message of one workflow command line. */
export function escapeCommand(text) {
  return text.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}
