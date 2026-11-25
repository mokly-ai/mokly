import { __definePreview } from "@storybook/react";

import { setup } from "../state.js";

export default __definePreview({
  addons: [{ beforeEach: setup("addon") }],
  beforeEach: setup("preview"),
});
