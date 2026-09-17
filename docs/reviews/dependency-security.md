# Dependency Security Follow-Up

The user approved the separate dependency-maintenance finding from the
[export review](./consumer-export-exclusive.md#separate-dependency-audit--needs-decision).
This record tracks that focused follow-up on
[PR #49](https://github.com/mokly-ai/mokly/pull/49), without reopening the
completed export plan.

## Approved Finding

1. **High — Known advisories remained in runtime and development dependencies.**
   Group: dependency maintenance. A fresh audit on 2026-09-10 reproduced 11 High
   and one Moderate affected packages. The production-only finding was
   `brace-expansion@5.0.7` through Mokly's glob matcher. Development paths
   included browser-target data, Nano ID, Metro's image parser, and Miniflare's
   image and HTTP libraries. Doing nothing retained the reported memory/CPU
   exhaustion and HTTP-processing risks, and verification did not prevent a
   known-vulnerable tree from passing.

   Options: A) update the affected versions only; B) make targeted compatible
   updates, add bounded behavioral coverage, and gate workspace and packed
   consumer audits; C) defer after a reachability assessment. Recommended and
   implemented: B. The live registry dependency is an intentional verification
   tradeoff: newly disclosed advisories and registry errors stop CI/release
   checks instead of silently relying on an old successful audit.

## Implementation

- Updated the runtime matcher to `minimatch` 10.2.6 and locked its brace
  expander to 5.0.9. The padded-output regression failed before the update and
  passes afterward; ordinary alternatives and ranges remain supported.
- Updated the complete compatible Metro family to 0.84.6, removing the
  vulnerable `image-size` dependency and its unused queue helper. npm initially
  retained the old circular exact-version dependencies during targeted updates;
  temporary resolution anchors regenerated that family and were removed.
  A subsequent clean install proves the committed lockfile needs no Metro
  override or direct dependency.
- Updated Browserslist/baseline data and Nano ID within their existing lines.
  Wrangler 4.113.0 and its Miniflare/Workerd versions remain unchanged. Scoped
  Miniflare overrides select Sharp 0.35.4 and Undici 7.29.1; their removal
  conditions are in the [security contract](../protocol/dependency-security.md).
  No force-fix, CLI downgrade, supported Node-floor increase, or new runtime
  dependency was introduced.
- Added the all-category `npm run dependencies:check` gate before the existing
  `cargo xtask check` sequence, plus ordered/fail-closed unit coverage at the
  command-runner boundary. Both new expectations failed before implementation.
- The packed ESM-consumer smoke separately audits freshly resolved production
  dependencies, where workspace overrides and lockfiles do not apply.

## Verification And Delivery

Clean `npm ci` succeeds. Both the complete workspace audit and production-only
audit report **zero vulnerabilities** across the resolved 551-package tree.
An unavailable registry was also checked explicitly and correctly fails with
exit status 1.

The complete `cargo xtask check` passes on macOS Node 25.4.0/npm 11.7.0:
all 600 unit/integration tests, 107 browser tests, and four Rust tests pass,
along with formatting, lint, typechecking, the unchanged 57-file example,
package/license checks, packed-consumer smokes and their new production audit,
Rust formatting/Clippy, and the 10-file Rust length audit. Browser verification
includes the actual Cloudflare preview runtime. No assertion, timeout, retry
configuration, or product behavior was changed to obtain this result.

The [PR](https://github.com/mokly-ai/mokly/pull/49) records the subsequent
commit/push, independent `cargo xtask review`, and supported-runtime/native
platform CI results. This document records the verified pre-commit checkpoint;
review output is not assumed from passing tests, and new findings require a
maintainer decision.

Main was fetched from source tip `5c05dc5`; `origin/main` remains `aa5adea`,
already integrated, with no incoming paths or mainline file deletions.
