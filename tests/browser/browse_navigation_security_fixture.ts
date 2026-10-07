import { expect, type Page } from "@playwright/test";

import {
  startNavigationFixture,
  type NavigationFixture,
} from "./navigation_fixture.js";

export const suiteState = {
  navigation: undefined! as NavigationFixture,
};

export async function expectDestination(page: Page): Promise<void> {
  await expect(page).toHaveURL(
    /\/view\/screens\/details\.html\?fragment=section$/,
  );
  await expect(page.locator("#mb-main h2")).toHaveText("Details");
}

export const startSuite = async () => {
  suiteState.navigation = await startNavigationFixture();
};

export const stopSuite = async () => {
  await suiteState.navigation?.close();
};
