import { captureEarlyDisclosures } from "./early_disclosures.js";
import {
  captureInitialNavigationWidth,
  initializeNavigationResize,
} from "./nav_resize.js";

if (typeof document !== "undefined" && typeof window !== "undefined") {
  captureEarlyDisclosures(document, window);
  if (document.documentElement.hasAttribute("data-mokly-react-shell"))
    captureInitialNavigationWidth(document, window);
  else initializeNavigationResize(document, window);
}
