import {
  createMetafilePathMapper,
  type MetafilePathMapper,
} from "../../dist/build/metafile_paths.js";

/** Observe work through the existing mapper seam without patching globals. */
export function countingMetafileMapper(workingDir: string) {
  const delegate = createMetafilePathMapper(workingDir);
  const counts = { keys: 0, paths: 0 };
  const mapper: MetafilePathMapper = {
    key(candidate) {
      counts.keys += 1;
      return delegate.key(candidate);
    },
    path(key) {
      counts.paths += 1;
      return delegate.path(key);
    },
  };
  return { counts, mapper };
}
