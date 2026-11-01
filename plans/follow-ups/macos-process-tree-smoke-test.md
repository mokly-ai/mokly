# Smoke-test escaped process trees on macOS

- **Severity:** Medium. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-11-01, from the branch
  `conductor/rust-rebuild-150-process-tree-stops`: the post-merge task of
  its plan and of the follow-up record of user item 150, which that branch
  resolves.
- **Location:** None. The task runs a base install on a hosted macOS
  runner.
- **Reason:** The plan kept this run for after the merge, and the Linux
  workspace that built the change has no macOS host.

- **Terms:**
  - **Base install:** the private install of the base commit's
    dependencies when the base needs JavaScript rendering and its
    dependency inputs differ from the working tree.
  - **Escaped session:** a process that a package manager or one of its
    scripts starts in a new session. A signal to the manager's process group
    does not reach it. Yarn Classic 1.22.22 starts each dependency lifecycle
    script this way on Linux and macOS.
  - **Stop:** Mokly ends a package manager because of cancellation, the
    time limit, the byte bound, or the bound on its output.
- **Background:**
  - The base needs JavaScript rendering when its catalogue has a JavaScript
    entry module or a stories file, or its configuration names a renderer
    or PostCSS. `crates/mokly-cli/src/changes_base.rs:87` to line 102
    prepares base dependencies only then. An HTML-only catalogue needs no
    install.
  - The dependency inputs are the tracked package manifests and lockfiles.
    With pnpm or Yarn lockfiles, they also hold the manager configuration
    files. When the inputs of both sides are equal, no install runs.
  - Lifecycle scripts run in a base install only when
    `review.baseInstallScripts` or `--base-install-scripts` turns them on.
  - Since commits `41bde015` and `4b245b40`, a stop on Linux and macOS sends
    `SIGSTOP` to the manager's process group. It then follows parent links
    to each descendant, also in a new session, and signals each one.
  - `docs/protocol/mokly-base-install-processes.md#bounds-and-stops` states
    the requirement and two limits. On macOS, a stop does not signal a
    descendant outside the manager's process group whose parent exits
    before the stop reaches that parent. After a normal finish, Mokly
    signals only the manager's process group.
  - On macOS, `crates/mokly-platform/src/unix_process_table/macos.rs` reads
    the process table through libproc: `proc_listchildpids`, and
    `proc_pidinfo` with `PROC_PIDTBSDINFO`. macOS has no subreaper, so an
    orphan moves to launchd.
  - The CI job "Native" in `.github/workflows/ci.yml` runs
    `cargo test --workspace` on the hosted macOS runner
    `blacksmith-6vcpu-macos-26` for each pull request. It runs the
    real-process tests in `crates/mokly-platform/tests/process_tree_tests.rs`
    and `crates/mokly-compare/tests/script_session_tests.rs`. These tests
    use helper processes and a fake Node manager that starts a detached
    child. The test of an orphan that the subreaper adopts runs on Linux
    only.
  - A probe on Linux on 2026-10-28, before the change, showed Yarn Classic
    scripts that survived group signals. A script survived a group
    `SIGKILL`, and a child of a script survived `SIGTERM` and then
    `SIGKILL`.
  - The time limit of a base install is 120 seconds, at
    `crates/mokly-cli/src/base_dependencies.rs:170`.
  - The recipe below meets each condition of a real base install:
    - Each case has its own scratch Git repository and a fresh cache.
    - The base commit and the working tree each hold `mokly.config.json`
      and a `.mockup.ts` entry that imports only `@mokly/mokly`. The render
      sidecar supplies that package, so the working tree needs no
      `node_modules`.
    - The base holds a local `file:dependency` package. Its `postinstall`
      script starts `sleep 1000` with its streams sent to `/dev/null`. It
      writes its own PID and the child PID to a marker file, and it waits
      for the child.
    - Setup makes both lockfiles with
      `yarn install --offline --ignore-scripts`. Mokly runs Yarn Classic
      with `--frozen-lockfile`, so each lockfile must come from a real
      install.
    - The working tree drops the dependency, so the dependency inputs
      differ.
    - Without `--base` and `review.base`, `mokly build` compares with
      `origin/main`, which a scratch repository does not have. So the
      build names `--base HEAD`.
    - The output must stay inside the scratch repository. Otherwise the CLI
      rejects it with `[mokly/export-invalid] Unsafe output directory`.
    - The scripts resolve the scratch root with `pwd -P`. On macOS, `/tmp`
      is a symbolic link to `/private/tmp`.
  - The Linux proof of this recipe on 2026-11-01:
    - It used Yarn Classic 1.22.22, Node 24.21.0, and a build of the change
      that stops every process of a base install's tree. A Python monitor
      ran the same checks as `run-case.sh` below.
    - Before each stop, Yarn and its script each ran in a session of their
      own. The `sleep 1000` child ran in the process group of the script.
      The process list before the cancellation, with shortened commands:

      ```text
          PID    PPID    PGID     SID STAT COMMAND
       498560  498538  498560  498560 Ssl  mokly build --base HEAD ...
       498807  498560  498807  498807 Ssl  node .../bin/yarn install ...
       498824  498807  498824  498824 Ss   sh ./hold.sh
       498825  498824  498824  498824 S    sleep 1000
      ```

    - Cancellation: `SIGINT` reached `mokly` 1.3 seconds after the start.
      `mokly` exited 1 with `[mokly/build-invalid] build cancelled`.
    - Time limit: no signal was sent. `mokly` exited 0 after 121 seconds,
      with this warning on stderr:

      ```text
      [mokly/warning] configuration "mokly.config.json": base dependencies at "yarn.lock" could not be installed (time limit); using working-tree dependencies
      ```

    - After each stop, no process of the tree was left: not `mokly`, the
      sidecar, esbuild, Yarn, the script, or its child.
    - Later that day, the blocks of the task below ran as written on Linux,
      with the `native-linux-x64-gnu` binary. Both cases printed `PASS`.
    - The proof shows that the recipe reaches a live script, and that the
      stop works on Linux. The macOS stop is still unproved.
