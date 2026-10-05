/**
 * The one console rule that browser checks share. The viewer renders its stage
 * views (`/static/`), temporary renders (`/__mokly/components/renders/`), and
 * previous versions (`about:srcdoc`) in frames sandboxed without
 * `allow-scripts`, so Chrome reports every script that tries to run there.
 * That includes a previous version's own scripts and Playwright's trace
 * recorder. Each such report is expected; every other console error is not.
 */

import type { ConsoleMessage, Page } from "@playwright/test";

const SANDBOX_NOTICE =
  /^Blocked script execution in '([^']*)' because the document's frame is sandboxed and the 'allow-scripts' permission is not set\.$/u;

/** Whether a frame document URL belongs to one of the viewer's sandboxed frames. */
function viewerSandboxedDocument(url: string): boolean {
  if (url === "about:srcdoc") return true;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return (
    (parsed.protocol === "http:" || parsed.protocol === "https:") &&
    (parsed.pathname.startsWith("/static/") ||
      parsed.pathname.startsWith("/__mokly/components/renders/"))
  );
}

/**
 * Whether console text reports a script that a viewer-owned sandboxed frame
 * refused to run. The text names the frame document; Chrome may also locate
 * the report in it.
 */
export function viewerSandboxNotice(
  text: string,
  locationUrl: string,
): boolean {
  const notice = SANDBOX_NOTICE.exec(text);
  const named = notice?.[1];
  return (
    notice?.[0] === text &&
    named !== undefined &&
    (viewerSandboxedDocument(named) || viewerSandboxedDocument(locationUrl))
  );
}

/** Whether a browser console message is an expected viewer sandbox report. */
export function expectedConsoleNotice(message: ConsoleMessage): boolean {
  return viewerSandboxNotice(message.text(), message.location().url);
}

/** Record every unexpected console error and every page error for one page. */
export function captureBrowserErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !expectedConsoleNotice(message))
      errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}
