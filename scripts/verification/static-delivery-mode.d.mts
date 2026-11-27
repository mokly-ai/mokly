/** The delivery modes in the order that a complete check runs them. */
export const DELIVERY_MODES: readonly string[];

/** Both delivery modes without arguments, or the one mode of `--mode MODE`. */
export function deliveryModes(args: readonly string[]): string[];

/** Require complete passing evidence after a delivery child exits successfully. */
export function checkDeliveryMode(
  run: () => Promise<void>,
  read: () => Promise<unknown>,
): Promise<void>;
