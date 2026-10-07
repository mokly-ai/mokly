import { object } from "../../packages/viewer/dist/catalogue/values.js";
import { invalidData } from "../../packages/viewer/dist/components/data.js";

/** Frozen v3 admission gate from main 800fe9f8, before any catalogue field reads. */
export function legacyCatalogueGate(value: unknown): void {
  const input = object(value);
  if (input.schemaVersion !== 3)
    invalidData("$catalogue", "unsupported schemaVersion");
}
