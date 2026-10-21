import {
  startNavigationFixture,
  type NavigationFixture,
} from "./navigation_fixture.js";

export const suiteState = {
  navigation: undefined! as NavigationFixture,
};

export const startSuite = async () => {
  suiteState.navigation = await startNavigationFixture();
};

export const stopSuite = async () => {
  await suiteState.navigation?.close();
};
