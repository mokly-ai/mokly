/** Package-owned shell styling; concatenation preserves delivered bytes. */
export const CSS_WORKSPACE_MARKS = `
/* A disabled view control mutes the dot of its @mokly/ui/change-mark. */
.mbk-icon-button:disabled .mbk-view-changed,
.mbk-icon-select:has(select:disabled) .mbk-view-changed {
  background: var(--chrome-muted);
}

.mbk-meta-row[hidden] {
  display: none;
}
`;
