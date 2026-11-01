import { createCatalogue } from "../src/shell/catalogue.js";
import { shellContext } from "../src/shell/projection.js";
import { defaultSelection } from "../src/shell/selection.js";

import { shellModelFixture } from "./catalogue_v9_fixture.js";

export const model = shellModelFixture();

export const catalogue = createCatalogue(model);

export const context = shellContext(model, defaultSelection);
