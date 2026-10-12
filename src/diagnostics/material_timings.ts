/** Detail collection has its own context and never changes core collector shape. */
import { AsyncLocalStorage } from "node:async_hooks";

import type { DocumentWork } from "./document_work.js";
import { MaterialWork } from "./material_work.js";
import {
  runWithDocumentWork,
  timingCounts,
  timingDocumentWork,
} from "./timings.js";

const storage = new AsyncLocalStorage<{
  core: DocumentWork;
  material: MaterialWork;
}>();

export function timingMaterialWork(): MaterialWork | undefined {
  const current = storage.getStore();
  return current && current.core === timingDocumentWork()
    ? current.material
    : undefined;
}

export function documentMaterialWork<T>(operation: () => T): T {
  const work = timingMaterialWork();
  return work ? work.material(operation) : operation();
}

/** The environment opt-in is read once at the classification boundary. */
export function runWithComparisonWork<T>(
  operation: () => Promise<T>,
  details = process.env.MOKLY_MATERIAL_WORK === "1",
): Promise<T> {
  if (!details) return runWithDocumentWork(operation);
  return runWithDocumentWork(() => {
    const core = timingDocumentWork();
    if (!core || timingMaterialWork()) return operation();
    const work = new MaterialWork();
    return storage.run({ core, material: work }, async () => {
      try {
        return await operation();
      } finally {
        timingCounts("review.material-work", () => work.record());
      }
    });
  });
}
