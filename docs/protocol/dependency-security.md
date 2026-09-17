# Dependency Security

## Verification Boundary

`npm run dependencies:check` audits the workspace lockfile against the configured
npm registry's current advisory database. It explicitly includes production,
development, optional, and peer dependencies, even if local npm configuration
would otherwise omit a category. Any reported Low, Moderate, High, or Critical
vulnerability fails the command. Registry or transport errors also fail; they
are not an audit exemption or a successful security result.

`cargo xtask check` runs this audit first and stops on failure. The existing
Node 22.14 and Node 24 CI jobs and the release workflow therefore enforce the
same check. Verification requires registry access and is deliberately sensitive
to newly published advisories, even when source and lockfile have not changed.
An audit is evidence about known advisories at execution time, not a guarantee
that every dependency is safe.

The packed ESM-consumer smoke also audits its freshly resolved production,
optional, and peer dependencies before exercising the installed CLI. This is a
separate boundary: npm does not apply Mokly's workspace overrides or lockfile
to downstream installations. Other consumer fixtures continue to exercise
their respective integration contracts without duplicating registry requests.
Consumers must maintain and audit their own lockfiles, including dependencies
they bring to their renderer or application.

## Update Policy

Investigate each advisory's dependency path and patched versions before
changing package metadata. Prefer compatible targeted updates, preserve the
supported Node floor, and regenerate the lockfile with npm. Do not blindly run
`npm audit fix --force`: an audit's suggested parent change can be a downgrade
or an incompatible toolchain replacement.

Use a narrowly scoped override only when a parent pins an affected dependency
and a compatible parent update is not appropriate. Document why it exists and
the conditions for removing it. Audit every dependency category after an
update; an old override is not proof that the current tree is clean.

The current maintenance choices are:

- The runtime glob dependency is `minimatch` 10.2.6 or newer; the workspace locks
  `brace-expansion` 5.0.12. A bounded behavioral regression checks total padded
  output and preserves normal brace alternatives. The
  [upstream advisory](https://github.com/advisories/GHSA-rgw5-rvv9-x895)
  explains why the intermediate-allocation fix requires 5.0.9, not 5.0.8.
- React Native's compatible Metro 0.84 line is updated to 0.84.6, including its
  coupled packages. The
  [0.84.5 security fix](https://github.com/react/metro/releases/tag/v0.84.5)
  removes `image-size` in favor of maintained parsers. Do not override the
  image parser to another affected release or jump Metro compatibility lines
  just to change the audit report.
- Wrangler remains at 4.113.0 with its existing Miniflare/Workerd versions.
  The `miniflare`-scoped overrides select `sharp` 0.35.4 (including patched
  native image libraries) and `undici` 7.29.1. Remove each override when a
  deliberately upgraded Wrangler/Miniflare version resolves a patched version
  without it and passes the complete gate. These overrides do not apply to
  unrelated dependency parents.
- Compatible Browserslist, browser-baseline data, and Nano ID patches remain
  lockfile-only updates; they do not add direct runtime dependencies.
- Lightning CSS is a production dependency for stylesheet rule parsing. Its
  MPL-2.0 native packages and Apache-2.0 `detect-libc` dependency participate in
  the workspace and packed-consumer audits. Retain every platform's optional
  lockfile entry when updating it; Ubuntu Node 22.14/24 and the minimum-Node
  macOS/Windows jobs exercise its parser. Native binaries must remain installed;
  the Node package does not automatically fall back to WASM. See the
  [release platform contract](./npm-release.md#continuous-integration).

## Required Evidence

Add a regression first when a reported bug can be reproduced safely. Keep
malicious-input tests bounded; never run an advisory's unbounded memory or CPU
exhaustion example inside the normal test process. Verification of command
ordering and fail-closed behavior uses the injected command-runner boundary,
not live network calls from Rust unit tests.

After dependency updates, use a clean `npm ci`, run the complete
`cargo xtask check`, and exercise the real preview runtime through its browser
tests. Review lockfile removals, package engines, native optional packages, and
the packed artifact. Commit and push all completed changes before using the
[implementation review prompt](../implementation-review-prompt.md) against
`origin/main`; report new findings for a maintainer's decision.
