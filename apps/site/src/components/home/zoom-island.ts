/**
 * The home zoom island, which `ZoomControl.astro` loads on the home: it runs
 * the zoom pill of `zoom-pill.ts` with the page's `document` and `window`.
 * `tests/home_zoom_island.test.ts` runs it against a stub page.
 */
import { startZoomPill } from "./zoom-pill.js";

startZoomPill(document, window);
