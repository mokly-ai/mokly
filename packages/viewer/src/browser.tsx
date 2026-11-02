/**
 * The `@mokly/viewer/browser` entry: mount the standalone Browse shell into the
 * stub page that Serve and `build` deliver. Serve and `build` deliver this
 * module, with React bundled in, as `/mokly-viewer/client/shell.js`.
 */

import { createRoot } from "react-dom/client";

import { readStandalonePreferences } from "./standalone/preferences.js";
import { StandaloneShell, type ShellWindow } from "./standalone/shell.js";
import { initialStandaloneAppearance } from "./standalone/startup.js";

const mounted = new WeakSet<Element>();

/**
 * Apply the stored or system appearance, read the stored preferences, and
 * render the shell into the stub's mount element. A repeated call is inert.
 */
export function mountMoklyShell(doc: Document = document): void {
  const mount = doc.querySelector<HTMLElement>("body > [data-mokly-shell]");
  const win = doc.defaultView as ShellWindow | null;
  if (!mount || !win || mounted.has(mount)) return;
  mounted.add(mount);
  const appearance = initialStandaloneAppearance(doc, win);
  const root = createRoot(mount);
  const pagehide = (event: PageTransitionEvent) => {
    if (event.persisted) return;
    root.unmount();
    mounted.delete(mount);
    win.removeEventListener("pagehide", pagehide);
  };
  win.addEventListener("pagehide", pagehide);
  root.render(
    <StandaloneShell
      initialAppearance={appearance}
      preferences={readStandalonePreferences(win, appearance.scheme)}
      win={win}
    />,
  );
}

if (typeof document !== "undefined") mountMoklyShell();
