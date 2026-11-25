import type { NavigationState } from "../../../parts/navigation_states.js";
import { CANVAS_PAGES as C } from "../../parts/destinations.js";

import { PROPS_PAGES as P, type PropsDestination } from "./destinations.js";

/**
 * A state of the Action's variant set with a variant chosen: the set fits at
 * full size, so Fit keeps the state. No artboard shows these states with the
 * panel sheet closed, so the sheet's close is a picture, as on the variant
 * set's own chosen variant.
 */
const fitted = (fit: PropsDestination) => ({ canvas: { fit } });

/**
 * The authored transitions of the Props and controls artboards.
 * `../../parts/navigation_states.ts` spreads them into the family's states.
 * Details, the screen without props, opens its Changes tab, and its panel
 * sheet closes onto Details on Inspect with the sheet closed. While the
 * route's details load or failed, the canvas holds no section, so it has no
 * Fit.
 */
export const PROPS_NAVIGATION_STATES = {
  [P.propsEditing]: fitted(P.propsEditing),
  [P.propsEdited]: fitted(P.propsEdited),
  [P.propsUnset]: fitted(P.propsUnset),
  [P.propsReset]: fitted(P.propsReset),
  [P.propsPending]: fitted(P.propsPending),
  [P.propsInvalid]: fitted(P.propsInvalid),
  [P.propsInvalidTogether]: fitted(P.propsInvalidTogether),
  [P.propsError]: fitted(P.propsError),
  [P.propsLaterEdit]: fitted(P.propsLaterEdit),
  [P.propsLaterPending]: fitted(P.propsLaterPending),
  [P.propsExpired]: fitted(P.propsExpired),
  [P.propsPreparing]: fitted(P.propsPreparing),
  [P.propsPreparingFailed]: fitted(P.propsPreparingFailed),
  [P.propsPublished]: fitted(P.propsPublished),
  [P.propsPublishedDisabled]: fitted(P.propsPublishedDisabled),
  [P.propsNoProps]: {
    canvas: { changesTab: C.addedChanges, fit: P.propsNoProps, close: C.added },
  },
  [P.propsLoading]: {},
  [P.propsLoadingFailed]: {},
} satisfies Record<PropsDestination, NavigationState>;
