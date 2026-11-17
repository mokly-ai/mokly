# One junk forwarded hop drops the client IP

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from Milestone F8 of the deleted `plans/mokly-cloud-follow-ups.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `crates/mkc-config/src/proxy.rs:20-48` and `docs/protocol/rest-proxies.md:7-16`.
- **Reason:** The accepted fix contradicts the requirement that `docs/protocol/rest-proxies.md` states today, and no decision covers the change.
- **Checked:** 2026-10-31, at commit `f568853e`. The decision is still open. Any parse failure in the header still makes `client_ip` return the peer address, as `rest-proxies.md` requires.
- **Category:** Product bug.

- **Terms:**
  - **`client_ip`:** The rule that finds the reader's address from `X-Forwarded-For` behind the trusted proxies, for rate limits.
- **Background:** The review at `e963ba61` on 2026-09-17 found that `client_ip` gives up the whole header at any unparsable hop of `X-Forwarded-For`. The request continues with the peer address. The user accepted the finding without applying it, and the backlog asked to make `client_ip` tolerant of one unparsable hop. `proxy.rs` still returns the peer address on any unparsable entry. `docs/protocol/rest-proxies.md:12-14` now requires that fallback.
- **Problem:** One junk entry in the header makes every request of that reader count against the proxy's peer address.
- **Impact if no action:** A junk hop puts many readers behind one rate-limit counter, so one of them can exhaust it for the others.
- **Root question:** What address does the API use when one forwarded hop does not parse?
- **Options:**
  - **A.** Keep the fallback to the peer, as `rest-proxies.md` requires, and close the accepted finding with that reason. Effort: Small.
  - **B.** Skip one unparsable hop and keep the next trusted address. Change the requirement in `rest-proxies.md`. Before the choice, B must say which positions may be skipped. It must not change the number of trusted proxy steps without saying so. Effort: Small.
- **Left out:** Trust the first entry whatever it is. Clients could then forge their address.
- **Wider fix:** None found.
- **Previous examples:** None found.
- **Recommendation:** B. The user accepted the finding on 2026-09-20, and one junk hop should not merge the rate limits of many readers. The acceptance did not choose a parser design.
- **Action:** ask the user, because condition 1 holds: B changes the requirement in `rest-proxies.md`.

The backlog said to record the decision in the trusted proxy section of `docs/ops/environment.md`. The trusted-proxy rules now live in `docs/protocol/rest-proxies.md`.

Source: [Milestone F8](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-cloud-follow-ups.md?plain=1#L1010-L1051) of the deleted plan.
