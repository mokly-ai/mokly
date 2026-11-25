/**
 * The measurements island, which `Measurements.astro` loads on each page
 * that holds a measured part. `measurements.ts` holds its logic, and the
 * page's measured targets are HTML elements, which have an offset size.
 */
import { startMeasurements } from "./measurements.js";

startMeasurements<HTMLElement>(document, window);
