# A guide for agents

Status: In progress under the [Rust rebuild plan](./plans/rust-rebuild.md).

Mokly builds app-independent static mockup catalogues, serves them for
development browsing, and renders visual comparisons. The Rust core is a
Cargo workspace under `crates/`. The `@mokly/mokly` package, which holds the
`mokly` shim, the render sidecar, and the authoring API, is under
`packages/mokly`. The `@mokly/viewer` React viewer is under
`packages/viewer`. The example catalogue is under `examples/basic`, the
tooling tests and browser specs are under `tests/`, the viewer tests are
under `packages/viewer/tests`, and the Rust verification task runner is under
`xtask/`. The protocol docs under `docs/protocol` are the spec.

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

- Build: `npm run build`. It builds the host native target, the shim, the
  sidecar, and the viewer.
- Targeted tests: `npm test -- <file> --test-name-pattern=<regex>` for the
  Node test files under `tests/` and `packages/viewer/tests/`,
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
  `npx mokly build --config examples/basic/mokly.config.json --strict --out .context/example`.
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
- Read the
  [Rust rebuild procedures](./docs/protocol/rust-rebuild-procedures.md)
  before you capture references from the previous backend or close a rebuild
  milestone.

## Product

- The product screens are the Browse shell under
  `packages/viewer/src/shell`. Serve, the static build, and React hosts
  render this same tree in the browser. Check the shell's components before
  you create a component.
- The design mockups of these screens live in
  `examples/basic/specs/design`. Build them from the shared design
  components in `examples/basic/specs/design/library`. Each shared
  component's own styles live in `examples/basic/design-library`. Shared,
  layout, and global design styles stay in the mixed
  `examples/basic/design*.css` files.

## Review focus

- App independence, generated-output safety, server and watcher lifecycle,
  comparison behaviour, and protocol alignment.
- The end-state rule in the
  [documentation policy](./docs/protocol/documentation-policy.md): a page
  describes intended behaviour only, with a `Status: In progress` line when it
  is not implemented yet.

## Status

- This project is not in production. Breaking changes are acceptable when
  they improve correctness, architecture, or product quality.