- **Task:**
  1. After the change that stops every process of a base install's tree
     reaches `main`, start a hosted macOS runner. For example, use a temporary
     workflow job on `blacksmith-6vcpu-macos-26`. The runner needs Git.
  2. Check out `main`. Install a Node version that the `engines` field of
     the root `package.json` allows, such as Node 22.15 or Node 24.21.0.
  3. Run `npm ci` and then `npm run build` in the checkout. `npm ci`
     installs Yarn Classic 1.22.22, which the root `package.json` pins.
  4. Run the steps below in one shell, so that the variables stay set. The
     block links the binary for Apple silicon. Use `native-darwin-x64` on an
     Intel Mac, and `native-linux-x64-gnu` on Linux x64. Yarn must print
     `1.22.22`.

     ```sh
     workspace=$(pwd -P)
     mkdir -p /tmp/mokly-smoke/bin
     smoke_root=$(cd /tmp/mokly-smoke && pwd -P)
     ln -s "$workspace/node_modules/yarn/bin/yarn.js" "$smoke_root/bin/yarn"
     ln -s "$workspace/packages/native-darwin-arm64/bin/mokly" "$smoke_root/bin/mokly"
     node --version
     "$smoke_root/bin/yarn" --version
     "$smoke_root/bin/mokly" --version
     ```

  5. Save this setup script as `prepare.sh`, without the indent of the
     list. Each here-document needs its end word at the start of a line.

     ```sh
     #!/bin/sh
     set -eu
     case_name=$1
     smoke_root=$(cd /tmp/mokly-smoke && pwd -P)
     case_root="$smoke_root/$case_name"
     repository="$case_root/repository"
     mkdir -p "$repository/specs" "$repository/dependency" "$case_root/cache" "$case_root/tmp"
     cat > "$repository/mokly.config.json" <<'CONFIG'
     {"roots":[{"dir":"specs"}]}
     CONFIG
     cat > "$repository/.gitignore" <<'IGNORE'
     node_modules/
     .context/
     IGNORE
     cat > "$repository/.yarnrc" <<'YARNRC'
     disable-self-update-check true
     --install.offline true
     YARNRC
     cat > "$repository/specs/smoke.mockup.ts" <<'ENTRY'
     import { definePage } from "@mokly/mokly";
     export const smoke = definePage({
       title: "Process smoke",
       description: "A local process stop proof.",
       relatedDocs: [],
       render: () => "<!doctype html><html><head><title>Process smoke</title></head><body><h1>Process smoke</h1></body></html>",
     });
     ENTRY
     cat > "$repository/dependency/package.json" <<'DEPENDENCY'
     {"name":"mokly-stop-smoke-dependency","version":"1.0.0","scripts":{"postinstall":"sh ./hold.sh"}}
     DEPENDENCY
     cat > "$repository/dependency/hold.sh" <<SCRIPT
     #!/bin/sh
     sleep 1000 </dev/null >/dev/null 2>&1 &
     smoke_child=\$!
     printf '%s %s\n' "\$\$" "\$smoke_child" > "$case_root/lifecycle.pids"
     wait "\$smoke_child"
     SCRIPT
     cat > "$repository/package.json" <<'BASE'
     {"name":"mokly-stop-smoke","version":"1.0.0","private":true,"packageManager":"yarn@1.22.22","dependencies":{"mokly-stop-smoke-dependency":"file:dependency"}}
     BASE
     TMPDIR="$case_root/tmp" "$smoke_root/bin/yarn" --cwd "$repository" install --offline --ignore-scripts --non-interactive --cache-folder "$case_root/setup-yarn-cache"
     test ! -e "$case_root/lifecycle.pids"
     git -C "$repository" init -q
     git -C "$repository" config user.name "Mokly Smoke"
     git -C "$repository" config user.email "smoke@mokly.invalid"
     git -C "$repository" add .
     git -C "$repository" commit -qm "base with local lifecycle script"
     git -C "$repository" rev-parse HEAD
     cat > "$repository/package.json" <<'HEAD'
     {"name":"mokly-stop-smoke","version":"1.0.0","private":true,"packageManager":"yarn@1.22.22","dependencies":{}}
     HEAD
     TMPDIR="$case_root/tmp" "$smoke_root/bin/yarn" --cwd "$repository" install --offline --ignore-scripts --non-interactive --cache-folder "$case_root/setup-yarn-cache"
     test ! -e "$case_root/lifecycle.pids"
     rm -rf "$repository/node_modules"
     git -C "$repository" diff -- package.json yarn.lock
     ```

  6. Save this script as `run-case.sh`. It starts the build, waits for the
     marker, and lists the process tree before and after the stop. Then it
     checks the exit code, the stderr text, and the survivors. It uses only
     `ps` columns that macOS and Linux both have.

     ```sh
     #!/bin/sh
     set -u
     case_name=$1
     workspace=$2
     smoke_root=$(cd /tmp/mokly-smoke && pwd -P)
     case_root="$smoke_root/$case_name"
     repository="$case_root/repository"
     marker="$case_root/lifecycle.pids"
     alive() { ps -o stat= -p "$1" 2>/dev/null | grep -qv '^Z'; }
     tree_of() {
       ps -axo pid=,ppid= | awk -v root="$1" '{ parent[$1] = $2 }
         END { found[root] = 1; out = root; more = 1
           while (more) { more = 0
             for (pid in parent) if (!(pid in found) && (parent[pid] in found)) {
               found[pid] = 1; out = out "," pid; more = 1 } }
           print out }'
     }
     survivors() { for pid in $(echo "$tree" | tr ',' ' '); do alive "$pid" && echo "$pid"; done; }
     cd "$repository" || exit 1
     PATH="$smoke_root/bin:$PATH" TMPDIR="$case_root/tmp" \
       XDG_CACHE_HOME="$case_root/cache" MOKLY_OUTPUT=plain \
       MOKLY_PACKAGE_ROOT="$workspace/packages/mokly" \
       MOKLY_VIEWER_DIST="$workspace/packages/viewer/dist" \
       MOKLY_NODE_EXECUTABLE="$(command -v node)" \
       "$smoke_root/bin/mokly" build --base HEAD --base-install-scripts \
       --out "$repository/.context/site" \
       >"$case_root/stdout.log" 2>"$case_root/stderr.log" &
     mokly_pid=$!
     waited=0
     until [ -s "$marker" ]; do
       waited=$((waited + 1))
       if [ "$waited" -gt 300 ] || ! alive "$mokly_pid"; then
         echo "FAIL: no lifecycle script started"; kill -KILL "$mokly_pid" 2>/dev/null; exit 1
       fi
       sleep 0.1
     done
     read -r script_pid child_pid <"$marker"
     tree=$(tree_of "$mokly_pid")
     ps -o pid,ppid,pgid,stat,command -p "$tree" | tee "$case_root/before.ps"
     if ! alive "$script_pid" || ! alive "$child_pid"; then
       echo "FAIL: the script or its child is not running"; exit 1
     fi
     if [ "$case_name" = cancellation ]; then
       kill -INT "$mokly_pid"; expected=1; text="build cancelled"
     else
       expected=0; text="could not be installed (time limit)"
     fi
     wait "$mokly_pid"; status=$?
     waited=0
     while [ -n "$(survivors)" ] && [ "$waited" -lt 100 ]; do
       waited=$((waited + 1)); sleep 0.1
     done
     ps -o pid,ppid,pgid,stat,command -p "$tree" | tee "$case_root/after.ps"
     cat "$case_root/stderr.log"; echo "mokly exit: $status"
     left=$(survivors)
     if [ -n "$left" ]; then
       echo "FAIL: survivors $left"; kill -KILL $left 2>/dev/null; exit 1
     fi
     if [ "$status" -ne "$expected" ] || ! grep -qF "$text" "$case_root/stderr.log"; then
       echo "FAIL: unexpected result"; exit 1
     fi
     echo "PASS: $case_name"
     ```

  7. Run both cases. The time-limit case takes about two minutes.

     ```sh
     sh prepare.sh cancellation
     sh prepare.sh time-limit
     sh run-case.sh cancellation "$workspace"
     sh run-case.sh time-limit "$workspace"
     ```

  8. Check that each case prints `PASS`, and read both process lists. An
     exit code alone is not enough.
  9. Save the commands, the process lists, and the logs of each case, for
     example as a workflow artifact. Keep `/tmp/mokly-smoke` until the saved
     evidence is available.
  10. On macOS, Mokly ignores `XDG_CACHE_HOME` and uses the user cache
      directory. Read the `Mokly cache:` line of each `stdout.log`. After the
      evidence is saved, remove those two directories and `/tmp/mokly-smoke`.
      To run again, start at the step that links Yarn and the Mokly binary,
      with no `/tmp/mokly-smoke` folder.
- **Impact if no action:** A macOS-only defect of the stop, for example in
  the libproc reader, stays unseen until a user meets surviving scripts on a
  Mac. Such scripts keep running after Mokly exits.
- **Needs:** The change that stops every process of a base install's tree,
  on `main`. A hosted macOS runner with Git and a supported Node version. No
  credentials.
- **Done when:**
  - Both cases print `PASS` on macOS, and no process of the script or its
    child stays after either stop.
  - The evidence is saved, and this item is deleted.
  - A survivor, if one remains, has its own follow-up item with its process
    list.
