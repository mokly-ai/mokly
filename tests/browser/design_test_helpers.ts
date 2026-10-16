import { expect, type Locator } from "@playwright/test";

/** Let fragment navigation finish layout before testing native keyboard focus. */
export async function focusDesignLink(link: Locator): Promise<void> {
  await link.scrollIntoViewIfNeeded();
  await link.focus();
  await expect(link).toBeFocused();
}
