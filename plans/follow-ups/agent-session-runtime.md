# Where an agent session runs

- **Severity:** Medium. **Effort:** Large. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Needs decision.
- **Added:** 2026-11-24, from `calummoore/rust-realtime-postgres-libraries-5fi6`, the brainstorm on live features.
- **Location:** `crates/mkc-api`, `docs/product-direction.md`
- **Reason:** Agent sessions are the "Edit" phase of the product, and no plan for them exists yet.

- **Terms:**
  - **Agent loop:** the code that calls the model, runs the tools, and saves each step of an agent turn.
  - **Session sandbox:** the sandbox in which a live branch session runs `mokly serve`. It builds on the one-shot E2B sandbox of cloud builds.
- **Background:**
  - `docs/product-direction.md` names "Edit" as the third phase. A live branch session runs `mokly serve` in a sandbox. An agent chat beside the viewer edits the mockup source, and the session can publish back to the branch.
  - Today the build worker in `mkc-api` claims each cloud build with a fenced lease in Postgres. It drives the E2B sandbox from outside, and the sandbox holds only a build-scoped token. `docs/protocol/cloud/cloud-build-lifecycle.md` defines the claims, the fences and the lease renewal.
  - An agent turn can take minutes, and users chat with the agent while it works.
  - On 2026-11-24 Cal chose to keep live features in Rust, Postgres and Kubernetes, with Postgres as the record of every durable feature. Cloudflare Durable Objects and Rivet Actors were left out of the live channel for that reason.
- **Problem:** An API rollout or a lost pod must not lose an agent turn or run it twice. No contract says which process owns a running session.
- **Impact if no action:** Agent sessions cannot start.
- **Root question:** Which process owns a running agent session?
- **Options:**
  - **A.** A durable job in `mkc-api`, like the build worker. It claims the session with a lease, saves each step to Postgres, and resumes on another replica after a failure. It reaches the sandbox only through tools, so the model key never enters the sandbox. Effort: Large.
  - **B.** The agent loop runs inside the session sandbox. The code is the simplest. The model key and the loop then share a sandbox with the customer's code. Effort: Large.
  - **C.** One actor for each session, with Rivet Actors in Rust. It gives one owner with timers, but it adds a control plane that stores data outside Postgres. Effort: Large.
- **Left out:** A Cloudflare Durable Object, because Cal chose Rust, Postgres and Kubernetes on 2026-11-24.
- **Wider fix:** A, because the lease and resume code already exists for builds.
- **Previous examples:** The build claims and fences in `docs/protocol/cloud/cloud-build-lifecycle.md`.
- **Related:** Mokly Cloud is gaining a live WebSocket for each open project in `mkc-api`, with a Postgres `LISTEN`/`NOTIFY` relay between replicas, chosen by Cal on 2026-11-24. How readers see stored changes on it is still open: notices without content followed by REST reads, agent text on the socket, or long polling. This item does not wait for that answer, but the agent loop must send what it chooses.
- **Recommendation:** A. It reuses the build worker's leases and keeps secrets out of the sandbox.
- **Action:** Ask the user, because it decides the runtime of a new product phase.
