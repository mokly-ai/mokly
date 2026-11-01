# Profile Serve startup and Changes on macOS

- **Severity:** Low. **Effort:** Small. **Confidence:** Low. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-11-01, from an open request of 2026-10-30 in the
  "mokly perf orchistrator" workspace. The timing records never arrived.
- **Location:** None. The task runs `mokly serve` on the maintainer's Mac.
- **Reason:** The task needs the maintainer's Mac, which the cloud
  workspaces cannot reach.

- **Terms:**
  - **Timing records:** the JSON lines with the prefix `[mokly:timing] `
    that `--debug-timings` writes to stderr, one per stage.
  - **Changes ready:** the terminal line that Serve prints when the first
    Changes classification ends.
- **Background:**
  - On 2026-10-29, `npm run dev` at `f93afcea` on an M4 Pro Mac printed
    "Catalogue ready" after 3.9 s and "Changes ready" after 42.9 s.
  - `npm run build` builds an unoptimised debug binary, and `npm run dev`
    runs it. On the cloud VM the debug binary reached Changes ready in about
    90 s, and the release binary in 17 s to 26 s. On 2026-10-30 the user
    chose to keep the debug build.
  - On 2026-10-30 a second Mac run used a new folder with a new cache
    directory. It printed "Catalogue ready" after 2.5 s and reached Changes
    ready after about 26 s. A new cache directory means a first run: Mokly
    first copies the base commit's files into it.
  - The Mac builds the catalogue faster than the VM, so the rest of the
    26 s needs the timing records to explain it.
- **Task:**
  1. In a Mokly checkout on the Mac, run `npm ci` and `npm run build`. Then
     copy a release binary over the debug one:
     `cargo build --release -p mokly-cli` and
     `cp target/release/mokly packages/native-darwin-arm64/bin/mokly`.
  2. Run Serve with timing records, and stop it with Ctrl-C after "Changes
     ready":
     `node packages/mokly/bin/mokly.mjs serve --config examples/basic/mokly.config.json --debug-timings 2>/tmp/mokly-t.log`
  3. Print the main stages:
     `node -e 'const r=require("fs").readFileSync("/tmp/mokly-t.log","utf8").split("\n").filter(l=>l.startsWith("[mokly:timing] ")).map(l=>JSON.parse(l.slice(15)));const k=new Set(["serve.ready","catalogue.validate","graph.prepare","serve.background","changes.classify","review.base-tree","review.base-extraction","review.base-dependencies","review.capture-side","review.compare-views"]);for(const e of r)if(e.event==="end"&&e.role==="core"&&k.has(e.stage))console.log(String(e.elapsedMs-e.durationMs).padStart(7),e.stage.padEnd(26),e.durationMs+" ms",e.tier??"")'`
  4. Run steps 2 and 3 twice: once with a new cache directory, and once
     warm.
  5. Compare each stage with a release run on Linux. Record each stage that
     is much slower on macOS as a new follow-up item, then delete this one.
- **Impact if no action:** A macOS-only cost, if one exists, stays unknown.
  The maintainer runs Mokly on macOS.
- **Needs:** The maintainer's Mac with Rust and Node installed.
- **Done when:** The stage times of both runs are recorded, and each
  macOS-only cost has its own follow-up item.
