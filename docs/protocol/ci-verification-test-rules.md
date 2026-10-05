# Test Time Limits And Console Checks

Continuation of [CI Verification](./ci-verification.md). This page owns two
rules for the unit, browser and hydration suites: how a test limits time, and
which browser console messages a check accepts.

## Delivery Status

Both rules are delivered.
The shared helpers, work-count checks, focused preview fixture and repository
guards enforce the rules below.

## Time Limits

A fixed time limit fails on a slow or busy machine, even when the code is
correct. A test therefore limits time only in the ways below.

### Performance Guards

A performance guard is a test that checks that code does a bounded amount of
work, for example that it sorts a list once. It counts that work and never
asserts a duration. The code under test takes an optional collaborator whose
default is the production behaviour, and the test passes a counting version.
The test then asserts the counts that its title names, such as sorts, root
projections, glob compilations or file reads. A test never patches a global,
such as `Array.prototype.sort`, to count work.

A performance guard may measure its elapsed time as a diagnostic: with
`context.diagnostic` in a Node test, or with an annotation in a Playwright
test. The elapsed time never fails the test.

### Scaled Limits

These time limits come from `scaledTimeLimit(baseMs)` in
`tests/helpers/time_limits.ts`:

- a fixture setup limit: the `timeout` of a Playwright worker fixture, every
  `test.setTimeout` call in a Playwright `beforeAll` hook, and the `timeout` of
  a Node `before` hook;
- the timeout of a test whose own body performs a fixture preparation as the
  operation under test, such as the cold preview build; and
- the upper bound of an assertion on a measured duration that is not a
  performance guard, such as the time until a watcher is ready or until a
  server answers.

The full-catalogue setup limit in
[CI suite evidence](./ci-suite-evidence.md#fixture-lifetime-and-cleanup) is a
scaled limit with a base of five minutes.

`scaledTimeLimit` returns `Math.ceil(baseMs * scale)`. The scale comes from the
`MOKLY_TEST_TIME_SCALE` environment variable. When the variable is unset, the
scale is 1. Otherwise its value must be a decimal number of at least 1, such as
`1.5` or `3`. For any other value, including an empty value, the helper throws
an error that names the variable and the value when a test file loads it. No
test therefore runs with a guessed scale. The unit, browser and hydration
runners pass the variable to the tests unchanged. Hosted CI leaves it unset, so
CI keeps the base limits. A developer can set it for a local run on a slow
machine.

These limits stay fixed values:

- a test body's own timeout, a Playwright `expect` timeout, and a polling or
  wait deadline. They only stop a hung test, so each one sits well above the
  expected duration;
- a lower bound on a measured duration, such as the check that a frame request
  fails only after its five-second timeout. A slow machine cannot break it; and
- the opt-in large-fixture benchmark, which is a measurement. Its threshold
  follows [startup diagnostics](./mokly-timings.md#representative-local-fixture).

### Shared Preview Fixture

The `ordinaryPreview` worker fixture in
[`ordinary_preview_fixture.ts`](../../tests/browser/ordinary_preview_fixture.ts)
builds a focused catalogue. It holds the entries that its specs open, and a
navigation-only stand-in for each other destination that those entries link
to. It keeps only the component registrations those entries use. Each keeps
one required saved variant as a navigation-only stand-in. Variant stand-ins
keep their parent reference.
A spec that opens another entry adds that entry to the focused catalogue.
The fixture uses the full-catalogue setup limit.

### Time Limit Guard

A guard test, `tests/time_limits.test.ts`, scans the TypeScript test files and
helpers under `tests/` and `packages/viewer/tests/`. It fails on a fixture
setup limit whose value is not a `scaledTimeLimit` result, and on an assertion
that requires a measured duration to stay below a bound that is not a
`scaledTimeLimit` result. Its samples include a rejected
`assert.ok(elapsed < 2_500)`, a rejected `test.setTimeout(120_000)` in a
`beforeAll` hook, and accepted forms for a scaled limit, a lower bound and a
diagnostic. The same file tests how `scaledTimeLimit` reads the scale. The
guard cannot tell which tests are performance guards or preparation tests, so
review applies those two rules.

## Console Checks

A browser check fails on an unexpected console error or page error. The
capture function `captureBrowserErrors(page)` in
[`console_notices.ts`](../../tests/browser/console_notices.ts) records both for
a page. It returns a list that receives the text of every console message of
type `error`, except the expected report below, and the message of every page
error.

### Expected Report

The viewer shows stage views, temporary renders and previous versions in frames
that are sandboxed without `allow-scripts`. Chrome reports each script that such
a frame blocks. This includes the script that Playwright's trace recorder tries
to run in every frame. A console error is the expected report only when both
conditions are true:

1. Its text is exactly Chrome's sentence, with no text before or after it:
   `Blocked script execution in '<document>' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
2. The named document, or the document where Chrome locates the report, belongs
   to a viewer-owned sandboxed frame. That document is `about:srcdoc`, or an
   HTTP or HTTPS URL whose path starts with `/static/` or
   `/__mokly/components/renders/`.

Both path prefixes start at the origin root. Viewer frames load `/static/` only
from the origin root, and export supports hosting at the origin root only, as
[export public files](./mokly-export-public-files.md#compatibility-and-non-goals)
states. A report from `/site/static/`, or from a shell route with a `static`
segment such as `/view/design/static/`, is therefore an error. Every other
console error is an error too, for example a missing resource, a Content
Security Policy report or a script error.

### One Listener

Only `captureBrowserErrors` subscribes to Playwright's `console` event, with two
exceptions. Each exception reads one message type and ignores all other console
messages:

- [`removed_previews_viewer.spec.ts`](../../tests/browser/removed_previews_viewer.spec.ts)
  reads Content Security Policy reports; and
- [`viewer_hydration.spec.ts`](../../tests/browser/viewer_hydration.spec.ts)
  reads hydration messages.

A check that records only page errors may keep its own `pageerror` listener. A
guard in [`console_notices.test.ts`](../../tests/console_notices.test.ts) scans
the TypeScript files under `tests/` and `packages/viewer/tests/`, and fails on
every other `console` subscription. The same file tests the rule: it accepts
each viewer-owned frame, and rejects `/site/static/`, a shell route with a
`static` segment, and text after Chrome's sentence.

The embedded test host page that
[`viewer_host.ts`](../../tests/browser/viewer_host.ts) writes declares an empty
icon file, which it writes beside the page and serves from the same origin.
Chrome therefore never requests a missing `/favicon.ico`, and no check accepts a
missing-icon error. The page does not use a `data:` icon: the same page is also
served behind a strict Content Security Policy whose `img-src` blocks `data:`,
and Chrome reports that block as a policy violation.
