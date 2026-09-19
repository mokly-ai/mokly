/** Deferred host callback failures that must outlive a replaced bridge. */

interface DeferredHostBridgeFailure {
  error: unknown;
}

interface HostBridgeFailureConsumer {
  accept(error: unknown): void;
}

const failures = new WeakMap<object, DeferredHostBridgeFailure>();
const consumers = new WeakMap<object, HostBridgeFailureConsumer>();
const barriers = new WeakMap<object, () => Promise<void>>();

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

/** Let replacement frames finish acquiring cleanup handles before surfacing a failure. */
export function registerHostBridgeFailureBarrier(
  owner: object,
  barrier: () => Promise<void>,
): () => void {
  barriers.set(owner, barrier);
  return () => {
    if (barriers.get(owner) === barrier) barriers.delete(owner);
  };
}

/** Wait for replacement ownership, bounded by the adapter mount timeout. */
export async function awaitHostBridgeFailureBarrier(
  owner: object,
): Promise<void> {
  const barrier = barriers.get(owner);
  if (!barrier) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      barrier().catch(() => undefined),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, 5_000);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
