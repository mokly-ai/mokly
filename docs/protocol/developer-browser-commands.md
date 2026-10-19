# Developer Browser Commands

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

Continuation of [Developer Test Commands](./developer-test-commands.md).

## Browser Selection

Select browser tests by spec path and Playwright's `-g` name filter:

```bash
npm run test:browser -- tests/browser/pages.spec.ts -g "retain metadata"
```

After a build, the same selection can use
`npx playwright test tests/browser/pages.spec.ts -g "retain metadata"`. The
browser suite sets `forbidOnly`. Use paths and `-g` to select tests; never use
`.only`. [CI verification](./ci-verification.md#gate-ownership) defines spec discovery.

Shared Serve uses `refs/mokly/browser-suite-no-base` and waits for settled usage and unavailable Changes.
It requires one `git-failed` line. Real Changes specs own separate Git fixtures.

Global setup copies the current-only example for most `static_*.spec.ts`, `stage_centring`,
and `review_snapshot_links`. A second two-commit fixture serves comparison specs; [fixture APIs](../../tests/browser/README.md) describe both.
To supply current-only output, set `MOKLY_PLAYWRIGHT_STATIC_DIR`. For example:

```bash
npx mokly build --config examples/basic/mokly.config.json --no-changes --out ../../.context/example
MOKLY_PLAYWRIGHT_STATIC_DIR=.context/example npm run test:browser -- tests/browser/browse_chrome.spec.ts
```

The host uses exact files and a free port. Supplied output must have Changes disabled.
Browser specs support POSIX only. Do not assume empty Changes in remote Testboxes.
`MOKLY_PLAYWRIGHT_FILE_DIR` selects the same built directory for design checks
that open portable documents directly through `file://` URLs.

For example, after the build above:

```bash
MOKLY_PLAYWRIGHT_FILE_DIR=.context/example npm run test:browser -- tests/browser/component_inspector.spec.ts
```

`npm run test:delivery:prepared` builds a fresh example after `npm run build`
and checks both delivery modes. It runs in CI and the complete gate.
Supported specs under `tests/browser/`
are `comparison_design`, `component_controls`, `component_design`,
`component_design_inspection`, `component_design_selection`, `component_evidence`,
`component_inspector`, `component_surfaces`, `component_workspace`,
`design_comparison_eligibility` (and `_2`, `_3`, `_4`),
`design_comparison_scrolling`, `design_comparison_stacks`,
`design_component_stacks`, `design_index_entries`, `design_library`,
`design_modern_controls`, `design_portable`, `design_scroll_together`,
`design_stylesheet_evidence`, `design_top_bar`, `example_links`, and
`phone_chrome`; each name has the `.spec.ts` suffix. File mode opens exact
output bytes without an HTTP fallback.

Browser traces and screenshots stay under `.context/playwright-results/`.
