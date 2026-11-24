# Base prepare command

Status: Active. On branch `calummoore/mokly-base-prepare-command-7jlm`, no pull request yet. The pull request that completes the work deletes this plan, as the `plans` skill says. The decisions below wait for Cal. No product code changes before Cal approves this plan.

A comparison renders two sides. The head is the working tree. The base is the
merge base of `HEAD` and `review.base`. Mokly builds the base from the base
commit's Git files in its own copy, and it runs no build there. A catalogue
that imports a workspace package whose `package.json` exports only built files,
such as `dist`, cannot render its base, because Git does not hold the built
files. Mokly then publishes without Changes. This repository met the problem
on 2026-11-24: the cloud mockup catalogue imports `@mokly/ui` and
`@mokly/viewer` by name, every base render fails with
`Could not resolve "@mokly/ui/..."`, and the preview capture rejects the upload.

The change adds a configuration option, `review.basePrepare`. It holds one
command, for example `["npm", "run", "build", "--workspace", "@mokly/ui"]`.
Mokly runs it in a private copy of the base before the base render. The base
render then reads the files that the command made. The option fits any build
step that a source remap cannot cover, such as generated code or built CSS.

User decision, 2026-11-24: Cal chose this option, option E of decision 1 in
the "fix cloud previews" workspace ("E could be worthwhile as well"), as a
separate change. In that workspace Cal chose option D,
`moduleResolution.sourcePackages`, for this repository first. That option
remaps the `dist` files of a named workspace package to its `src` files in
both renders and runs no code. It is planned on the branch
`calummoore/mokly-website-redesign-plan-v2-xnnj`, in its plan
`plans/source-packages.md`. This plan does not duplicate it. The two options
can be set together. A package that `sourcePackages` remaps then resolves from
`src` in both renders, and the prepared `dist` files of that package stay
unused.

The change does not cover these things:

- A prepare step for the head. The head reads the built files that are in the
  working tree. Local and CI users build them before they run Mokly. A cloud
  build runs only checkout, install, and publish, so there only a root
  lifecycle script of the install builds the head. Serve does not rebuild
  them. A stale head build shows as Changes with no error, so the guide says
  this.
- More than one command. A repository that needs several steps names one
  package script.
- A shell. The command is an argument list, as the install commands are.
- This repository's own configuration. `sourcePackages` fixes the preview
  capture here. This change does not set `review.basePrepare` in the root
  `mokly.config.json`.

Contract owners:

- A new protocol page, `docs/protocol/mokly-base-prepare-command.md`. The base
  preparation pages are near the 250-line cap, so the command rules get their
  own page.
