/**
 * The measurements island, which `Measurements.astro` loads on each page
 * that holds a measured part. `measurements.ts` holds its logic.
 */
import { startMeasurements } from "./measurements.js";

startMeasurements(document, window);
