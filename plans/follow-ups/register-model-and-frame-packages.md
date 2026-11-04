# Register the model and frame npm packages

- **Severity:** High. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-11-04, from the post-merge section of the deleted plan `plans/frame-package.md`, on the branch `calummoore/viewer-inspector-purpose`.
- **Location:** `scripts/release/bootstrap.mjs`, `scripts/release/bootstrap_archive.mjs`, and `docs/protocol/npm-bootstrap.md:3`.
- **Reason:** A registration packs a reviewed commit, and only a maintainer with npm credentials can publish it.

- **Terms:**
  - **Registration:** the one-time, interactive first publication of a new
    npm package, so that npm can then trust the release workflow of the
    package. `docs/protocol/npm-bootstrap.md` defines it.
  - **`@mokly/model`:** the lockstep package under `packages/model` that
    holds the shared catalogue rules and the generated model types.
  - **`@mokly/frame`:** the lockstep package under `packages/frame` that
    holds the frame adapters and the frame probe script. It pins
    `@mokly/model`.
- **Background:**
  - The change that added the two packages merged without their npm
    registration. `@mokly/viewer` pins both packages, and the release
    publishes them in the order UI, model, frame, viewer, and the CLI.
  - `docs/protocol/npm-bootstrap.md` already lists both packages as
    registered at version 0.18.0, with a status line that links this item.
  - The registration command builds the prerequisite JavaScript workspaces
    of the selected package in its isolated checkout, then packs only that
    package. A review of the change found and fixed a missing model build
    before the frame pack. The real command has not run yet.
- **Task:**
  - From a clean checkout of the reviewed merge commit, after
    `npm ci --ignore-scripts`, run
    `node scripts/release/bootstrap.mjs {sha} .context/model-bootstrap @mokly/model`
    and then
    `node scripts/release/bootstrap.mjs {sha} .context/frame-bootstrap @mokly/frame`.
  - Check each `pack-report.json` and archive inventory against
    `docs/protocol/npm-bootstrap.md`. The frame archive must hold
    `dist/browser/frame-probe.js`.
  - Publish each archive with the `bootstrap` dist-tag and public access, as
    the bootstrap contract says. Configure the trusted publisher, the team
    access, and the protections of each package.
  - Remove the status line of `docs/protocol/npm-bootstrap.md`, and delete
    this item in the same change.
- **Impact if no action:** The next release pull request fails to publish
  `@mokly/model` and `@mokly/frame`, so `@mokly/viewer` cannot install.
- **Needs:** The merged change, a maintainer with npm credentials, and the
  npm and GitHub settings of the bootstrap contract.
- **Done when:** Both packages are registered at 0.18.0 with their trusted
  publishers, the status line is gone, and this item is deleted, before the
  next release pull request merges.
