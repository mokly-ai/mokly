import type { ErrorAllowance } from "./error_monitor.js";

const exact = (text: string) =>
  new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n?$`, "u");

/** This fixture deliberately embeds a script-denied document outside /static/. */
export const nestedScriptNotice: ErrorAllowance = {
  kind: "console",
  message: exact(
    "Blocked script execution in 'https://cross-origin.example.test/nested.html' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.",
  ),
  url: /^(?:https:\/\/cross-origin\.example\.test\/nested\.html)?$/u,
};

/**
 * A Props edit's render of the home screen holds no other document, so the
 * generated details document that the render's nested frame names is not
 * found under the render's address.
 */
export const renderedNestedDocument: ErrorAllowance = {
  kind: "console",
  message:
    /^Failed to load resource: the server responded with a status of 404 \(Not Found\)$/u,
  url: /\/mokly-viewer\/components\/renders\/[^/]+\/static\/mokly-generated\/fixture\/nested\/details\/index\.(?:desktop|mobile)\.html$/u,
};

/** Each denied operation is exercised explicitly by the sandbox security test. */
export function navigationDenials(
  allow: (rule: ErrorAllowance) => void,
  origin: string,
): void {
  const home = `${origin}/view/fixture/nested/home/`;
  const document = `${origin}/static/mokly-generated/fixture/nested/home/index.mobile.html`;
  const nested = `${origin}/static/fixture/nested/home/nested.html`;
  const cross = "https://cross-origin.example.test/nested.html";
  const suffix =
    "The frame attempting navigation of the top-level window is sandboxed, but the flag of 'allow-top-navigation' or 'allow-top-navigation-by-user-activation' is not set.";
  const messages = [
    ...[document, nested, "about:srcdoc"].map(
      (source) =>
        `Unsafe attempt to initiate navigation for frame with URL '${home}' from frame with URL '${source}'. ${suffix}`,
    ),
    `Unsafe attempt to initiate navigation for frame with origin '${origin}' from frame with URL '${cross}'. ${suffix}`,
    "Blocked form submission to '#home' because the form's frame is sandboxed and the 'allow-forms' permission is not set.",
    ...[document, cross].map(
      (source) =>
        `Blocked opening '${source}#popup' in a new window because the request was made in a sandboxed frame whose 'allow-popups' permission is not set.`,
    ),
  ];
  for (const message of messages)
    allow({ kind: "console", message: exact(message) });
}
