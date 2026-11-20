/**
 * The runs of the product browser checks: each viewport in each scheme. Every
 * product spec registers its tests once per run, in this order, and ends each
 * test title with the run's label.
 */

import { pathToFileURL } from "node:url";

import { screenFile, type Scheme, type Viewport } from "./catalogue-paths";

/** The viewports, in the order that the product specs register their runs. */
export const productViewports = ["desktop", "mobile"] as const;

/** The schemes of each viewport's runs, in registration order. */
export const productSchemes = ["light", "dark"] as const;

/** What a product check reads from its run. */
export interface ProductRun {
  /** The address of one built screen in the run's viewport and scheme. */
  url: (id: string) => string;
  /** The viewport and the scheme, such as `desktop light`, that end a title. */
  label: string;
  /** The page size: a 390px phone on mobile and a 1440px window on desktop. */
  size: { width: number; height: number };
}

/** The screen address, the title label and the page size of one run. */
export function productRun(viewport: Viewport, scheme: Scheme): ProductRun {
  const url = (id: string) =>
    pathToFileURL(screenFile(id, viewport, scheme)).href;
  const label = viewport + " " + scheme;
  const size = {
    width: viewport === "mobile" ? 390 : 1440,
    height: viewport === "mobile" ? 844 : 900,
  };
  return { url, label, size };
}
