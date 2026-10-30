# Run the Bookfolio catalogue smoke tests

- **Severity:** Low (estimate). **Effort:** Medium (estimate).
- **Kind:** Post-merge task.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** None. The work runs in the Bookfolio repository, not in
  this one.
- **Reason:** On 2026-10-20 the user took this run out of the rebuild
  scope, and it needs access to a repository that only the user can give.

- **Terms:**
  - **Bookfolio:** a consumer repository with its own Mokly catalogue. This
    repository holds no copy of it, and the plan does not record its
    location.
  - **Changes:** the Mokly view that renders the working tree and a Git base
    from their sources and lists the screens that changed.
- **Background:**
  - The rebuild replaced the TypeScript backend with a Rust core. Its
    acceptance ran real catalogues through build, serve, Changes, and watch.
  - The large test fixture and the Mokly Cloud catalogue passed that run.
    The Cloud run used a scratch copy, so the source repository stayed
    unchanged. It covered Build, Serve, source Changes, and watched screen,
    component, and stylesheet edits.
  - The user took the Bookfolio run out of the rebuild scope on 2026-10-20
    and kept it as work after the merge.
- **Task:**
  1. Ask the user for access to the Bookfolio repository.
  2. Make a scratch copy of it, so that the run changes no source file.
  3. Install the Mokly version under test with
     `npm install --save-dev @mokly/mokly`, or use a local build of a named
     commit of this repository.
  4. Run `npx --no-install mokly build --out .context/mokly-site` and check
     that it writes the site with no error.
  5. Run `npx --no-install mokly serve --open`. Check Browse, search, and
     several screens and components.
  6. Open Changes against the default base, and against another base with
     `mokly serve --base {ref}`.
  7. While Serve runs, edit one screen, one component, and one stylesheet.
     Check that each edit reloads the affected previews.
  8. Save the terminal output and notes under `.context/` of the scratch
     copy. Record each failure as a new follow-up item in this repository.
- **Impact if no action:** A real consumer catalogue stays untested on the
  Rust core. Defects that only its content triggers stay unknown.
- **Needs:** Access to the Bookfolio repository from the user. A Node
  version that the root `README.md` supports. A released `@mokly/mokly` or a
  local build of the commit under test.
- **Done when:** Build, Serve, Changes, and the three watched edits complete
  on the Bookfolio catalogue. Each failure has a fix or its own follow-up
  item, and the user has the result.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5422).
