import preview from "./.storybook/preview.js";
import { load, setup, trace } from "./state.js";

const meta = preview.meta({
  title: "Setup/Before each",
  loaders: [load],
  beforeEach: setup("meta"),
  afterEach: () => {
    throw new Error("afterEach must not run");
  },
  play: () => {
    throw new Error("play must not run");
  },
  render: () => <output>{trace()}</output>,
});

export const Prepared = meta.story({ beforeEach: setup("story") });
export const Next = meta.story({ beforeEach: setup("story") });
