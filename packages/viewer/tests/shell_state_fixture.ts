import { createCatalogue } from "../src/shell/catalogue.js";
import { viewerContext } from "../src/viewer/projection.js";
import { defaultSelection } from "../src/viewer/selection.js";

import { shellModelFixture } from "./catalogue_v9_fixture.js";

export const model = shellModelFixture();

export const catalogue = createCatalogue(model);

export const context = viewerContext(model, defaultSelection);