- [Configuration](../docs/protocol/mokly-configuration.md),
  [base preparation](../docs/protocol/mokly-base-preparation.md),
  [base dependencies](../docs/protocol/mokly-base-dependencies.md),
  [comparison](../docs/protocol/mokly-comparison.md#html-package-styles),
  [base cache](../docs/protocol/mokly-base-cache.md),
  [eager base preparation](../docs/protocol/mokly-eager-base-preparation.md),
  [terminal steps](../docs/protocol/mokly-terminal-steps.md),
  [timings](../docs/protocol/mokly-timings.md#budgets).
- [Cloud build runner](../docs/protocol/cloud/cloud-build-runner.md),
  [preview capture](../docs/protocol/cloud/preview-capture.md), and
  [mockup comparison base](../docs/protocol/cloud/mockup-baselines.md).
- The [configuration guide](../docs/guides/authoring/config.md) and the
  [publish guide](../docs/guides/cli/publish.md).
- The READMEs of `mokly-compare`, `mokly-cli`, `mokly-catalogue`,
  `mokly-render`, and `packages/mokly`.

## Design

### Facts that the design uses

- The base render reads the base commit's own `mokly.config.json`
  (`crates/mokly-cli/src/changes_base_sources.rs`). Two review fields come
  from the working tree configuration instead, so they also apply to an old
  base: `review.base` (`selected_base` in
  `crates/mokly-compare/src/base_render.rs`) and `review.baseInstallScripts`
  (`apply_base_install_scripts` in `crates/mokly-cli/src/options.rs`).
- Serve and the static commands take per-run flags, such as `--base` and
  `--no-base-install-scripts` (`crates/mokly-cli/src/grammar.rs`). The cloud
  runner passes a fixed argument list.
- Repository packages always resolve from the side's own sources. A resolved
  path inside the repository and outside every `node_modules` maps to the same
  path under the side's source root. A missing mapped file fails with
  `bundle-failed` ([base dependencies](../docs/protocol/mokly-base-dependencies.md#dependency-identity)).
  The map lives in `packages/mokly/src/sidecar/module-paths.ts`. Mokly's own
  base reads list only Git tree entries
  (`crates/mokly-compare/src/sources_extraction.rs`).
- Third-party packages follow three tiers
  ([comparison packages](../docs/protocol/mokly-comparison-packages.md)).
  Tier 1 installs nothing and reads the working tree's `node_modules`. Tier 2
  copies the base sources into a private entry and installs there
  (`Install::build` in `crates/mokly-compare/src/install.rs`). Tier 3 is the
  fallback: Bun, Yarn Plug'n'Play, a missing lockfile, or an unsupported
  manager version.
- Base installs start from an allowed environment that holds no secret
  ([install processes](../docs/protocol/mokly-base-install-processes.md#environment)).
  Base render code, in sidecars and PostCSS children, gets the inherited
  environment minus `MOKLY_` variables and three npm variables
  (`crates/mokly-sidecar/src/process_environment.rs`).
- Base installs share one deadline of 120 seconds, and each install has a
  byte bound of 2 GiB
  ([timings](../docs/protocol/mokly-timings.md#budgets),
  `crates/mokly-cli/src/base_dependencies.rs`).
- Only `node`, `npm`, `pnpm`, and `yarn` resolve through absolute `PATH`
  entries. On Windows, only their known `.cmd` layouts, a `.exe`, or a `.com`
  can start (`crates/mokly-compare/src/programs.rs`).
- The kept-base key of Serve already hashes the whole working
  `config.input` (`crates/mokly-cli/src/serve_base_key.rs`).
- A source edit cancels the eager work and the classification of the state
  that it ends. A cancelled cache build removes its staged data
  (`crates/mokly-compare/src/cache.rs`).
- Plain output, which every `CI` value selects, prints no
  `Changes unavailable` line. It prints only the base detail lines
  (`crates/mokly-cli/src/changes_output.rs`).
- Comparison steps are spinner labels. They have no durable line and no
  duration ([terminal steps](../docs/protocol/mokly-terminal-steps.md)).
- `docs/protocol/cloud/cloud-build-runner.md` has 248 lines and
  `docs/protocol/mokly-timings.md` has 246 lines. The cap is 250.
- Not measured: the time and the size of a cold install and of the package
  builds of this repository, which has about 1,900 lockfile entries. The
  workspace that wrote this plan has no install. Milestone 2 measures both,
  on hardware like the cloud build template, before the limits are fixed.

### Design calls

My calls, 2026-11-24. Each follows a rule in force, or no option has a real
trade-off against it.

- **Shape.** `review.basePrepare` is a non-empty array of non-empty strings.
  The first string names the executable. Mokly resolves it through absolute
  `PATH` entries only, as it resolves package managers. On Windows, the start
  rules of `programs.rs` apply, so the guide recommends a package-manager
  command, such as `npm run {script}`. A launcher that cannot start is a
  failed command. Reason: no shell, and no base file can supply the
  executable.
- **Working directory.** The command runs in the folder of the copy that maps
  to the configuration folder. Reason: every other path in the configuration
  is relative to that folder.
- **When it runs.** It runs only when Changes runs: `build` and `publish`
  without `--no-changes`, and Serve. It runs after the base sources are known
  and before base discovery reads module files. Base discovery lists the Git
  tree, so a catalogue entry file that only the command generates shows as
  added. The guide says this, unless Cal chooses decision 9 E.
- **HTML bases.** A configured command makes Mokly extract the base, also for
  an HTML or CSS base. Reason: built CSS is one of the goals, and the command
  needs the files. With decision 3 D, such a base then reads package
  stylesheets from its private install, not from the working tree. That
  changes the HTML package styles rule of the comparison page, which this
  change updates.
- **Terms.** "Base preparation" already names the whole base pipeline. The
  docs call the new step "the base prepare command", and its page, timing
  record, and spinner step use that name. The field keeps Cal's working name,
  `review.basePrepare`, unless Cal renames it.
- **Status.** Serve publishes `preparing` while the command runs, as it does
  for the install. The spinner gets one step, `running base prepare command`,
  after `installing base dependencies`. A timing record
  `review.base-prepare-command` gives its duration.
- **Kept-base key.** The key already hashes the working `config.input`. The
  one-run override writes into `config.input`, as
  `apply_base_install_scripts` does, so the key covers the command with no new
  field.
- **Interaction with `sourcePackages`.** None in code. Each option keeps its
  own rule. The guide says that a remapped package does not use its prepared
  files.
- **Protocol caps.** The new page holds the command rules. The cloud runner
  and timings pages get one linked sentence or one table row each, so they
  stay under 250 lines.

### Shape of the work

- `mokly-catalogue`: the `basePrepare` field of `ReviewConfig`, its schema in
  `packages/mokly/config.schema.json`, and the authoring type in
  `packages/mokly/src/authoring/config.ts`.
- `mokly-compare`: the command step in the base dependency install, under the
  install process rules. It reuses the process group, deadline, output bound,
  and stop code of the installs. Under decision 9, the base Git index view in
  `sources.rs` and `git_tree.rs` adds the outputs.
- `packages/mokly`: the sidecar and PostCSS source roots under decision 9, in
  `src/sidecar/module-paths.ts` and `src/sidecar/postcss.ts`.
- `mokly-render`: the base side in `src/side.rs` and `src/source_evidence.rs`
  names the prepared entry under decision 9.
- `mokly-cli`: the working-tree value, the one-run override, the step in
  static and Serve base preparation, the Serve job of decision 7, and the
  Changes outcome.

## Decisions

Each decision waits for Cal. Cal asked that the plan settle each of these
questions with him. Two options checks of 2026-11-24 added options and changed
six recommendations. Their reports are in `.context/base-prepare-command/`.

### 1. Who may turn the command on

- **Severity:** High. **Effort:** Small.
- **Source:** Design.
- **Category:** Security.
- **Location:** `crates/mokly-cli/src/options.rs`, `crates/mokly-catalogue/src/config_types.rs`.
- **Background:** The command runs code of the base commit, such as its
  package scripts and its build tools. The base is the merge base, so it is an
  ancestor of `HEAD`. Base installs already trust it as the project's own
  install of that commit. Every run that renders the head already runs head
  code. So a pull request that names the command gets no new ability.
  `review.baseInstallScripts` is the precedent: it comes from the working tree
  configuration, and `--no-base-install-scripts` turns it off for one run.
- **Problem:** The plan must say which configuration names the command, and
  how a run can refuse it.
- **Impact if no action:** The feature cannot start.
- **Root question:** Which commit's configuration supplies the command, and
  how can one run refuse it?
- **Options:**
  - **A.** The working tree configuration names the command. A
    `--no-base-prepare` flag turns it off for one run. An old base gets the
    command, so the first pull request that adds it gets Changes. Risk: the
    head names a command that the old base cannot run. Effort: Small.
  - **B.** The base commit's own configuration names the command, as it names
    most base fields. A pull request cannot change how its base prepares.
    Risk: the first pull request that adds the option gets no Changes, and a
    base before the option never prepares. Effort: Small.
  - **C.** The working tree configuration names the command, and it runs only
    when the run also passes `--base-prepare`. Each CI job must opt in. Risk:
    the cloud runner passes no such flag, so cloud builds never prepare,
    unless decision 8 changes that. Effort: Small.
  - **D.** The base commit's configuration names the command when it has the
    field. Otherwise the working tree value applies. `--no-base-prepare` turns
    it off for one run. A later base uses its own command, which matches its
    own scripts. Risk: a pull request cannot repair a broken command for its
    own base, and the reader must know two sources. Effort: Small.
- **Left out:** A command only from a CLI flag. It fails the goal for the
  cloud runner, whose argument list is fixed. Automatic detection of a build
  script. It replaces the configured command that Cal chose.
- **Wider fix:** None. This is a new feature, not a defect class.
- **Previous examples:** `review.base` and `review.baseInstallScripts`, which
  come from the working tree configuration.
- **Recommendation:** A. It is the simplest rule, it matches the two review
  fields that already come from the working tree, and it fixes the pull
  request that adds the option.
- **Action:** ask the user, because Cal asked to settle who may enable the
  command.

### 2. Which environment the command gets

- **Severity:** High. **Effort:** Small.
- **Source:** Design.
- **Category:** Security.
- **Location:** `crates/mokly-compare/src/manager_environment.rs`,
  `crates/mokly-sidecar/src/process_environment.rs`.
- **Background:** A base install starts from an allowed list of environment
  variables: `PATH`, `HOME`, the proxy and certificate variables, and the
  variables that a process needs to start. It removes every inherited
  `MOKLY_` variable and every token, such as `NPM_TOKEN`. Base render code in
  the sidecars gets the inherited environment minus `MOKLY_` variables and
  three npm variables. The publish guide says that code that runs as the user
  can still read the environment of Mokly and of its launcher. So a filter
  stops accidental leaks, not hostile code.
- **Problem:** A build can need more variables, such as `NODE_OPTIONS` for
  memory, or `NODE_ENV`. More variables can leak a secret to base build tools.
- **Impact if no action:** The feature cannot start.
- **Root question:** Which rule does the command follow: the install allowed
  list, the sidecar rule that base render code already runs under, or a new
  rule?
- **Options:**
  - **A.** The same allowed list as a base install, with nothing more. Risk: a
    build that needs another variable fails. A package script must set it, and
    `cmd.exe` accepts no inline variable without a helper. Effort: Small.
  - **B.** The allowed list, plus the names in a new field such as
    `review.basePrepareEnvironment`. Mokly never passes a `MOKLY_` variable.
    Risk: a configuration can pass a token by name. Effort: Small.
  - **C.** The inherited environment, without `MOKLY_` variables and without
    names that end in `_TOKEN`, `_SECRET`, or `_KEY`. Risk: a secret with
    another name leaks to base code. Effort: Small.
  - **D.** The sidecar rule, without every `npm_` variable and with absolute
    `PATH` entries only. The base build sees the variables of the head build,
    so inlined variables, such as `VITE_*`, give no false Changes. Risk:
    tokens reach base build tools, as they reach base render code today. An
    open set of variables cannot enter the cache key. Effort: Small.
  - **E.** The allowed list plus `NODE_ENV`, `NODE_OPTIONS`, and `CI`. These
    hold no secret, and their values can enter the cache key. Risk: a build
    that reads another variable fails or gives other output. Effort: Small.
- **Left out:** A sandbox, such as a container or a network block. Mokly
  runs on macOS, Linux, and Windows without one, and installs already reach
  the registry.
- **Wider fix:** None. Base install code and base render code already follow
  two rules, and each rule has a recorded reason.
- **Previous examples:** The install environment of
  `docs/protocol/mokly-base-install-processes.md`. The sidecar environment
  of `docs/protocol/mokly-sidecar-modules.md`.
- **Recommendation:** E. It passes no secret, and it covers the two common
  needs on every platform. The first recommendation was A. The options check
  changed it, because A needs a script workaround on Windows.
- **Action:** ask the user, because Cal asked to settle the environment.

### 3. Where the command runs and how it gets dependencies

- **Severity:** High. **Effort:** Large.
- **Source:** Design.
- **Category:** Product bug.
- **Location:** `crates/mokly-compare/src/install.rs`,
  `crates/mokly-compare/src/inputs.rs`.
- **Background:** A build command needs its tools, such as `tsc` or `vite`,
  from `node_modules`. The extraction of the base holds no `node_modules`.
  npm and pnpm link each workspace package from `node_modules` to its folder.
  A link into the working tree's `node_modules` would make the base build read
  the head's workspace packages. The extraction is a shared cache entry that
  other leases read.
- **Problem:** The command must run where it finds its tools and the base's
  own workspace packages. It must not change the shared extraction or the
  working install.
- **Impact if no action:** The feature cannot start. A wrong choice gives a
  base built from head packages, which is wrong output with no error.
- **Root question:** In which folder does the command run, and where do its
  dependencies come from?
- **Options:**
  - **A.** A private staging copy of the base sources, with a fresh locked
    install of the base's dependencies in it. The install runs in every tier.
    The outputs then move to their own cache entry. Risk: a tier-2 base
    installs the same lockfile twice. Effort: Large.
  - **B.** A private staging copy whose `node_modules` holds links to the
    packages of the selected tier, with each workspace link made again to
    point into the copy. No extra install in tier 1. Risk: each manager has
    its own layout, Windows needs junctions, and a build tool can write into
    the working install through a link. Effort: Large.
  - **C.** A bare private staging copy. The command installs what it needs,
    for example a package script that runs `npm ci` and then the build. Risk:
    each repository writes that script, an old base lacks it, and the install
    runs outside the manager rules. Effort: Medium.
  - **D.** With a command, every base takes the tier-2 private install, also
    when the dependency identities are equal. The command runs in that entry
    after the package manager and before the completion receipt. The install
    key adds the command and always the base commit. The base render reads
    third-party packages and the outputs from that entry. Risk: tier 1 loses
    its no-install path, each entry holds a full install within the 2-GiB
    bound, and a tier-3 base cannot prepare. Effort: Large.
  - **E.** A private staging copy whose `node_modules` trees are copies of the
    selected tier's install. It also works in tier 3. Risk: copies of large
    trees, Windows junctions made again, and the working install state in
    place of a clean locked install. Effort: Large.
- **Left out:** The command in the shared extraction. It changes a cache
  entry that other leases read. The command in the working tree. It changes
  the user's checkout and reads head files. A Git worktree of the base. It
  writes into the repository's Git metadata, and D is better on every point.
- **Wider fix:** None. A and D both isolate the base by construction.
- **Related:** Item 6. Its option D needs this option D. Item 7. Its job key
  uses the install key of this option D. Item 9. Its option D needs this
  option D.
- **Previous examples:** The tier-2 install copies the base sources into its
  private entry before it installs.
- **Recommendation:** D. It keeps the isolation of A, installs once for each
  base, and keeps the outputs in the existing dependency cache. The first
  recommendation was A. The options check changed it.
- **Action:** ask the user, because the options trade install time against
  layout risk, and Cal asked where the command runs.

### 4. What the user gets when the command fails

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Docs or spec.
- **Location:** `crates/mokly-cli/src/changes_policy.rs`,
  `crates/mokly-cli/src/changes_output.rs`.
- **Background:** A base that fails validation, bundling, or rendering makes
  Changes unavailable. The build still succeeds. Rich output prints
  `Changes unavailable · base validation failed`. Plain output, which CI and
  the cloud runner use, prints only the detail lines that name the base
  commit. The preview capture rejects a publication without Changes. A base
  that does not import a built package can render without the outputs.
- **Problem:** A command can exit with an error, pass its time limit, or fail
  to start. No rule says what the user gets.
- **Impact if no action:** The feature cannot start.
- **Root question:** When the command fails, does the base still render
  without the outputs, and which reason and details does the user see?
- **Options:**
  - **A.** Changes is unavailable with the reason `base prepare failed`. The
    detail lines give the command, the exit status or the time limit, and the
    last 20 lines of its output. The build succeeds. Effort: Small.
  - **B.** A `base-prepare` warning, and the base renders without the
    outputs. When the render fails too, the user sees two causes. Effort:
    Small.
  - **C.** The command fails with an error and writes no catalogue. Risk: one
    bad base commit blocks every build of the branch. Effort: Small.
  - **E.** The base renders without the outputs. When it renders, Changes is
    ready with a `base-prepare` warning that names the command. The warning
    never fails `--strict`, as `base-dependencies` never does. When the render
    fails, Changes is unavailable with the reason `base prepare failed`, and
    the detail lines give the command, the exit status or the time limit, the
    output tail, and then the base diagnostics. Risk: two code paths. Effort:
    Medium.
  - **F.** Changes is unavailable with the existing reason
    `base validation failed`, with the detail lines of A. Risk: the rich
    reason line does not name the cause. Effort: Small.
- **Left out:** None.
- **Wider fix:** None. This is a new outcome.
- **Related:** Item 1. Option E keeps Changes for a pull request whose head
  names a command that its old base cannot run, when the base needs no
  outputs.
- **Previous examples:** The outcome table of
  `docs/protocol/mokly-base-preparation.md`, section Shared Render Runtime.
  The `base-dependencies` warning, which never fails strict mode.
- **Recommendation:** E. It warns and continues when the output stays
  correct, because a missing repository file fails closed. It still names one
  cause when the base fails. The first recommendation was A. The options
  check changed it.
- **Action:** ask the user, because it adds a new outcome at the boundary,
  and Cal asked how a failure reports.

### 5. What stops a command that hangs

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** Docs or spec.
- **Location:** `docs/protocol/mokly-timings.md`.
- **Background:** Base installs share a fixed deadline of 120 seconds. A
  build of a large package can take minutes, and a cold install of a large
  repository can take more than 120 seconds. The cloud attempt deadline and
  the 15-minute preview capture deadline also bound the whole publish.
- **Problem:** The command needs a bound, so that a hung build does not hold
  the base forever. The plan must also say which bound the install before the
  command gets.
- **Impact if no action:** The feature cannot start.
- **Root question:** What stops a prepare that hangs, without stopping a slow
  build that still makes progress?
- **Options:**
  - **A.** A fixed limit of 600 seconds for the install and the command
    together. The 120-second install deadline does not apply to a base with a
    command. Risk: a slower build never gets Changes. Effort: Small.
  - **B.** A field, such as `review.basePrepareTimeoutSeconds`, with a
    default of 600 seconds, for the install and the command together. The
    120-second install deadline does not apply to a base with a command.
    Risk: one more field. Effort: Small.
  - **C.** The existing 120-second dependency deadline, shared. Risk: a
    typical build with its install does not finish. Effort: Small.
  - **D.** No Mokly limit. The caller's deadline, such as the CI job, bounds
    the run. Risk: a hung build holds Serve's base forever. Effort: Small.
  - **E.** The command fails after 300 seconds without output, with a total
    cap of 1,800 seconds. Risk: a tool that prints nothing until it ends, such
    as `tsc`, can pass the idle limit. Effort: Small.
  - **F.** The install keeps the 120-second deadline, and the command gets its
    own limit, as in A or B. Risk: a cold install of a large repository can
    take more than 120 seconds, and then every prepare fails. Effort: Small.
- **Left out:** None.
- **Wider fix:** None.
- **Previous examples:** The dependency deadline in
  `docs/protocol/mokly-timings.md`.
- **Recommendation:** B. Build times vary much more than install times, and
  the default covers the common case without a setting. Milestone 2 checks the
  default against the measured times.
- **Action:** ask the user, because the options have real trade-offs, and
  Cal asked about time limits.

### 6. What Mokly keeps after a prepare

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `crates/mokly-compare/src/cache.rs`.
- **Background:** The base cache keeps source, dependency, bundle, and render
  kinds outside the repository, each with a byte bound. The source and
  dependency kinds have 2 GiB each. Serve can keep one prepared base in
  memory. The preview capture job and each cloud build start with an empty
  cache, so a cache helps local runs and Serve restarts only.
- **Problem:** A prepare takes an install and a build. Without a cache, each
  `build` and each Serve start prepares again.
- **Impact if no action:** The feature cannot start.
- **Root question:** What does Mokly keep after a prepare, the outputs alone
  or the prepared copy with its install, and under which key can a later run
  reuse it?
- **Options:**
  - **A.** A new `prepared` kind of the base cache. It keeps the outputs only.
    The key is the base commit, the checkout settings, the command, its
    working directory, the install key, the scripts mode, the passed
    environment values, the Node version, the operating system, and the
    processor. Its bound is 2 GiB. Effort: Medium.
  - **B.** No retained cache. Serve keeps the outputs with its kept base.
    Each `build` and each Serve start prepares again. Effort: Small.
  - **C.** As A, with a key of the base commit and the command only. Risk: a
    new Node version or a new install reuses stale outputs. Effort: Medium.
  - **D.** The prepared entry of decision 3 D is the cache. The dependency
    kind keeps the copy, its install, and the outputs within its 2-GiB bound.
    The key is the install key, the command, its working directory, the base
    commit, and the passed environment values. Risk: each entry holds a full
    install, so the kind keeps about one prepared base of this repository.
    Effort: Medium, inside decision 3 D.
  - **E.** For a new base commit whose dependency identity equals an earlier
    entry, Mokly copies that entry's `node_modules` trees and runs only the
    command. Risk: each manager has its own layout, and Windows junctions must
    be made again. Effort: Large.
- **Left out:** Reuse of the outputs of another base commit. The outputs of
  one commit say nothing safe about another.
- **Wider fix:** None.
- **Related:** Item 3. Option D needs decision 3 D. Keep A if decision 3
  takes A.
- **Previous examples:** The dependency install key in
  `docs/protocol/mokly-base-dependencies.md`.
- **Recommendation:** D. With decision 3 D, the prepared entry already is the
  cache, so D needs no new kind, bound, or receipt code. The first
  recommendation was A. The options check changed it.
- **Action:** ask the user, because a fix depends on the answer to item 3,
  and Cal asked about caching.

### 7. How Serve runs a long prepare while the user edits

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `crates/mokly-cli/src/serve_eager_work.rs`,
  `crates/mokly-server/src/changes_background.rs`.
- **Background:** Serve starts base work early, before the background pass
  ends, when its sidecar pool has three or more slots. A base belongs to the
  head state or to its classification, and a source edit cancels both. A
  cancelled cache build removes its staged data. Serve keeps one prepared
  base.
- **Problem:** A prepare can take minutes. If an edit cancels it, a prepare
  restarts after each edit and may never finish while the user works.
- **Impact if no action:** The feature cannot start. A wrong choice gives no
  Changes in Serve during active editing.
- **Root question:** Which owner runs the prepare in Serve, so that an edit
  does not restart it, and when does Serve try again after a failure?
- **Options:**
  - **A.** Eager preparation runs the prepare after Serve is first ready. Its
    events report at adoption. Serve remembers a failed command for its key,
    and a restart or a configuration change tries again. Risk: an edit
    cancels the prepare. Effort: Medium.
  - **B.** As A, but a failed command is not kept, so each classification
    runs it again. Risk: an edit cancels the prepare, and a broken base build
    runs after each edit. Effort: Medium.
  - **C.** The classification runs the prepare after the background pass,
    never early. Risk: an edit cancels the prepare, and Changes waits for the
    whole prepare. Effort: Small.
  - **D.** Serve runs at most one prepare job for each prepare key: the base
    commit, the command, and the install key. The job starts at the first
    readiness. A replaced head state or a superseded classification stops
    waiting, but it does not cancel the job. A later classification with the
    same key waits for the job, shows `preparing`, and leases its entry. A key
    change or the stop of Serve cancels the job. Serve remembers a failed job
    for its key. Risk: a third owner, and an exception to the eager ownership
    decision. Effort: Medium.
  - **E.** The rule of D applies also to the extraction and the dependency
    install. Risk: it changes the cancellation rule of every base step.
    Effort: Large.
- **Left out:** No prepare in Serve. It fails the goal, because Serve shows
  Changes too.
- **Wider fix:** E. It stops every base step that only the base key selects
  from restarting after an edit.
- **Related:** Item 3. The job key uses the install key of decision 3 D.
- **Previous examples:** The eager ownership decision in
  `docs/protocol/mokly-eager-base-preparation.md`, which rejected work that
  outlives its state. Its reason was work that could publish or hold the
  sources of a superseded state. A prepare job publishes nothing, and its only
  inputs are its key.
- **Recommendation:** D. It keeps the early start and the failure memory of
  A, and it is the only option under which a prepare of several minutes
  finishes while the user edits. The first recommendation was A. The options
  check changed it.
- **Action:** ask the user, because it changes the eager ownership decision,
  and Cal asked about Serve.

### 8. The cloud build runner

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** Docs or spec.
- **Location:** `docs/protocol/cloud/cloud-build-runner.md`.
- **Background:** The cloud runner runs checkout, install, and
  `mokly publish` in a sandbox for each push. It passes no option that changes
  the scripts setting, so the repository's configuration decides. The base
  install environment holds no token. The attempt deadline bounds the whole
  publish.
- **Problem:** The runner must say whether a repository's command runs in a
  cloud build.
- **Impact if no action:** The runner rule stays silent, and the CLI runs the
  command by default.
- **Root question:** Does a cloud build run the repository's base prepare
  command?
- **Options:**
  - **A.** Yes. The runner passes no option, and the repository's
    configuration decides, as it does for scripts. The attempt deadline covers
    the prepare. Effort: Small.
  - **B.** No. The runner passes `--no-base-prepare`. Such a repository gets
    no Changes in cloud builds. Effort: Small.
  - **C.** Only when a cloud repository setting allows it. Risk: a new
    setting, an API field, and a settings screen. Effort: Large.
- **Left out:** A runner step that prepares the base outside the CLI. The
  runner owns no base logic.
- **Wider fix:** None.
- **Related:** Item 1. Option B needs the flag of decision 1 A or D.
- **Previous examples:** The scripts rule in the Comparison section of the
  cloud build runner page.
- **Recommendation:** A. The repository owns its base code, and the runner
  keeps one rule for base code. The runner page and the guide also say that
  only a root lifecycle script builds the head in a cloud build.
- **Action:** ask the user, because it changes a cloud runner rule, and Cal
  asked about the cloud runner.

### 9. Where the base render reads the prepared files

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Docs or spec.
- **Location:** `crates/mokly-render/src/side.rs`,
  `crates/mokly-render/src/source_evidence.rs`,
  `crates/mokly-compare/src/sources.rs`,
  `crates/mokly-compare/src/git_tree.rs`,
  `packages/mokly/src/sidecar/module-paths.ts`,
  `packages/mokly/src/sidecar/postcss.ts`.
- **Background:** Several readers take base files. The sidecar maps each
  repository path to the extraction, and a missing file fails. Mokly's own
  base reads, for HTML, CSS, and resources, list only the Git index and give
  the Git bytes. The comparison proves a resource change with those Git
  bytes. Consumer code, such as a PostCSS plugin, reads relative to its
  working folder, which is the base source root. Mokly already reads a tracked
  file through Git when base code changes it in the extraction.
- **Problem:** The outputs are files that Git does not track. A command can
  also change or delete a tracked file, for example a code generator that
  rewrites a committed file.
- **Impact if no action:** The feature cannot start.
- **Root question:** Which file view do all base readers use after the
  command runs, and which bytes does that view give for a file that the
  command made, changed, or deleted?
- **Options:**
  - **A.** A layer in each reader. A tracked file keeps its Git bytes. A file
    that Git does not track, outside every `node_modules`, reads from the
    prepared entry. The layer goes into the Git index view, the source
    evidence, the sidecar path map, and the PostCSS source path. Risk: code
    that reads relative to its working folder never sees the outputs, and
    each new reader needs the layer. Effort: Large.
  - **B.** The prepared copy is the base source root for every reader. A
    tracked file that the command changed renders with its changed bytes.
    Risk: the comparison loses its Git proof for such a file. A tracked file
    under `node_modules` loses its priority over the installed copy in the
    sidecar, so two readers disagree on it. Effort: Medium.
  - **C.** A layer in the sidecar only. Mokly's own base reads stay Git-only.
    Risk: Mokly reads the text of every stylesheet, also CSS that a module
    imports, so built CSS fails. This repository's mockups import
    `@mokly/ui/styles.css`, which points to `dist`. Effort: Medium.
  - **D.** One merged root on disk. After the command, and before the
    completion receipt, Mokly restores each tracked file that the command
    changed or deleted, from the extraction. The prepared entry then becomes
    the base source root for every reader, and sidecars and PostCSS children
    run in it. Mokly's own reads keep the Git bytes of tracked files, and they
    add the untracked files of the entry outside `node_modules`. An output
    that changes after its first lease is unavailable, as a failed conversion
    is. Risk: base code that writes in its working folder writes into a
    dependency cache entry, as it can write into the extraction today.
    Effort: Medium.
  - **E.** As D, and base discovery runs again after the command, so a
    generated catalogue entry exists on both sides. Risk: one more walk of
    the catalogue roots for each prepared base. Effort: Large.
- **Left out:** Prepared workspace packages read as installed dependencies.
  This breaks the rule that repository packages resolve from the side's own
  sources. An overlay file system. macOS and Windows have no portable one. A
  second merged copy of the extraction and the outputs. D gives the same root
  without a second full copy.
- **Wider fix:** D. One root on disk also covers readers that the change does
  not touch, such as a PostCSS plugin or a reader added later.
- **Related:** Item 3. Option D needs decision 3 D. Keep A if decision 3
  takes A, because 3 A moves the outputs out of the copy. Item 4. A warning for
  a changed tracked file follows the outcome of item 4.
- **Previous examples:** The extraction fingerprint rule in
  `docs/protocol/mokly-base-preparation.md`, section Sources.
- **Recommendation:** D. One root serves every base reader, also code that
  reads relative to its working folder, and it keeps the Git bytes of tracked
  files. Choose B if tracked files must keep the command's changes. The first
  recommendation was A. The options check changed it.
- **Action:** ask the user, because the options have real trade-offs, and
  the options check found this hidden choice.

## Milestone 1: Documentation and protocol

Depends on: none

The plan has no mockup work. The change adds no screen. Its user-facing text
is the terminal outcome, the warning, the detail lines, and the spinner step.
This milestone writes the requirements of the decisions that Cal chose.

- [ ] Write `docs/protocol/mokly-base-prepare-command.md`: the field, the
      copy, the dependencies, the environment, the time limit, the outputs,
      the outcome, and Serve.
- [ ] Update the configuration, base preparation, base dependencies,
      comparison, base cache, eager base preparation, terminal steps, and
      timings pages. Link
      the new page. Keep each page under its cap.
- [ ] Update the cloud build runner, preview capture, and mockup comparison
      base pages.
- [ ] Update `docs/guides/authoring/config.md` and
      `docs/guides/cli/publish.md`, including the stale head build and the
      Windows launcher rule.

## Milestone 2: Configuration and the command in static builds

Depends on: 1

- [ ] Measure the time and the size of a cold install and of the package
      builds of this repository, on hardware like the cloud build template.
      Save the result under `.context/base-prepare-command/`.
- [ ] Add `basePrepare` to `ReviewConfig`, the schema, and the authoring
      type. Read it under decision 1.
- [ ] Add the one-run CLI override under decision 1. Write it into
      `config.input`.
- [ ] Run the command under decisions 2, 3, and 5, with the spinner step and
      the timing record.
- [ ] Keep the outputs under decision 6.
- [ ] Read the outputs in the base render under decision 9.
- [ ] Add the outcome under decision 4.
- [ ] Add tests: a fixture repository whose catalogue imports a workspace
      package that exports only `dist`. Check Changes with and without the
      command, a failed command, the time limit, and the environment.
- [ ] Update the READMEs of `mokly-compare`, `mokly-cli`, `mokly-catalogue`,
      `mokly-render`, and `packages/mokly`.

## Milestone 3: Serve

Depends on: 2

- [ ] Run the command in Serve under decision 7, with the `preparing`
      status.
- [ ] Add tests for reuse, an edit while the command runs, a failed command,
      and a configuration change.

## Milestone 4: Cloud runner and the reproduction

Depends on: 2

- [ ] Apply decision 8 to the cloud runner, if it needs a code change.
- [ ] Run the reproduction of the task in a scratch commit that is not
      pushed: a base commit of `main` before `6d4f4f6cf`, with the command
      set. Save the output under `.context/base-prepare-command/`.

## Milestone 5: Verification, commit, review, and pull request

Depends on: every other milestone

- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record
      follow-up items under `plans/follow-ups/` for the rest, re-review
      once, and report.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request. Its description gives the decisions and the
      design calls of this plan with their dates, a permalink to this plan,
      and the follow-up items that the change adds.
