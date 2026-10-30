/** Package-owned shell styling; concatenation preserves delivered bytes. */

export const CSS_VIEWS_LAYOUT = `
.mbk-main {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
}

/* Frames centre only while they fit: plain centring would push the start of a
   row wider than the stage left of the scroll origin, out of reach. */
.mbk-stage {
  flex: 1;
  display: flex;
  justify-content: safe center;
  align-items: flex-start;
  gap: 40px;
  min-height: 0;
  padding: 28px;
  overflow: auto;
  background: radial-gradient(
      circle at center,
      var(--mbk-dot) 1px,
      transparent 1px
    )
    0 0 / 22px 22px;
}

.mbk-frame-wrap {
  min-width: 0;
}

.mbk-frame-mobile {
  flex: 0 0 auto;
}

.mbk-frame-desktop {
  flex: 0 1 1180px;
  min-width: 0;
}

.mbk-frame-desktop .browser-frame {
  width: 100%;
}

.mbk-frame-label {
  margin: 0 0 10px;
  color: var(--chrome-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

`;
