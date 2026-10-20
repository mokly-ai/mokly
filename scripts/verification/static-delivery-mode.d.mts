/** Require complete passing evidence after a delivery child exits successfully. */
export function checkDeliveryMode(
  run: () => Promise<void>,
  read: () => Promise<unknown>,
): Promise<void>;
