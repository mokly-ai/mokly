/** Record native navigation disclosure choices before later filter input. */

import type { ShellStore } from "./store_context.js";

/** Own interactive activation while leaving non-interactive native behavior intact. */
export function activateDisclosure(
  event: { preventDefault(): void },
  store: Pick<ShellStore, "interactive" | "setDisclosure"> | undefined,
  key: string,
  open: boolean,
): void {
  if (!store?.interactive) return;
  event.preventDefault();
  store.setDisclosure(key, !open);
}
