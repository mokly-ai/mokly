# Stylesheet error text denies documented warnings

- **Severity:** Low (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-31, from the test skills review baseline on branch `calummoore/test-skills-guidelines-review`.
- **Location:** `docs/protocol/mokly-imported-styles-errors.md:85-88`.
- **Reason:** The audit records requirement conflicts. A later documentation branch can correct this scope without changing diagnostic severity.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Processing failure:** an error while Mokly resolves, transforms, or bundles a stylesheet.
  - **Declaration warning:** a warning about stylesheet configuration or ownership, rather than a processing failure.
- **Background:** Mokly treats the processing failures listed in the imported stylesheet diagnostics page as errors. Separate requirements define warnings for stylesheet declarations. The warning catalogue lists their codes.
- **Problem:** The diagnostics page says the build warning record carries no stylesheet warning. It also says every stylesheet problem is an error. The warning catalogue lists `stylesheet-extglob`, `stylesheet-owner`, and `duplicate-component-stylesheet`.
- **Impact if no action:** A reader can expect recoverable declaration warnings to reject a normal build. The broad sentence also hides the distinction between processing errors and declaration warnings.
- **Root question:** How should the diagnostics page distinguish stylesheet errors from existing warnings?
- **Options:**
  - **A.** Scope the closing statement to the processing failures listed on that page. Keep the warning catalogue link for separate declaration warnings. Effort: Small.
  - **B.** Remove the closing warning assertion. Leave the error tables and linked warning catalogue as the requirements. This removes the contradiction but leaves the scope less explicit. Effort: Small.
- **Left out:** Only two direct documentation approaches are needed: correct the scope, or remove the broad assertion. Promoting declaration warnings to errors adds default build failures for recoverable cases. A separate warning page would duplicate the existing catalogue.
- **Wider fix:** None. The documentation skill already requires aligned requirements with one owner for each fact.
- **Previous examples:** None found.
- **Recommendation:** A (estimate). It states the intended error scope and preserves every existing warning requirement.
- **Action:** fix after merge, apply A (estimate), because this audit preserves diagnostic behaviour and records the documentation conflict.

Evidence in the repository:

- `docs/protocol/mokly-build-warnings.md:53` describes `duplicate-component-stylesheet`.
- `docs/protocol/mokly-build-warnings.md:63-64` describes `stylesheet-extglob` and `stylesheet-owner`.
- `docs/protocol/mokly-component-stylesheets.md` requires the duplicate declaration warning.
- `docs/protocol/mokly-configuration.md` defines the unsupported stylesheet matcher warning.
- `docs/protocol/mokly-rendering.md` defines the stylesheet resource ownership warning.
- `crates/mokly-render/src/declarations.rs:99` emits the duplicate component stylesheet warning.
- `crates/mokly-catalogue/src/config_warnings.rs:20` emits `stylesheet-extglob`.
- `crates/mokly-graph/src/closure_seeds.rs:30` emits `stylesheet-owner` for a renderer resource seed.

Keep processing failures as errors. Keep declaration warning codes, messages, and strict-mode handling unchanged. Do not add a test of protocol prose. Check Markdown formatting, local links, and the final diff.
