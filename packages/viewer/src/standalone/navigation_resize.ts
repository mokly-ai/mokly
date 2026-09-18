import { captureEarlyDisclosures } from "./early_disclosures.js";
import { HYDRATED_EVENT, initializeNavigationResize } from "./nav_resize.js";

if (typeof document !== "undefined" && typeof window !== "undefined") {
  captureEarlyDisclosures(document, window);
  if (document.documentElement.hasAttribute("data-mokly-react-shell"))
    window.addEventListener(
      HYDRATED_EVENT,
      () => initializeNavigationResize(document, window),
      { once: true },
    );
  else initializeNavigationResize(document, window);
}
