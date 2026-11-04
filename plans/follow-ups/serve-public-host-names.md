# Serve refuses proxies that keep their host

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-04, from the branch `calummoore/mokly-serve-domain-hosting`, item 3 of the investigation of Serve behind a Conductor preview URL.
- **Location:** `crates/mokly-server/src/security.rs:6-21`, `crates/mokly-server/src/application.rs:109-115`, `docs/protocol/mokly-component-controls.md:165-173`, and `docs/guides/cli/serve.md:72-78`.
- **Reason:** The options trade reach against a wider attack surface, and no option is clearly best.

- **Source:** Design.
- **Category:** Product bug.
- **Terms:**
  - **Host check:** the Serve rule in `crates/mokly-server/src/security.rs:6-21` that refuses every request unless `Host` is `localhost:{port}` or `127.0.0.1:{port}`.
  - **DNS rebinding:** an attack in which a web page points its own domain at `127.0.0.1` to read and drive a local server.
- **Background:**
  - The Host check answers `403 {"code":"forbidden","message":"Use the local catalogue address."}` for every page and asset when `Host` names another host.
  - The check blocks DNS rebinding. Without it, a web page could read the catalogue and call the render route, which runs consumer render code.
  - Serve binds only `127.0.0.1` and speaks plain HTTP. A browser on the Serve machine can open a rebinding page. In a cloud workspace, an agent's browser on that machine counts.
  - `docs/guides/cli/serve.md:74-78` tells users this rule. Forwarding through another local port works, because the port of `Host` need not equal the listening port.
  - A Conductor workspace preview URL passes the check, because its proxy sends `Host: localhost:{port}`.
  - ngrok and Cloudflare quick tunnels forward their own host name by default. ngrok rewrites it with `--host-header=rewrite`, and cloudflared with `--http-host-header`.
  - Gitpod and CodeSandbox preview URLs keep their own host name. Vite's host check refuses them, for example with `Blocked request. This host ("1nnk56-5173.csb.app") is not allowed.`
  - A local run reproduced the refusal. A stand-in proxy that kept `Host: preview.test:8080` got the 403 for `/`.
- **Problem:** Serve works only behind a proxy that rewrites `Host` to `localhost` or `127.0.0.1`. The refusal does not tell the user how to fix the proxy.
- **Impact if no action:** A user of ngrok or cloudflared sees only a JSON error. A tool that cannot rewrite `Host` cannot show Mokly. Conductor is not affected.
- **Root question:** How does Serve admit a browser behind a forwarding tool that keeps its host name, and still refuse a DNS-rebinding page?
- **Options:**
  - **A.** Change nothing. A proxy must send `Host: localhost:{port}`, as the Conductor proxy does. Effort: Small.
  - **B.** Add a repeatable `--allowed-host {name}` Serve option, as Vite's `server.allowedHosts` does. Serve also accepts each named host. The default stays loopback only. An environment variable can carry the list for dev containers, as `MOKLY_SIDECARS` does for `--sidecars`. The guide must say to name only hosts whose DNS the user trusts. Effort: Medium.
  - **C.** Accept any host, and guard every route with a secret cookie from a printed sign-in URL, as Jupyter does. Each new browser must open the printed URL first. Effort: Large.
  - **D.** Keep the loopback rule, and make the refusal name the fix: open the local address, or forward with the host rewritten to `localhost:{port}`. The Access section of `docs/guides/cli/serve.md` names `--host-header=rewrite` for ngrok and `--http-host-header` for cloudflared. A hosted preview that cannot rewrite the host still fails. Effort: Small.
- **Left out:**
  - Removing the Host check, because any web page could then read the catalogue and run render code.
  - Trusting `X-Forwarded-Host`, because a rebinding page can set that header on its own requests.
  - A built-in list of known tunnel domains, because it must follow each service and misses custom domains. B covers custom domains.
  - A Unix socket listener, because hosted previews such as Gitpod and Conductor forward TCP ports.
  - The peer address of the connection, because a local tunnel agent and a rebinding browser both connect from `127.0.0.1`.
- **Wider fix:** C. It works for any forwarding address, while B must name each address. It is a poor default, because each new browser must first open a sign-in URL.
- **Previous examples:** None found.
- **Related:** `plans/follow-ups/proxied-render-origin.md` has the same cause class: both rules assume that the browser reaches Serve directly. Its option D reuses option B here. Edits behind a proxy that keeps its own host name also need its option B, D, E, or F.
- **Recommendation:** D, changed from A by the options check of 2026-11-04. ngrok and cloudflared keep their own host by default, so a refusal that names the fix helps now, with no new attack surface. B stays the answer for a hosted preview that cannot rewrite the host.
- **Action:** ask the user, because support for such proxies trades reach against a wider attack surface, and no option is clearly best.

The options of this item were checked on 2026-11-04. The check added D, the root question, the tunnel defaults, and the approaches under **Left out**.
