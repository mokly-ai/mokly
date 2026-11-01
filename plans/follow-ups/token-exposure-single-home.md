# Keep one home for the token exposure limit

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-11-01, from the branch
  `conductor/rust-rebuild-177-token-redaction`, follow-up decision 4 of
  2026-10-28.
- **Location:** `docs/protocol/mokly-upload.md:107`,
  `docs/protocol/mokly-sidecar-modules.md:22`, and
  `docs/guides/ci/project-tokens.md:29-32` and `:48-53`. On the base-install
  branch at commit `ce6e0960`:
  `docs/protocol/mokly-base-install-processes.md:35-37` and
  `docs/guides/cli/publish.md:43-52`.
- **Reason:** The base-install branch is not on `main` yet, so the branch that
  merges second does the work.

- **Terms:**
  - **Token exposure section:** the section `## Token Exposure` of
    `docs/protocol/mokly-upload.md`, the protocol home of the rules that keep
    the publish token out of output and child processes.
  - **Same-user limit:** the rule that Mokly cannot stop code that runs as the
    same user from reading the environment of Mokly and of its parents.
  - **Base-install branch:** the branch
    `conductor/rust-rebuild-150-base-install-scripts-and-managers`. It changes
    how Mokly runs package managers and lifecycle scripts for the comparison
    base.
  - **Coordinator:** the agent that answered the decisions of the token
    redaction work for the user.
- **Background:**
  - `mokly publish` reads the publish token from `MOKLY_TOKEN` or from
    `--token`.
  - The token exposure section states that package managers, lifecycle
    scripts, sidecars, and PostCSS children receive no inherited `MOKLY_`
    variable.
  - It states the same-user limit in these words: "Mokly cannot stop code that
    runs as the same user from reading the environment of Mokly, or of the
    shell and launcher that started it. Such code can read it through
    `/proc/{pid}/environ`, `ps -E`, or the Windows process environment block."
  - It advises `MOKLY_TOKEN` over `--token`, because `/proc/{pid}/cmdline`
    shows the command line to every user.
  - On 2026-10-28 the coordinator chose this rule for two parallel branches:
    the token redaction branch, `conductor/rust-rebuild-177-token-redaction`,
    and the base-install branch. The branch that merges second leaves the
    token exposure section as the only home of the same-user limit. It also
    leaves one copy of the user advice in the guides.
  - The coordinator rejected two other options: the base-install branch links
    to the token redaction branch, or it copies the same words. Neither branch
    could link to a page that was not on `main` yet.
  - The token redaction branch adds the token exposure section and this item.
    On 2026-11-01 the base-install branch was not on `main`.
  - At commit `ce6e0960` of 2026-11-01, the base-install branch moves the
    allowed list of the base install environment. The list moves from
    `docs/protocol/mokly-base-dependencies.md` to the section `## Environment`
    of `docs/protocol/mokly-base-install-processes.md`.
  - That section repeats the same-user limit at lines 35-37: "Mokly cannot
    stop code that runs as the same user from reading the environment of
    Mokly, or of the shell and launcher that started it, through
    `/proc/{pid}/environ`, `ps -E`, or the Windows process block."
  - The page's own decision follows at lines 37-39: "Decision: the scripts
    mode does not depend on a token. Rejected: scripts off when a token is
    present, because every publish needs a token and would lose the opt-in."
  - The base-install branch also adds the section `## Keep the token safe` to
    `docs/guides/cli/publish.md`, at lines 43-52. It says to set `MOKLY_TOKEN`,
    not `--token`, because other users of the machine can read a command line.
    It states the same-user limit for lifecycle scripts. It also advises
    `--no-base-install-scripts` for every command that runs with a token.
  - `docs/guides/ci/project-tokens.md` gives the same advice. Lines 29-32 say
    to prefer `MOKLY_TOKEN` to `--token`, because the operating system shows a
    command line to every user of the machine. Lines 48-53 state the
    same-user limit.
  - Two protocol links point at the old home of the allowed list,
    `./mokly-base-dependencies.md#installation-and-bundle-settings`. One is
    the link "base install environment" at `docs/protocol/mokly-upload.md:107`.
    The other is the link "base installs" at
    `docs/protocol/mokly-sidecar-modules.md:22`.
  - Before the base-install branch merges,
    `docs/protocol/mokly-base-dependencies.md:154` says that no base
    configuration "can read an inherited secret such as `MOKLY_TOKEN`". The
    coordinator's rule says "does not receive" instead, because code that runs
    as the same user can still read the environment. At `ce6e0960` the
    base-install branch removes that sentence.
- **Task:**
  1. In the section `## Environment` of
     `docs/protocol/mokly-base-install-processes.md`, replace the same-user
     limit sentence with a link to `./mokly-upload.md#token-exposure`. Keep
     that page's own decision about the scripts mode.
  2. Change the two links at `docs/protocol/mokly-upload.md:107` and
     `docs/protocol/mokly-sidecar-modules.md:22`, so that they point at
     `./mokly-base-install-processes.md#environment`.
  3. Keep one copy of the user advice in the guides. In the other guide,
     replace the repeated sentences with a link to that copy. A guide link
     uses the form `/docs/{section}/{slug}/`, with an optional `#{anchor}`,
     for example `/docs/cli/publish/#keep-the-token-safe`.
  4. Delete this follow-up item in the same branch.
- **Impact if no action:** The same-user limit keeps two protocol homes, and
  the user advice keeps two copies in the guides. A later change can update
  one copy and leave the other stale. The two links send readers to a section
  that no longer holds the allowed list.
- **Needs:** The base-install branch on `main`, or in the same merge. The task
  needs no deployed change and no credentials.
- **Done when:**
  - The token exposure section is the only protocol text of the same-user
    limit.
  - The two links point at `mokly-base-install-processes.md#environment`.
  - One guide holds the user advice, and the other guide links to it.
  - `docs/protocol/mokly-base-dependencies.md` no longer says that a base
    configuration "can read" an inherited secret.
  - `npm run format:check`, `npm test -- tests/markdown_links.test.ts`, and
    the guide tests `tests/guides_*.test.ts` pass.
  - This item is deleted.

The full historical record is in the
[token redaction plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/80e25c1a0c9d64d0ce57b2d4cf34f2517c0f2e30/plans/token-redaction-fixes.md?plain=1#L127-L145).
