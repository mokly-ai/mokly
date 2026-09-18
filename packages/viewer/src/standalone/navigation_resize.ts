import { captureEarlyDisclosures } from "../client/early_disclosures.js";
import { initializeNavigationResize } from "../client/nav_resize.js";

if (typeof document !== "undefined" && typeof window !== "undefined") {
  captureEarlyDisclosures(document, window);
  initializeNavigationResize(document, window);
}
