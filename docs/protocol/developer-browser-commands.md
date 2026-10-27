# Developer Browser Commands

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

The shared example servers, the copied current-only example, and the
two-commit comparison fixture follow
[CI suite evidence](./ci-suite-evidence.md#test-concurrency). The
[fixture guide](../../tests/browser/README.md) lists the specs that use each
fixture. To supply current-only output, set `MOKLY_PLAYWRIGHT_STATIC_DIR`. For
example:

```bash
npx mokly build --config examples/basic/mokly.config.json --no-changes --out ../../.context/example
MOKLY_PLAYWRIGHT_STATIC_DIR=.context/example npm run test:browser -- tests/browser/browse_chrome.spec.ts
```

`MOKLY_PLAYWRIGHT_FILE_DIR` selects the same built directory for design checks
that open portable documents directly through `file://` URLs. For example,
after the build above:

```bash
MOKLY_PLAYWRIGHT_FILE_DIR=.context/example npm run test:browser -- tests/browser/component_inspector.spec.ts
```

`npm run test:delivery:prepared` builds a fresh example after `npm run build`
and checks both delivery modes. The design journeys and the private component
fixture run through static HTTP and file delivery. File mode opens exact output
bytes without an HTTP fallback. The
[browser fixture guide](../../tests/browser/README.md#delivery-spec-inventory)
lists the delivery specs.

Browser traces and screenshots stay under `.context/playwright-results/`.
