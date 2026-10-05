import { modules, interactiveRenderer } from "mokly:interactive-consumer";

import { resolveInteractiveDefinitions } from "./definitions.js";
import { mountInteractiveDocument } from "./mount.js";

mountInteractiveDocument({
  definitions: resolveInteractiveDefinitions(modules),
  ...(interactiveRenderer ? { interactiveRenderer } : {}),
});
