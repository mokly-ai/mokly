import { useDesignInstance } from "../../../library/composition.js";
import { framesFilter } from "../../../library/inspector/frames-filter.js";
import { CANVAS_ENTRIES } from "../../parts/entries.js";
import {
  InspectHead,
  InspectSection,
  InspectSelection,
} from "../../parts/inspect.js";

import { TOUR_STEPS, type StepFrames } from "./steps.js";

/**
 * Inspect for the Example tour: its head with its description, path and
 * source; the Frames section, whose filter chooses one viewport and one
 * scheme for every step, with Highlight components available, because both
 * step screens render registered components; and the Selection section, as a
 * click on a step frame selects there. A use case has no props, usage or
 * component tree of its own, and its comparisons stay on its steps' screens,
 * so Inspect is its one tab.
 */
export function UseCaseInspect({
  chosen,
  initial,
}: {
  chosen: StepFrames;
  /** The panel opens scrolled to the Frames section. */
  initial?: boolean | undefined;
}) {
  return (
    <>
      <InspectHead
        description="An ordered journey that reuses both canonical screens."
        entry={CANVAS_ENTRIES.tour}
        source="specs/catalogue.tsx"
      />
      <InspectSection
        count={TOUR_STEPS.length}
        initial={initial}
        title="Frames"
      >
        <framesFilter.Component
          moklyInstance={useDesignInstance("frames")}
          viewports
          mobile={chosen.viewport === "mobile"}
          desktop={chosen.viewport === "desktop"}
          light={chosen.scheme === "light"}
          dark={chosen.scheme === "dark"}
          single
          highlight={false}
        />
      </InspectSection>
      <InspectSelection />
    </>
  );
}
