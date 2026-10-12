# Verification And Release Protocols

Continuation of the [protocol index](./README.md).

## Contracts

- [Public API reports and unused members](./verification-api-members.md) —
  approved signature reports, release-note gate and member ratchet.

- [Remote verification](./remote-verification.md) — implemented explicit and automatic execution, with [cleanup and interrupts](./remote-verification-cleanup.md). The [base commit sync contract](./remote-verification-base.md) is implemented.
  - [Testbox execution](./remote-verification-testbox.md) — workflow, commands, sync probe, suite wrapper, source-tree fingerprint, report download and aggregation.

- [CI workflow graph](./ci-workflow.md)

- [CI test timing](./ci-test-timing.md) — deterministic assertions, duration reporting and lint guard.

- [Repository verification ratchets](./verification-ratchets.md)

- [CI fixture preparation](./ci-fixture-preparation.md) — shared browser baseline preparation and cleanup.

- [Directory constants and import lint](./mokly-directory-lint.md)
  — approved independent literal guard, retained source-ordering rule and
  duplicate-import enforcement with folder coverage probes.

- [Baseline audit modes](./dependency-audit-baseline.md) — strict and baseline-relative advisory evaluation.
- [Dependency update pull requests](./dependency-audit-update-pr.md) — scheduled strict audits and automated repair requests.
- [Dependency security](./dependency-security.md) — advisory gates, targeted
  updates, temporary patched-release overrides, reviewed path exceptions, and
  strict packed-consumer audit coverage.

- [Historical npm upgrade notes](./npm-release-history.md) — earlier release guidance.

- [Deterministic test repositories](./ci-test-repository-inputs.md) — fixture history and remote-state protection.

- [npm release operations](./npm-release-operations.md)

- [npm breaking-change release notes](./npm-release-notes.md)

- [npm format and tooling release notes](./npm-release-notes-formats.md)

- [Repository preview deployments](./npm-preview-deployments.md)

- [Release verification evidence](./npm-release-evidence.md)

- [One-time registry bootstrap](./npm-bootstrap.md)

- [GitHub publishing protections](./npm-github-protections.md)
