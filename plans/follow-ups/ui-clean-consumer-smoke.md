# Smoke-test UI package resolution in a clean consumer

- **Severity:** Medium (estimate). **Effort:** Small (estimate).
- **Kind:** Post-merge task.
- **Added:** 2026-10-29, from PR #243 and its completed plan, an unchecked
  post-merge task.
- **Location:** None. The task runs in a new directory outside the
  repository. The package manifests are `packages/viewer/package.json` and
  `packages/ui/package.json`.
- **Reason:** The check needs the first release that carries `@mokly/ui` on
  the npm registry, and that release shipped only on 2026-10-29.

- **Terms:**
  - **`@mokly/ui`:** the shared UI package under `packages/ui`. It holds the
    presentational components of the Browse shell and their CSS.
  - **Clean consumer:** a new npm project outside this repository that
    installs only from the registry, so no workspace link can hide a
    packaging defect.
- **Background:**
  - PR #243 added `@mokly/ui` on 2026-10-29. `@mokly/viewer` depends on the
    exact same version of `@mokly/ui`, and it bundles the package CSS into
    its `styles.css`.
  - Release 0.17.0 of 2026-10-29 is the first release with `@mokly/ui`. In
    it, `@mokly/viewer` 0.17.0 depends on `@mokly/ui` 0.17.0, exports
    `./styles.css` from `./dist/styles.css`, and needs React and React DOM
    19 or newer.
  - In the repository, each workspace package links into the root
    `node_modules`. So a missing file or a wrong dependency of the published
    packages shows only in a clean consumer.
  - The package stylesheets define rules such as `.mbk-appearance`, in
    `packages/ui/src/appearance-selector/appearance-selector.css`.
- **Task:**
  1. Create an empty directory outside the repository. Run `npm init -y`.
  2. Run `npm install @mokly/viewer@0.17.0 react@19 react-dom@19`.
  3. Confirm that `node_modules/@mokly/ui/package.json` exists with version
     0.17.0.
  4. Run
     `node --input-type=module -e "console.log(import.meta.resolve('@mokly/ui/styles.css'))"`,
     and confirm that it prints a path under `node_modules/@mokly/ui`.
  5. Confirm that `node_modules/@mokly/viewer/dist/styles.css` contains the
     package rules, such as `.mbk-appearance`.
  6. Delete the directory.
- **Impact if no action:** A packaging defect can break every host that
  installs `@mokly/viewer` 0.17.0, and nobody sees it before a user reports
  it.
- **Needs:** Release 0.17.0 on the npm registry and network access to it.
- **Done when:** In a clean consumer, `@mokly/ui` installs and resolves with
  `@mokly/viewer`, and the viewer's `styles.css` holds the package component
  rules.
- **Related:** [ui-export-ratchet-baseline.md](./ui-export-ratchet-baseline.md)
  is the other post-merge task that waited for this release.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/ui-package.md?plain=1#L530).
