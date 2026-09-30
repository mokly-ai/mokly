# Publish Catalogue Review

Both initial findings were subsequently validated and fixed with the user's
approval. Their original analysis is preserved below; see **Approved Follow-up**
for the changes and verification.

## Initial Findings — addressed

1. **P2 / Medium — Required ownership marker lacks a complete public schema.**
   [Upload validation](../protocol/mokly-upload-validation.md#receiver-validation),
   lines 189–191, requires receivers to validate `.mokly-export-artifact` and
   match its inventory to the archive. The linked export and delivery contracts
   describe a version and inventory but never define the JSON field names,
   field types, or unknown-field policy. Those details currently live in
   [the internal ownership parser](../../src/export/ownership.ts), lines 10–14
   and 32–65, and the internal staging writer. Independent receivers cannot
   implement this required validation from the documented artifacts alone;
   leaving it unchanged forces reverse engineering or inconsistent acceptance.

   Options: **A)** document the marker's exact JSON shape and validation rules
   in the export contract and link them from upload; **B)** do A and add public
   valid/invalid artifact fixtures exercised by the packed-consumer smoke;
   **C)** remove the receiver's marker-validation requirement. **Recommended:
   B.** The documentation closes the immediate gap, while fixtures give Cloud
   and self-hosters a stable compatibility check and guard future changes to
   mandatory artifacts. This adds fixture maintenance but preserves the
   intended package-and-files boundary without exporting internal modules.

2. **P2 / Medium — Valid bearer tokens beginning with a dash fail through the
   advertised flag.** [The new token parser branch](../../src/cli/arguments.ts),
   line 62, uses `takeValue`, which rejects all values starting with `-` at
   lines 87–90. Upload v1's bearer grammar explicitly permits those tokens.
   An in-memory probe confirmed that `--token -review-synthetic-credential`
   fails with `[mokly/cli-invalid] --token requires a value`; the unambiguous
   `--token=-review-synthetic-credential` form also fails as an unknown option.
   The same synthetic credential passes environment-option validation.
   Leaving this unchanged prevents some valid service credentials from being
   used through the documented flag. `MOKLY_TOKEN` is a working workaround,
   including in the composite action.

   Options: **A)** document the environment-only workaround for leading-dash
   credentials; **B)** support unambiguous `--name=value` parsing in the shared
   argument parser, document it, and test leading-dash values and redaction;
   **C)** special-case token value consumption. **Recommended: B.** A shared
   value-option rule also handles legitimate dash-prefixed paths, avoids an
   inconsistent token-only exception, and retains missing-value detection.
   Scope regressions to value options and ensure boolean flags still reject
   assigned values; a new parser dependency is not required.

Neither finding was changed during the initial read-only review. The user's
later approval added follow-up milestones without reopening completed work.

## Scope And Delivery

Reviewed on 2026-09-14 using
[the implementation review prompt](../implementation-review-prompt.md), only
after implementation commit `e7d46d7` was pushed. The comparison baseline was
`origin/main` at `5b4c647b6138fa08d65a7573f01b1c342ec9b019`. The complete diff
contained 56 changed or added files and no deletions. The working tree, staged
diff and untracked-file list were empty at review start and completion.

The read-only review covered CLI parsing and secrecy, metadata, archive and
HTTP boundaries, export assembly and transactions, the composite action,
package allowlists and release fixtures, tests, documentation and the plan.
It used focused file/patch inspection and an in-memory compiled-parser probe;
it did not alter implementation, tests or generated artifacts. This report and
the plan's delivery checkboxes were recorded after that review.

## Initial Verification And Remaining Release Work

The full `cargo xtask check` gate passed before commit and push, using Node
22.14.0: all 1,074 unit/integration tests, 247 Chromium tests and three Rust
tests passed, with none failed, skipped or cancelled. Package/example checks,
dependency audits, formatting, lint, types, Rust formatting/Clippy and the
Rust file-length audit also passed. The 30 focused publish tests passed on
Node 24.14.1. See [the plan](../../plans/publish-catalogue.md#verification-evidence)
for earlier-run failures and their resolution.

Packed-package smoke tests performed real local HTTP uploads in both comparison
modes and checked extracted bytes against the installed export. The action's
actual shell steps were tested with an injected npm installer; a complete
hosted GitHub Actions workflow and a production receiver were not exercised.
That integration remains the residual test risk.

The [composite action](../../.github/actions/publish/README.md) is delivered
under `.github/actions/publish`. Consumers must pin an npm release containing
this feature before using it remotely. No npm release, separate action
repository or PR was created. The plan remains active until PR merge.

## Approved Follow-up

Both P2 findings were confirmed before making changes. The ownership format
had no complete public schema, and a compiled-parser probe rejected an assigned
leading-dash token that the transport accepted through the environment.

The [ownership v1 contract](../protocol/mokly-export-ownership.md) now defines
the fields, unknown-field policy, path and collision rules, inventory semantics,
upload limits and version rejection. Its 27 public valid/invalid fixture cases
ship with the npm package. The existing exporter parser and an independent
packed-consumer reader both check those cases; the upload smoke also checks
every tar member against the marker, including missing, duplicate and extra
members in focused reader tests. Local recovery behavior is preserved.

The shared CLI parser accepts `--name=value` for every long value option,
including tokens and paths beginning with `-`. It retains all subsequent `=`
characters, rejects empty assigned values and boolean assignments, and keeps
the existing command and numeric validation. Tests cover success and rejection
over real HTTP, explicit-token precedence, raw/encoded diagnostic redaction,
and config/output paths beginning with a dash.

Nine regressions failed before implementation. All 41 focused tests then passed,
along with build, TypeScript, ESLint, Markdown checks and the packed-consumer
smoke. The smoke uses the installed CLI with a leading-dash padded credential
in both comparison modes. Full-gate and post-push review delivery is tracked
in [the plan](../../plans/publish-catalogue.md).

The follow-up `cargo xtask check` passed on Node 22.14.0 before commit and push:
1,084 unit/integration tests, 247 browser tests, three Rust tests, and all
dependency, example, package, formatting, lint, types and Rust gates. There
were no failed, retried, skipped or cancelled tests in this complete run.

## Follow-up Post-push Review

No additional actionable findings. Both original P2 findings are addressed.
The review ran after fix commit `5f84921` was pushed, following
[the implementation review prompt](../implementation-review-prompt.md).
It inspected the complete branch against `origin/main` at `5b4c647`, including
all 63 added/changed files and the earlier publish implementation. There were
no file deletions, staged changes or untracked files at the review snapshot.

The audit checked shared option parsing and secret redaction, the public
ownership contract and fixtures, independent package conformance and full tar
inventories, release packaging, export transaction/consistency behavior, Git
metadata, bounded archives, HTTP failures, the action and regression coverage.
The complete committed diff passed whitespace validation. Review inspection
did not change implementation, tests or generated output; the plan status and
this result were recorded afterward.

Residual integration risk is unchanged: the full local gate and real local
uploads passed, but a hosted GitHub Actions workflow and a production receiver
have not been exercised. Consumers still need a supporting npm release.
