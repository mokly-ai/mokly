/**
 * A use case's own Frames choice: one viewport and one scheme, which every
 * step frame shows. The use case opens on Desktop and Light at and above the
 * layout breakpoint, and on Mobile and Light in the compact layout. A choice
 * in its Frames filter applies to that use case alone, so another use case,
 * or the same one in the other layout, opens on its opening choice again.
 * The screens' filter neither reads nor changes it.
 */

import { useState } from "react";

import type { FramesToggleName } from "@mokly/ui/frames-filter";

import {
  openingUseCaseChoice,
  type UseCaseFramesChoice,
} from "./canvas_use_case_frames.js";
import { chosenUseCase } from "./frames_filter.js";

/** The routed use case's choice, and how its filter changes it. */
export function useUseCaseChoice(
  path: string | undefined,
  wide: boolean,
): [UseCaseFramesChoice, (name: FramesToggleName) => void] {
  const owner = `${path ?? ""}:${wide}`;
  const [stored, setStored] = useState<{
    choice: UseCaseFramesChoice;
    owner: string;
  }>();
  const choice =
    stored?.owner === owner ? stored.choice : openingUseCaseChoice(wide);
  return [
    choice,
    (name) => setStored({ choice: chosenUseCase(choice, name), owner }),
  ];
}
