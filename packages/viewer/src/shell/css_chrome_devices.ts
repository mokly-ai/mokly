/** Package-owned shell styling; concatenation preserves delivered bytes. */
export const CSS_CHROME_DEVICES = `
.phone-frame {
  position: relative;
  width: 390px;
  height: 844px;
  padding: 12px;
  border-radius: 46px;
  background: var(--mbk-device-body);
}

.phone-notch,
.phone-home {
  pointer-events: none;
}

.phone-notch {
  position: absolute;
  top: 22px;
  left: 50%;
  z-index: 2;
  width: 108px;
  height: 30px;
  transform: translateX(-50%);
  border-radius: 999px;
  background: var(--mbk-device-notch);
}

.phone-screen {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  border-radius: 36px;
  background: var(--mbk-screen-bg);
}

.phone-status {
  position: relative;
  z-index: 1;
  flex: 0 0 44px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  height: 44px;
  padding: 14px 28px 0;
  color: var(--mbk-screen-ink);
  font-size: 13.5px;
  font-weight: 600;
  font-feature-settings: "tnum";
}

.phone-status-icons {
  display: flex;
  gap: 6px;
  align-items: center;
}

.phone-home {
  position: absolute;
  left: 50%;
  bottom: 20px;
  width: 128px;
  height: 4px;
  transform: translateX(-50%);
  border-radius: 999px;
  background: var(--mbk-device-home);
  pointer-events: none;
}

.browser-frame {
  width: 100%;
  max-width: 1180px;
  height: 760px;
  overflow: hidden;
  border: 1px solid var(--chrome-border-strong);
  border-radius: 8px;
  background: var(--chrome-surface);
}

.browser-bar {
  position: relative;
  height: 40px;
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 0 14px;
  background: var(--mbk-browser-bar);
  border-bottom: 1px solid var(--chrome-border);
}

.lights {
  display: inline-flex;
  gap: 6px;
}

.lights i {
  width: 11px;
  height: 11px;
  border-radius: 999px;
  background: var(--chrome-border-strong);
}

.lights i:first-child {
  background: var(--mbk-device-light-close);
}

.lights i:nth-child(2) {
  background: var(--mbk-device-light-minimise);
}

.lights i:nth-child(3) {
  background: var(--mbk-device-light-expand);
}

.address {
  flex: 1;
  max-width: 520px;
  height: 26px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  border: 1px solid var(--chrome-border);
  border-radius: 6px;
  background: var(--chrome-surface);
  color: var(--chrome-muted);
  font-family: var(--mono);
  font-size: 12px;
  cursor: pointer;
  user-select: none;
  transition:
    background 0.12s ease,
    color 0.12s ease;
}

.address-url {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.address-copy {
  display: inline-flex;
  flex-shrink: 0;
  margin-left: auto;
  padding-left: 10px;
  color: var(--chrome-muted);
}

.address:hover {
  background: var(--chrome-surface);
  color: var(--chrome-ink);
}

.address:hover .address-copy {
  color: var(--chrome-accent);
}

.address-copied {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--chrome-ink);
  color: var(--chrome-surface);
  padding: 5px 10px;
  border-radius: 6px;
  font-family: var(--sans);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  white-space: nowrap;
  z-index: 100;
  pointer-events: none;
  box-shadow: var(--chrome-shadow-sheet);
  animation: addressCopiedIn 0.18s ease-out;
}
`;
