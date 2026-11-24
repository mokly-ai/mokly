/**
 * The compact layout's pick of a use case's step frame. The canvas shows one
 * step frame at a time, the first step's when the use case opens, and the
 * entry bar's frame picker lists every step frame by its name, such as
 * `1 · Welcome`. A pick belongs to its use case, so another use case opens
 * on its first step again.
 */

import { useState } from "react";

import type { EntryBarPicker } from "@mokly/ui/entry-bar";

import type { ShellCatalogueRoutedEntry } from "../catalogue/scoped_types.js";

import { frameChoices } from "./canvas_compact.js";
import { useCanvasLayout } from "./canvas_layout.js";
import {
  useCaseFrames,
  type UseCaseFramesChoice,
} from "./canvas_use_case_frames.js";
import type { Catalogue } from "./catalogue.js";

/** The step frame that the compact canvas shows, and the entry bar's picker. */
export interface UseCasePick {
  /** The key of the step frame that the canvas shows alone. */
  picked: string;
  picker: EntryBarPicker;
}

/**
 * The compact layout's pick of the routed use case's step frame; none in the
 * wide layout, for another entry, or for a use case without a step frame.
 */
export function useUseCasePick(
  catalogue: Catalogue,
  entry: ShellCatalogueRoutedEntry | undefined,
  choice: UseCaseFramesChoice,
): UseCasePick | undefined {
  const wide = useCanvasLayout();
  const [pick, setPick] = useState<{ key: string; path: string }>();
  if (wide || entry?.kind !== "use-case") return undefined;
  const frames = useCaseFrames(catalogue.publicModel.screens, entry, choice);
  const first = frames[0];
  if (!first) return undefined;
  const picked =
    pick?.path === entry.path && frames.some(({ key }) => key === pick.key)
      ? pick.key
      : first.key;
  return {
    picked,
    picker: {
      frames: frameChoices(frames),
      onChange: (key) => setPick({ key, path: entry.path }),
      value: picked,
    },
  };
}
