import { isDesktopShell } from "../../navigation/desktop-shell";
import { readQuery } from "../../navigation/query";
import { openBeside } from "../../navigation/web-setup";
import type { Write } from "../write";

/** How the reader arrived back from a Stripe-hosted Checkout session. */
export type Landing = "success" | "cancelled";

/** The Checkout return that the pane's address carries, if any. */
export function landingOf(search: string): Landing | undefined {
  const value = readQuery(search).checkout;
  const one = Array.isArray(value) ? value[0] : value;
  return one === "success" || one === "cancelled" ? one : undefined;
}

/** The pane's address without the Checkout return. */
export function withoutCheckout(pathname: string, search: string): string {
  const query = new URLSearchParams(search);
  query.delete("checkout");
  const rest = query.toString();
  return rest.length > 0 ? `${pathname}?${rest}` : pathname;
}

/**
 * Whether Stripe's pages open outside this page: in the desktop app's window,
 * they open in the system browser, where the reader's saved cards and
 * sign-ins are, and no Stripe page loads in the window.
 */
export function opensStripeOutside(): boolean {
  return isDesktopShell();
}

/**
 * Hand the reader to a Stripe-hosted page. A browser tab leaves for it
 * through the write, which stays busy until the page goes. The desktop app's
 * window opens it as a popup, which the shell opens in the system browser, so
 * the write comes back to rest.
 */
export function openStripe(write: Write, address: string): void {
  if (opensStripeOutside()) openBeside(address);
  else write.leave(address);
}
