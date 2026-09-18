/** Loading and result counts occupy the same space; reduced motion stays legible. */
export const SHELL_NAV_STATUS_CSS = `
.mbk-nav-filter-count {
  display: inline-grid;
  place-items: center;
  width: 4ch;
  height: 15px;
  line-height: 1;
}

.mbk-nav-filter-count:has(.mbk-nav-spinner) {
  background: none;
}

.mbk-nav-spinner {
  display: inline-block;
  width: 11px;
  height: 11px;
  flex-shrink: 0;
  border: 1.5px solid var(--chrome-border);
  border-top-color: var(--chrome-muted);
  border-radius: 50%;
  animation: mbk-nav-spin 0.8s linear infinite;
}

.mbk-nav-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 8px;
  color: var(--chrome-muted);
  font-size: 12px;
  line-height: 1.5;
}

.mbk-nav-status[hidden] { display: none; }

.mbk-nav-status:has(.mbk-nav-status-text) {
  align-items: flex-start;
}

.mbk-nav-status:has(.mbk-nav-status-text) .mbk-nav-spinner {
  margin-top: 3px;
}

.mbk-nav-status-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.mbk-nav-status-title {
  color: var(--chrome-ink-2);
  font-weight: 600;
}

.mbk-nav-status-detail {
  color: var(--chrome-muted);
  font-size: 11.5px;
}

@keyframes mbk-nav-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .mbk-nav-spinner { animation: none; }
}
`;
