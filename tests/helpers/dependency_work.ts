import { Minimatch } from "minimatch";

import { packageOwnedRoots } from "../../dist/build/package_owned_paths.js";
import type { DependencyWork } from "../../dist/build/styles/dependency_walk.js";

/** Count PostCSS inventory work while retaining the real implementations. */
export function countingDependencyWork() {
  const counts = { sorts: 0, rootProjections: 0, globCompilations: 0 };
  const work: DependencyWork = {
    sort(values, compare) {
      counts.sorts += 1;
      return values.sort(compare);
    },
    projectRoots(config) {
      counts.rootProjections += 1;
      return packageOwnedRoots(config);
    },
    compileGlob(glob) {
      counts.globCompilations += 1;
      return new Minimatch(glob, { dot: true, nocase: false });
    },
  };
  return { counts, work };
}
