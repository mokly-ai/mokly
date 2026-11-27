/**
 * The home demos island, which `Workspace.astro` loads: it starts the Specs
 * scroll spy of `specs-spy.ts`, the demos of `demos.ts` and the Swipe
 * control of `swipe-control.ts` with the page's `document` and `window`.
 * `tests/home_island.test.ts` runs the spy and the demos against a stub
 * page.
 */
import { startDemos } from "./demos.js";
import { startSpecsSpy } from "./specs-spy.js";
import { startSwipeControl } from "./swipe-control.js";

startSpecsSpy(document, window);
startDemos(document, window);
startSwipeControl(document);
