/** Package-owned shell styling; concatenation preserves delivered bytes. */
export const CSS_CHROME_FLOW = `
.flow-step:last-child::before {
  display: none;
}

.flow-step-head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 14px;
}

.flow-step-num {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  background: var(--mokly-accent);
  color: var(--mokly-accent-contrast);
  font-size: 13px;
  font-weight: 800;
}

.flow-step-head h3 {
  margin: 2px 0 4px;
  font-size: 18px;
  letter-spacing: -0.005em;
}

.flow-step-head p {
  margin: 0;
  color: var(--chrome-muted);
  font-size: 14px;
  line-height: 1.55;
}

.flow-step-link {
  display: inline-block;
  margin-top: 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--mokly-accent);
  text-decoration: none;
}

.flow-step-link:hover {
  text-decoration: underline;
}

@media (max-width: 760px) {
  .phone-frame {
    width: min(390px, 100%);
    height: auto;
    aspect-ratio: 390 / 844;
  }

  .browser-frame {
    width: 100%;
    min-width: 0;
    height: 560px;
  }

  .flow-step::before {
    display: none;
  }
}
`;
