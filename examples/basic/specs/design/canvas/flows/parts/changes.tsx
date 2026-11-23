import { mockLink } from "@mokly/mokly";

import { useDesignInstance } from "../../../library/composition.js";
import { changeStepper } from "../../../library/panels/change-stepper.js";
import { CHANGED_COUNT } from "../../../parts/nav_data.js";
import { ChangesCompared } from "../../parts/changes.js";
import { CANVAS_PAGES as C } from "../../parts/destinations.js";
import { changePosition } from "../../parts/nav_rows.js";

import { TOUR_STEPS, type UseCaseStep } from "./steps.js";

/**
 * The comparison details of a use case: the heading, then one line for each
 * step whose screen the branch changed, whose title opens that screen on its
 * Changes tab. A `screen` reason gives no reason sentence. `ComparisonEvidence`
 * of `@mokly/ui` has no input for changed steps yet, so this part draws its
 * section with the package's own markup, classes and mark, and words each
 * line as the package words a `Changed component:` line. It gives way to the
 * package section once the package takes the changed steps.
 */
function ChangedSteps({ steps }: { steps: readonly UseCaseStep[] }) {
  return (
    <div className="cv-sec cv-evidence">
      <section
        className="mbk-comparison-evidence mbk-reset"
        data-workspace-evidence=""
      >
        <h3 className="mbk-reset">Comparison details</h3>
        {steps.map(({ changes, name, title }) =>
          changes === undefined ? null : (
            <p className="mbk-reset" key={name}>
              {/* String expressions keep the text nodes that Prettier would join. */}
              {"Changed step:"}{" "}
              <a className="mbk-reset" href={mockLink(changes)}>
                {title}
              </a>
            </p>
          ),
        )}
      </section>
    </div>
  );
}

/**
 * The Changes tab of the Example tour, the third of the branch's changes:
 * the stepper, whose Previous change opens Details in Changes and whose Next
 * change opens the moved Invoice in Changes; Compared; and the comparison
 * details, which name each changed step. A use case offers no compare mode,
 * because the comparison of each step stays on the step's screen, so the tab
 * holds no Compare section. The cloud's check stands after the stepper; the
 * open-source panel leaves that place empty.
 */
export function UseCaseChanges() {
  return (
    <>
      <changeStepper.Component
        moklyInstance={useDesignInstance("stepper")}
        position={changePosition("example/tour")}
        total={CHANGED_COUNT}
        previousDestination={C.addedChanges}
        nextDestination={C.moved}
      />
      <ChangesCompared />
      <ChangedSteps steps={TOUR_STEPS} />
    </>
  );
}
