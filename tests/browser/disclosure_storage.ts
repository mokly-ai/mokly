import type { Page } from "@playwright/test";

/** Read the persisted v4 map and fail clearly if storage is absent or malformed. */
export async function readDisclosureStorage(
  page: Page,
): Promise<Record<string, unknown>> {
  return page.evaluate(() => {
    const raw = localStorage.getItem("mokly:nav-disclosure:v4");
    if (raw === null) throw new Error("v4 disclosure storage is missing");
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
      throw new Error("v4 disclosure storage is not an object");
    return parsed as Record<string, unknown>;
  });
}
