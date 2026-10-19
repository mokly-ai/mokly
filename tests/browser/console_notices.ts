/**
 * The one console rule that browser checks share. The viewer renders its stage
 * views (`/static/`), temporary renders (`/mokly-viewer/components/renders/`), and
 * previous versions (`about:srcdoc`) in frames sandboxed without
 * `allow-scripts`, so Chrome reports every script that tries to run there.
 * That includes a previous version's own scripts, Playwright's trace recorder,
 * and page.clock injections. Their exact notice for a transient about:blank
 * frame can have an empty or about:blank location. Every other error is not expected.
 */

import type { ConsoleMessage } from "@playwright/test";

const SANDBOX_NOTICE =
  /^Blocked script execution in '([^']*)' because the document's frame is sandboxed and the 'allow-scripts' permission is not set\./u;
const INJECTED_SCRIPT_NOTICE =
  "Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.";

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
    (/(?:^|\/)static\//u.test(parsed.pathname) ||
      parsed.pathname.startsWith("/mokly-viewer/components/renders/"))
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
  if (
    text === INJECTED_SCRIPT_NOTICE &&
    (locationUrl === "" || locationUrl === "about:blank")
  )
    return true;
  const named = SANDBOX_NOTICE.exec(text)?.[1];
  return (
    named !== undefined &&
    (viewerSandboxedDocument(named) || viewerSandboxedDocument(locationUrl))
  );
}

/** Whether a browser console message is an expected viewer sandbox report. */
export function expectedConsoleNotice(message: ConsoleMessage): boolean {
  return viewerSandboxNotice(message.text(), message.location().url);
}
