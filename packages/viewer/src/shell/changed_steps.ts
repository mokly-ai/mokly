/**
 * The `Changed step:` lines of a use case's comparison details, under the
 * [comparison details design](../../../../docs/protocol/mokly-component-workspace-design.md#comparison-details):
 * a `screen` reason, which only a use case carries, gives one line for each
 * step whose screen changed, with the step's title as a link to that step's
 * screen. Only a record that Changes lists shows reasons.
 */

import type { EntryChangeReason, UseCaseStep } from "@mokly/model";
import type { EvidenceLink } from "@mokly/ui/comparison-evidence";

import type { ShellCatalogueScreen } from "../catalogue/scoped_types.js";
import { viewHref } from "../navigation/routes.js";

/**
 * One link for each step whose screen a `screen` reason names, in step
 * order, so two steps that show one changed screen give two links. A step is
 * named as the canvas names it, by its own title or else its screen's, and a
 * step whose screen is not among `screens`, the catalogue's current screens
 * that the canvas shows, has no link, as it has no frame there. `reasons` are
 * the reasons that Details shows: a record outside Changes has none, so it
 * has no link.
 */
export function changedSteps(
  steps: readonly UseCaseStep[],
  reasons: readonly EntryChangeReason[] | undefined,
  screens: readonly Pick<ShellCatalogueScreen, "path" | "title">[],
): EvidenceLink[] {
  const changed = new Set(
    (reasons ?? []).flatMap((reason) =>
      reason.kind === "screen" ? [reason.screenPath] : [],
    ),
  );
  return steps.flatMap((step, index) => {
    if (!changed.has(step.screenPath)) return [];
    const screen = screens.find(({ path }) => path === step.screenPath);
    return screen
      ? [
          {
            href: viewHref(step.screenPath),
            key: `step-${index}`,
            title: step.title ?? screen.title,
          },
        ]
      : [];
  });
}
