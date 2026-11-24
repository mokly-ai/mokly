/**
 * The home demos island, which `Workspace.astro` loads: it starts the Specs
 * scroll spy of `specs-spy.ts` and the demos of `demos.ts` with the page's
 * `document` and `window`. `tests/home_island.test.ts` runs both against a
 * stub page.
 */
import { startDemos } from "./demos.js";
import { startSpecsSpy } from "./specs-spy.js";

startSpecsSpy(document, window);
startDemos(document, window);
