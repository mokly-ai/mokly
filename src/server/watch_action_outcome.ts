/** Typed source and delivery outcomes for one watched Serve action. */

/** Failure phase that determines whether browser rebuild status changes. */
export enum WatchActionFailurePhase {
  Delivery = "delivery",
  Source = "source",
}

/** One watched action that completed without a reported failure. */
export interface CompletedWatchAction {
  readonly type: "completed";
}

/** One watched action whose typed phase failed. */
export interface FailedWatchAction {
  readonly error: unknown;
  readonly phase: WatchActionFailurePhase;
  readonly type: "failed";
}

/** Terminal result reported by the serialized watch queue. */
export type WatchActionOutcome = CompletedWatchAction | FailedWatchAction;

/** Post-adoption work that delivers an accepted runtime. */
export type WatchActionDelivery = () => Promise<void>;

/** Shared immutable success result. */
export const completedWatchAction: CompletedWatchAction = Object.freeze({
  type: "completed",
});

/** Construct a typed failure without changing its original diagnostic. */
export function failedWatchAction(
  phase: WatchActionFailurePhase,
  error: unknown,
): FailedWatchAction {
  return Object.freeze({ error, phase, type: "failed" });
}

/** Run an action that has no source-adoption phase. */
export async function deliveryPhaseWatchAction(
  delivery: WatchActionDelivery,
): Promise<WatchActionOutcome> {
  try {
    await delivery();
    return completedWatchAction;
  } catch (error) {
    return failedWatchAction(WatchActionFailurePhase.Delivery, error);
  }
}

/** Run source preparation, then classify only returned post-adoption work as delivery. */
export async function sourcePhaseWatchAction(
  source: () => Promise<WatchActionDelivery | undefined>,
): Promise<WatchActionOutcome> {
  let delivery: WatchActionDelivery | undefined;
  try {
    delivery = await source();
  } catch (error) {
    return failedWatchAction(WatchActionFailurePhase.Source, error);
  }
  return delivery ? deliveryPhaseWatchAction(delivery) : completedWatchAction;
}
