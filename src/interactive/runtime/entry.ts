import { definitions, interactiveRenderer } from "mokly:interactive-consumer";

import { mountInteractiveDocument } from "./mount.js";

mountInteractiveDocument({
  definitions,
  ...(interactiveRenderer ? { interactiveRenderer } : {}),
});
