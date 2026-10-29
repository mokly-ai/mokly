# A guide for agents

Mokly builds app-independent static mockup catalogues, serves them for
development browsing, and renders visual comparisons. The Rust core is a
Cargo workspace under `crates/`. The `@mokly/mokly` package, which holds the
`mokly` shim, the render sidecar, and the authoring API, is under
`packages/mokly`. The `@mokly/viewer` React viewer is under
`packages/viewer`. The `@mokly/ui` shared UI package, the shell's
presentational components and their CSS, is under `packages/ui`. The example
catalogue is under `examples/basic`, the tooling tests and browser specs are
under `tests/`, the viewer tests are under `packages/viewer/tests`, the UI
package tests are under `packages/ui/tests`, and the Rust verification task
runner is under `xtask/`. The protocol docs under `docs/protocol` are the spec.

This file holds the rules that are specific to this repository. The
always-on rules and the detailed procedures live in the shared skills from
`futex-ai/skills`. Read the skill at the named moment instead of guessing
the rule. Rules for one application, package, or feature live in the
`README.md`, doc, or protocol doc next to the code they describe.

## Shared skills

- `finish-work`: before you say work is complete, and before you commit.
- `plans`: before you create, edit, or tick a plan under `plans/`.
- `implementation-review`: after you push, before you run or apply a
  review.
- `deterministic-tests`: when a test flakes, or when a test would assert
  elapsed time.
- `git-commit`: before and after you commit, and when you open a pull
  request.
- `git-merge`: before you merge or rebase, and after each merge commit.
- `documentation`: before you edit a `README.md`, a doc, or a protocol doc.
- `rust`: before you edit Rust under `crates/` or `xtask/`.
- `mockups`: before you create or change an entry of the example catalogue
  under `examples/basic`, including the design mockups under
  `examples/basic/specs/design`.
- `product-ui`: before you implement or change a user-facing screen or
  copy.

## Communication

- Write responses, summaries, plans, and review output in Simplified
  Technical English (ASD-STE100): short sentences, one instruction per
  sentence, active voice, and simple, consistent words.
- Assume the reader has no context. Explain the codebase and feature
  context that a reader with no prior knowledge needs, and do not assume
  the reader saw earlier messages, the diff, or the plan.
- Report outcomes faithfully. Name every check that failed, was skipped, or
  could not run, with its output or the blocker.
- Ask for all decisions in one numbered message. For each decision give
  its severity and effort, the context, the impact if no action is taken,
  lettered options, and a recommended option. Do the independent work
  first, then stop and wait.
- End every task with a final report: what changed and the commit, each
  decision and its outcome, the checks that ran, anything skipped, and the
  outstanding decisions or review items that still need the user.

## Commands

- Build: `npm run build`. It builds the host native target, the UI package,
  the viewer, and then the shim and the sidecar, in that order.
- Targeted tests: `npm test -- <file> --test-name-pattern=<regex>` for the
  Node test files under `tests/`, `packages/viewer/tests/`, and
  `packages/ui/tests/`,
  `cargo test -p <crate>` for one crate, and
  `npm run test:browser -- <spec> -g "<name>"` for browser specs. The npm
  commands build first. The
  [developer test commands](./docs/protocol/developer-test-commands.md)
  hold the full rules, including the raw commands that test the last build.
- Early check (format, lint, file length, exports, Rust):
  `cargo xtask check --suite repository`.
- Complete gate: `cargo xtask check`. A local run stops at the first failed
  suite. A [remote run](./docs/protocol/remote-verification.md) reports
  every failed suite. Rerun one failed suite with `--suite <name>`.
- Format: `npm run format` and `cargo fmt --all`.
- Markdown check: `npm run format:check` and
  `npm test -- tests/markdown_links.test.ts`.
- Mockup check, after you change an example entry, the renderer, the
  configuration, or a configured style: `npm run build`, then
  `npx mokly build --config examples/basic/mokly.config.json --strict --out ../../.context/example`.
  Then smoke-test the changed pages through `npm run dev`.

## Repository rules

- The repository gate caps changed TypeScript and JavaScript files at 300
  lines and protocol Markdown at 250 lines. The exact reviewed caps in
  `xtask/protocol-document-caps.json` are the only exceptions. Fetch
  `origin/main` before you run `cargo xtask source-file-length-lint`.
- `cargo xtask rust-file-length-lint` caps Rust files under `xtask/` and
  `crates/` at 300 lines. Every run audits every Rust file there. There is
  no override.
- `tests/markdown_links.test.ts` checks the local links and anchors in
  `AGENTS.md`, `docs/`, `plans/`, and every `README.md`.
- Never commit build output. `mokly-static/` and every `--out` directory
  stay ignored by Git. Commit the authored specs, configuration, components,
  and CSS under `examples/basic/`.
- Do not write angle-bracket placeholders such as `<path>` in commit
  messages or pull request descriptions. Write `{path}` instead. Release
  Please copies changelog text into the release PR body and parses that
  body as HTML, so an unclosed tag stops the release. Code spans do not
  help, because the parser does not read Markdown. See
  [release recovery](./docs/protocol/npm-release-management.md#release-recovery).
- [CI test timing](./docs/protocol/ci-test-timing.md) holds the timing
  contract for the Node, browser, and Rust tests. Read it with the
  `deterministic-tests` skill.
- A protocol, architecture, or README page whose behaviour is not
  implemented yet starts with one line below its title:
  `Status: In progress under the [plan name](link to the plan).` That line
  is the page's only plan link. Remove it when the behaviour is implemented.
  The guides under `docs/guides` ship with the npm package, describe the
  released product, and carry no status line.
- A page names an earlier format number or a removed input only where its
  rule needs the name: a version gate that rejects the number, a
  removed-input warning, or a migration step in a guide.
- No test asserts the words of a protocol page. Tests check the code against
  its own behaviour. Guide tests compare parsed guide tables with the code.
- Files under `packages/ui` use kebab-case names, such as `top-bar.tsx`,
  which exports `TopBar`. A lint checks the rule only for the JavaScript and
  TypeScript files under `packages/ui/src` and `packages/ui/tests` and for the
  directories that hold them. The other packages keep snake_case.

## Product

- The product screens are the Browse shell under
  `packages/viewer/src/shell`. Serve, the static build, and React hosts
  render this same tree in the browser. Check the shell's components before
  you create a component.
- A presentational component and its CSS live in `@mokly/ui` under
  `packages/ui/src`: props in, callbacks out, no store, no fetch, no history,
  no frame. A component that needs the store stays in the viewer and composes
  a package component. It never moves the store down.
- The design mockups of these screens live in
  `examples/basic/specs/design`. Build them from the shared design
  components in `examples/basic/specs/design/library`. Each shared
  component's own styles live in `examples/basic/design-library`. For a
  shared component that `@mokly/ui` provides, the view imports the package
  component and the sheet imports the package stylesheets of the component
  and of each package component that it renders, each by its repository path
  under `packages/ui/src`. Shared, layout, and global design styles stay in
  the mixed `examples/basic/design*.css` files.

## Review focus

- App independence, generated-output safety, server and watcher lifecycle,
  comparison behaviour, and protocol alignment.
- The end-state rule: a page describes the intended behaviour only, with the
  status line of the repository rules while that behaviour is not
  implemented.

## Status

- This project is not in production. Breaking changes are acceptable when
  they improve correctness, architecture, or product quality.
