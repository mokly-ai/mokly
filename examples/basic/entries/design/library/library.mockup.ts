import { defineCollection } from "@mokly/mokly";

import { appearanceSelector } from "./chrome/appearance-selector.js";
import { catalogueNavigation } from "./chrome/catalogue-navigation.js";
import { screenHeader } from "./chrome/screen-header.js";
import { topBar } from "./chrome/top-bar.js";
import { changeStatusBadge } from "./controls/change-status.js";
import { comparisonToolbar } from "./controls/comparison-toolbar.js";
import { tagChip } from "./controls/tag-chip.js";
import { tagPicker } from "./controls/tag-picker.js";
import { viewControls } from "./controls/view-controls.js";
import { inspector } from "./inspector/inspector.js";
import { metadataRow } from "./inspector/metadata-row.js";
import { propField } from "./inspector/prop-field.js";
import { comparisonPane } from "./preview/comparison-pane.js";
import { deviceFrame } from "./preview/device-frame.js";
import { emptyState } from "./preview/empty-state.js";
import { flowStep } from "./preview/flow-step.js";

const groups = [
  {
    id: "chrome",
    title: "Chrome",
    entries: [
      topBar.entry,
      catalogueNavigation.entry,
      screenHeader.entry,
      appearanceSelector.entry,
    ],
  },
  {
    id: "controls",
    title: "Controls",
    entries: [
      comparisonToolbar.entry,
      viewControls.entry,
      tagPicker.entry,
      tagChip.entry,
      changeStatusBadge.entry,
    ],
  },
  {
    id: "inspector",
    title: "Inspector",
    entries: [inspector.entry, metadataRow.entry, propField.entry],
  },
  {
    id: "preview",
    title: "Preview",
    entries: [
      deviceFrame.entry,
      comparisonPane.entry,
      emptyState.entry,
      flowStep.entry,
    ],
  },
];
const metadata = {
  relatedDocs: ["docs/protocol/mokly-design-component-library.md"],
};
export const mockups = [
  defineCollection({
    ...metadata,
    id: "design-library",
    title: "Shared components",
    description: "The components used across Mokly's design screens.",
    childIds: groups.map((group) => `design-library-${group.id}`),
  }),
  ...groups.flatMap((group) => [
    defineCollection({
      ...metadata,
      id: `design-library-${group.id}`,
      title: group.title,
      description: `${group.title} shared across the design catalogue.`,
      childIds: group.entries.map((entry) => entry.id),
    }),
    ...group.entries,
  ]),
];
