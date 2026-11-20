# Watched Serve diagnostics flatten location lists

- **Severity:** Low. **Likelihood:** Common. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-20, while checking the post-push review of branch `calummoore/fu-base-diagnostic-location-lines-udeb`.
- **Location:** `crates/mokly-cli/src/watch_diagnostics.rs:13`, `crates/mokly-cli/src/watch_output.rs:82`, `crates/mokly-cli/src/serve_reporter.rs:229`, and `crates/mokly-cli/src/_tests_/watch_diagnostics_tests.rs`.
- **Reason:** This watched printer predates the base location-list change and lies outside that change's diff.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Watched diagnostic:** A source error that Serve prints after a catalogue rebuild fails.
  - **List diagnostic:** A catalogue message with a heading followed by indented source locations.
- **Background:** `watch_diagnostics::diagnostics` formats catalogue issues with their source code and location. It passes every complete message through `Redactor::safe`. `watch_output::failure` writes these bytes directly in plain mode. Rich mode indents each physical line by twelve spaces and bounds that line to the terminal width. Serve keeps the last good catalogue after the failure.
- **Problem:** `Redactor::safe` turns every location separator into literal `\u000a` text. The watched printer therefore flattens duplicate-path, case-collision, and other location-list diagnostics before the rich per-line formatter sees them.
- **Impact if no action:** Serve shows escaped separators instead of a location list. Rich truncation can hide later locations in the single line.
- **Root question:** How should watched Serve retain a list diagnostic's structural lines while keeping its existing location and code layout?
- **Options:**
  - **A.** Use the shared `build_output::has_location_lines` classifier in the watched printer. Keep list separators with `safe_lines` and use `safe` for other text. Preserve current watched prefixes and per-line bounds. Effort: Small.
  - **B.** Route watched catalogue issues through the existing build error-block presentation. This changes the watched outer code and rich layout, so it needs a user decision on that behavior. Effort: Small.
  - **C.** Centralize catalogue issue control escaping and line-kind selection in one CLI helper shared by build, base, and watched output. Keep each caller's current prefixes and width behavior. This removes the separate watched escaping rule. Effort: Medium.
- **Left out:** Preserve every message newline without classification. Ordinary authored newlines must stay escaped. Changing nothing leaves the location-list rule broken.
- **Wider fix:** C. One shared issue presentation rule prevents these printers from selecting different escaping modes.
- **Previous examples:** `build_output::failure_diagnostics` keeps list lines for the head. `changes_output::diagnostics` retains catalogue codes and keeps base list lines through the same classifier.
- **Requirements:** `docs/protocol/mokly-terminal-errors.md:52` requires locations on following lines, with controls escaped per line. Existing watched prefixes stay unchanged. Each rich continuation keeps its own width bound.
- **Tests:** The current watched diagnostic unit test covers one ordinary `HtmlElement` issue in plain mode. It does not cover a list. Extend coverage through `watch_diagnostics::diagnostics` and `watch_output::failure` without removing that assertion.
- **Compatibility:** The list builders escape controls in authored values before joining structural location lines. Keep those escapes when this printer preserves structural separators.
- **Recommendation:** C. It keeps the watched layout while sharing the rule already used by head and base output.
- **Action:** fix after merge, apply C, because this separate watched printer is outside the base-detail follow-up's scope. No implementation starts in the branch that records this item.
