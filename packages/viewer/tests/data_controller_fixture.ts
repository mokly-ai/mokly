/** One data controller over fake transports, with a mutable current route. */

import type { CatalogueReadModel } from "../src/catalogue/types.js";
import type { MoklyVersionError } from "../src/catalogue/version_error.js";
import {
  initialSnapshot,
  type ShellDataSnapshot,
} from "../src/shell/data_commit.js";
import { ShellDataController } from "../src/shell/data_controller.js";
import { routeDetailRequests } from "../src/shell/data_requests.js";
import { routeFromUrl, type ShellRoute } from "../src/shell/routes.js";

import { FakeDataSource } from "./data_fakes.js";

/** A controller, its fakes, and what it reported to its host. */
export function controllerFixture(
  index: CatalogueReadModel,
  options: { live?: boolean; path?: string; static?: boolean } = {},
) {
  const source = new FakeDataSource(
    options.live ?? false,
    options.static ?? false,
  );
  const commits: ShellDataSnapshot[] = [];
  const versionErrors: MoklyVersionError[] = [];
  const warnings: string[] = [];
  const initial = initialSnapshot(index);
  let route = routeAt(initial, options.path ?? "/");
  let firstRequest = true;
  const controller = new ShellDataController(initial, source, {
    commit: (next) => commits.push(next),
    route: () => route,
    versionError: (error) => versionErrors.push(error),
    warn: (message) => warnings.push(message),
  });
  return {
    controller,
    source,
    live: source.live!,
    commits,
    versionErrors,
    warnings,
    /** Route the shell to a path of the installed index and request its details. */
    navigate(path: string): ShellRoute {
      route = routeAt(controller.snapshot, path);
      const requests = routeDetailRequests(controller.snapshot.index, route);
      controller.request(requests, !firstRequest);
      firstRequest = false;
      return route;
    },
    route: () => route,
  };
}

function routeAt(snapshot: ShellDataSnapshot, path: string): ShellRoute {
  return routeFromUrl(
    snapshot.catalogue,
    new URL(path, "https://catalogue.test"),
  );
}
