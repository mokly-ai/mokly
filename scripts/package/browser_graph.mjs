import {
  loadBrowserClientModules,
  loadBrowserNavigationModules,
} from "../../dist/server/client_modules.js";

import { inspectDeliveredBrowserGraph } from "./browser_graph_analysis.mjs";

/** Check the exact delivered inventory, not unused build-directory files. */
export function inspectBrowserGraph() {
  const modules = new Map([
    ...[...loadBrowserClientModules()].map(([name, bytes]) => [
      `/__mokly/client/${name}`,
      bytes,
    ]),
    ...[...loadBrowserNavigationModules()].map(([name, bytes]) => [
      `/__mokly/navigation/${name}`,
      bytes,
    ]),
  ]);
  return inspectDeliveredBrowserGraph(modules);
}
