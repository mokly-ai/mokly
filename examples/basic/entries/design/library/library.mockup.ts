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

export const mockups = [
  topBar.entry,
  catalogueNavigation.entry,
  screenHeader.entry,
  appearanceSelector.entry,
  comparisonToolbar.entry,
  viewControls.entry,
  tagPicker.entry,
  tagChip.entry,
  changeStatusBadge.entry,
  inspector.entry,
  metadataRow.entry,
  propField.entry,
  deviceFrame.entry,
  comparisonPane.entry,
  emptyState.entry,
  flowStep.entry,
];
