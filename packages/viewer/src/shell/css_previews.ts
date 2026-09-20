/** Package-owned styling for previous versions of removed entries. */
export const SHELL_PREVIEW_CSS = `
.mbk-previous {
  flex-shrink: 0;
  margin: 0;
  padding: 8px 24px;
  border-bottom: 1px solid var(--chrome-border);
  background: var(--chrome-surface);
  color: var(--chrome-muted);
  font-size: 11.5px;
}

.mbk-preview {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
}

.mbk-preview-state {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: 0;
}

.mbk-preview > .mbk-stage > .mbk-empty,
.mbk-preview > .mbk-stage > .mbk-preview-state {
  align-self: stretch;
}

.mbk-preview-status {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  color: var(--chrome-ink-2);
  font-size: 13px;
}

.mbk-preview-spinner {
  display: inline-block;
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  border: 1.5px solid var(--chrome-border);
  border-top-color: var(--chrome-muted);
  border-radius: 50%;
  animation: mbk-preview-spin 0.8s linear infinite;
}

.mbk-preview button.mbk-empty-link {
  border: 0;
  background: none;
  padding: 0;
  font: inherit;
  font-weight: 600;
  color: var(--mokly-accent);
  cursor: pointer;
}

@keyframes mbk-preview-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .mbk-preview-spinner {
    animation: none;
  }
}

@media (max-width: 56.25rem) {
  .mbk-workspace .mbk-previous {
    padding: 8px 12px;
  }
}

@media (max-width: 760px) {
  .mbk-previous {
    padding: 8px 16px;
  }
}
`;
