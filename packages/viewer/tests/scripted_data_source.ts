import type { CatalogueReadModel, EntryDetailV4 } from "@mokly/model";

import type { DetailRequest } from "../src/catalogue/detail_fences.js";
import type { ShellDataSource } from "../src/shell/data_source.js";

/** A source that answers from scripts and records every request. */
export function scripted(
  indexes: readonly (CatalogueReadModel | Error)[],
  detail: (request: DetailRequest) => EntryDetailV4 | Error,
) {
  const calls = { indexes: 0, details: [] as DetailRequest[] };
  const source: ShellDataSource = {
    async loadIndex() {
      const next = indexes[Math.min(calls.indexes, indexes.length - 1)]!;
      calls.indexes += 1;
      if (next instanceof Error) throw next;
      return next;
    },
    async loadDetail(request) {
      calls.details.push(request);
      const next = detail(request);
      if (next instanceof Error) throw next;
      return next;
    },
    deploymentChanged() {},
  };
  return { source, calls };
}
