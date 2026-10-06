import { expect, type Locator } from "@playwright/test";

/** Wait for layout before testing a native link's keyboard activation. */
export async function focusLink(link: Locator): Promise<void> {
  await link.scrollIntoViewIfNeeded();
  await link.focus();
  await expect(link).toBeFocused();
}
