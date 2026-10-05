import type { AffectedConsumer } from "./component_types.js";

/** Canonical UTF-16 sort key for one affected-consumer identity. */
export function affectedConsumerOrderKey(
  record: Pick<AffectedConsumer, "changedComponentId" | "consumer">,
): string {
  return `${record.changedComponentId}\u0000${record.consumer.kind}\u0000${record.consumer.path}`;
}
