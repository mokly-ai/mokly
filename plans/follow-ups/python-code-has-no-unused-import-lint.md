# Python code has no unused-import lint

- **Severity:** Low. **Effort:** Medium (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from the review of the closed [PR #72](https://github.com/mokly-ai/mokly-cloud/pull/72), finding 3.
- **Location:** `sgconfig.yml:1-5`, `xtask/src/task.rs:172-181`, `xtask/src/stage.rs:73-99` and `docs/protocol/repository-verification.md:14-72`.
- **Reason:** Every option except changing nothing adds a lint to the gate, which only the user can approve.
- **Checked:** 2026-10-31, at commit `f568853e`. The decision is still open. No stage or configuration lints Python, and the two dead imports on `main` remain. PR #81 deleted three of the files of the dated scan. No new lint is approved.
- **Category:** Dead code.

- **Terms:**
  - **Gate:** The complete check `cargo xtask check`, which runs 25 stages in order and stops at the first failure.
  - **ast-grep:** A structural lint tool, pinned at 0.45.3 in `ts/package.json:38`, that stage 7 of the gate runs with the rules under `rules/`.
  - **Ruff:** A Python linter whose rule F401 reports an import that the module never reads.
- **Background:**
  - The gate runs the stages of `xtask/src/stage.rs:73-99`, and `docs/protocol/repository-verification.md:14-72` describes them.
  - No stage and no configuration file lints Python.
  - At commit `f568853e` the repository tracks 110 Python files, and 107 of them are under `scripts/` and `infra/`.
  - Stage 7 runs the ast-grep rules for Rust and TypeScript over `crates/`, `xtask/` and `ts/app/src`, at `xtask/src/task.rs:172-181`.
  - Three of those rules already check Rust imports, for example `rules/rust/no-late-use.yml`.
  - The gate already needs `python3`, because stages 23 and 24 run Python scripts.
  - Each lint option changes the stage list of `docs/protocol/repository-verification.md`, a protocol doc.
  - Each lint option also reports one import on `main` that no code reads on purpose: `import support` at `infra/tests/test_catalogue_capture_receiver.py:18`.
- **Problem:** No check catches a Python import that the module never reads. A review found all three cases of the class by hand, after the imports reached a branch. The cases hold eight dead imports: six on the closed branch and two on `main`.
- **Impact if no action:** Each split or edit of a Python module can leave dead imports again. An unused import also runs its module: on the closed branch, an unused `smoke` import made the refusal tests load every smoke module.
- **Root question:** How do the Python scripts and tests stay free of unused imports?
- **Options:**
  - **A.** Change nothing. Reviews keep finding unused imports by hand. Each case gets its own deletion. It adds no check, but the class can return with each edit. Effort: Small.
  - **B.** Add an ast-grep rule `rules/python/no-unused-import.yml` and a test file under `rules/_tests_/`. Add `rules/python` to `sgconfig.yml`. Make stage 7 also run the rule over `scripts/`, `infra/` and `ts/desktop/scripts/`. It adds no dependency. The rule compares names, not scopes, so an unused import passes when a local name in the module equals it. Effort: Medium (estimate).
  - **C.** Add a check that uses the standard `ast` module of Python, as a new xtask stage, for example `xtask/scripts/python-unused-imports.py`. It adds no dependency, because the gate already needs `python3`. It adds a stage and a script that the repository must keep and test with failing fixtures. Effort: Medium (estimate).
  - **D.** Add Ruff with rule F401 as a gate stage for `scripts/` and `infra/`. Ruff resolves scopes. Its `ruff check --fix` command can delete an unused import. It adds the first Python package to the toolchain. It needs a pin in `infra/toolchains.json` and in the pin table at `docs/protocol/repository-layout.md:60-72`, and an install step in `.github/workflows/ci.yml`. Effort: Large.
- **Left out:**
  - Pyflakes or Flake8 in place of Ruff. It is option D with another tool, and Ruff includes the same rule F401.
  - A Git hook that runs a lint before each commit. It runs only where a developer installs it, and options B, C and D run in every gate run.
- **Wider fix:** B. It is a detection fix, because no structural fix exists for unused imports. C and D detect the same class with other tools.
- **Previous examples:**
  - Commit `e5848ec7` on the closed branch `calummoore/reland-smoke-refusal-recordings` split one test module into two files and left six unused imports.
  - Five of them are at `scripts/_tests_/publication_smoke_cli_tests.py:5`, `:14` and `:15`: `shutil`, `_prepare_isolated_checkout`, `cli_smoke`, `require_dependencies` and `smoke`.
  - The sixth is `json` at `scripts/_tests_/publication_smoke_fixture_tests.py:3`.
  - The unused `smoke` import loaded every smoke module, and `scripts/publication_smoke_desktop.py:9` reads a fixture file when it loads.
  - Commit `7587f54c` on the same branch removed all six.
  - On `main`, `infra/tests/test_catalogue_capture.py:4` imports `json` and `infra/tests/test_runtime_settings.py:3` imports `Path`. Neither module reads the name.
- **Related:** `plans/follow-ups/infra-tests-import-unused-names.md`, shared class. Its option B, Ruff rule F401, is option D here. Its direct fix deletes the two dead imports on `main`, which each lint option here would report.
- **Recommendation:** B. It finds all eight dead imports of the three cases, and it adds no dependency to the gate.
- **Action:** ask the user, because condition 3 holds: option B adds a lint to the gate, which the always-on rules reserve for the user.

Facts for the work:

- On 2026-10-30, a scan with the `ast` module of Python listed six imports on `main` that no code in the module reads. That scan, the trial rule and its timing are history.
- The trial ast-grep rule below listed the same six imports.
- Two of the six are the dead imports at `infra/tests/test_catalogue_capture.py:4` and `infra/tests/test_runtime_settings.py:3`.
- Three are `import support` lines at `infra/tests/test_catalogue_capture_receiver.py:18`, `infra/tests/test_preview_seed_exchange.py:9` and `infra/tests/test_preview_seed_transport.py:8`.
- These three lines run `infra/tests/support.py`, which adds `infra/scripts` to `sys.path` when it loads.
- One is a re-export: `infra/scripts/preview-seed.py:13` imports `HttpResponse`, and `infra/tests/preview_seed_support.py:74` reads it as `seed.HttpResponse`.
- PR #81 later deleted `infra/scripts/preview-seed.py`, `infra/tests/test_preview_seed_exchange.py`, `infra/tests/test_preview_seed_transport.py` and `infra/tests/preview_seed_support.py`. So at commit `f568853e` only one of the four intended imports remains, the `import support` line of `test_catalogue_capture_receiver.py`.
- Ruff rule F401 also reports an intended import, unless a `noqa` comment or a re-export form marks it.
- The trial rule scanned the whole repository in 0.17 seconds.
- The trial rule listed all six unused imports at commit `e5848ec7`, and none at commit `7587f54c`.
- ast-grep skips a report when `# ast-grep-ignore: no-unused-import` is on the same line or on the line before.
- In ast-grep 0.45.3, `field: name` on `import_from_statement` matches only the first imported name, so the trial rule does not use it.
- The trial rule reports a name that an import binds when no other identifier in the module has the same text. It ignores identifiers in imports, attribute names and keyword argument names.

```yaml
id: no-unused-import
language: python
severity: error
message: Remove this import, because the module never reads it.
rule:
  all:
    - kind: identifier
    - pattern: $NAME
    - any:
        - all:
            - nthChild: 1
            - inside:
                kind: dotted_name
                inside:
                  kind: import_statement
        - inside:
            kind: aliased_import
            field: alias
        - all:
            - inside:
                kind: dotted_name
                inside:
                  kind: import_from_statement
            - not:
                inside:
                  kind: dotted_name
                  inside:
                    kind: import_from_statement
                    field: module_name
    - not:
        inside:
          stopBy: end
          kind: module
          has:
            stopBy: end
            all:
              - kind: identifier
              - pattern: $NAME
              - not:
                  inside:
                    kind: attribute
                    field: attribute
              - not:
                  inside:
                    kind: keyword_argument
                    field: name
              - not:
                  inside:
                    stopBy: end
                    any:
                      - kind: import_statement
                      - kind: import_from_statement
```
