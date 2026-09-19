/** Deferred host callback failures that must outlive a replaced bridge. */

interface DeferredHostBridgeFailure {
  error: unknown;
}

interface HostBridgeFailureConsumer {
  accept(error: unknown): void;
}

const failures = new WeakMap<object, DeferredHostBridgeFailure>();
const consumers = new WeakMap<object, HostBridgeFailureConsumer>();

/** Preserve a cleanup failure until the replacement bridge enters React. */
export function deferHostBridgeFailure(owner: object, error: unknown): void {
  const failure = { error };
  failures.set(owner, failure);
  setTimeout(() => {
    if (failures.get(owner) !== failure) return;
    failures.delete(owner);
    const consumer = consumers.get(owner);
    if (consumer) {
      consumer.accept(error);
      return;
    }
    throw error;
  }, 0);
}

/** Transfer a deferred cleanup failure after React drains passive cleanups. */
export function consumeHostBridgeFailure(
  owner: object,
  accept: HostBridgeFailureConsumer["accept"],
): () => void {
  const consumer = { accept };
  consumers.set(owner, consumer);
  return () => {
    if (consumers.get(owner) === consumer) consumers.delete(owner);
  };
}
