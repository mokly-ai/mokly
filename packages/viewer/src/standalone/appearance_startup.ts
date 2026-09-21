/** Install the opted-in standalone appearance from a classic browser asset. */

import { installAppearance } from "./startup.js";

if (typeof document !== "undefined" && typeof window !== "undefined") {
  installAppearance(
    {
      documentElement: document.documentElement,
      querySelectorAll: (selector) =>
        document.querySelectorAll<HTMLIFrameElement>(selector),
    },
    window,
  );
}
