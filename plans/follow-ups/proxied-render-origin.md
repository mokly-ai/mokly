# Live prop edits fail behind a proxy

- **Severity:** Medium. **Likelihood:** Common. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-04, from the branch `calummoore/mokly-serve-domain-hosting`, item 2 of the investigation of Serve behind a Conductor preview URL.
- **Location:** `crates/mokly-server/src/security.rs:23-34`, `crates/mokly-server/src/application.rs:126-133`, `docs/protocol/mokly-component-controls.md:175-178`, and `docs/guides/cli/serve.md:74-78`.
- **Reason:** Every fix changes the exact-`Origin` requirement of `docs/protocol/mokly-component-controls.md`, and no recorded user decision covers that change.

- **Source:** Design.
- **Category:** Product bug.
- **Terms:**
  - **Render route:** `POST /mokly-viewer/components/render`, the Serve route that the prop controls of a component page call for each edit.
  - **Host check:** the Serve rule in `crates/mokly-server/src/security.rs:6-21` that refuses every request unless `Host` is `localhost:{port}` or `127.0.0.1:{port}`.
  - **`Sec-Fetch-Site`:** a browser header for HTTPS and localhost URLs that scripts cannot forge, with the value `same-origin` when the caller has the URL's origin.
  - **DNS rebinding:** an attack in which a web page points its own domain at `127.0.0.1` to read and drive a local server.
- **Background:**
  - The render route runs consumer render code. Serve accepts a render POST only when three checks pass.
  - The first check is the Host check. The second check is an `X-Mokly-Render-Token` header equal to the token of the server process.
  - The third check is an `Origin` header equal to `http://` plus the `Host` header, with no scheme substitution.
  - The shell reads the token from the live descriptor, `/mokly-viewer/live.json`. Serve sends no CORS header, so another site cannot read the descriptor or send the custom header.
  - A Conductor workspace preview URL, such as `https://internal-tools-w234.conductor.show`, forwards to a port in the cloud VM. Its proxy sends `Host: localhost:{port}`, so the Host check passes.
  - The browser sends `Origin: https://internal-tools-w234.conductor.show` with the render POST.
  - A local run reproduced the failure. A stand-in proxy rewrote `Host` to `localhost:4310`, and the browser page sent `Origin: http://preview.test:8080` with a valid token. Serve answered `403 {"code":"forbidden","message":"Reload the catalogue to continue editing."}`.
  - Behind a proxy that rewrites `Host`, each client that passes the proxy's sign-in can read the token and send `Origin: http://localhost:{port}`. That request passes today. So the sign-in decides who can edit, and the `Origin` check stops only browsers on other origins.
  - Every option assumes that the proxy passes `Origin`, `Sec-Fetch-Site`, and `X-Mokly-Render-Token` unchanged. Nobody has checked this for Conductor.
- **Problem:** Behind a proxy, `Origin` never equals `http://` plus the rewritten `Host`. Serve refuses every prop edit with 403 and the message "Reload the catalogue to continue editing."
- **Impact if no action:** Browsing works through a Conductor preview when the shell sends same-origin cookies, but every prop edit fails. The reload message does not help.
- **Root question:** How does Serve know that an edit comes from the catalogue page when a proxy changes the address?
- **Options:**
  - **A.** Change nothing. Prop edits work only at a `localhost` address. Effort: Small.
  - **B.** Let `Sec-Fetch-Site` decide when the browser sends it: accept `same-origin` and refuse other values. Use the exact `Origin` rule only when the header is absent. Keep the token and the Host check. Go's `CrossOriginProtection` works the same way. This works behind an HTTPS proxy without setup. A plain-HTTP proxy on another host name still fails, because browsers send the header only to HTTPS and localhost URLs. Effort: Small.
  - **C.** Remove the `Origin` check. The token, its custom header, and the missing CORS headers still block other sites. This removes one layer of defense. Effort: Small.
  - **D.** Accept the `https://` origin of each host that option B of `plans/follow-ups/serve-public-host-names.md` names. Edits through Conductor then need a flag, but browsing does not. Effort: Medium.
  - **E.** Add a repeatable `--trusted-origin {origin}` Serve option. Serve also accepts an `Origin` equal to one entry, as `AddTrustedOrigin` of Go's `CrossOriginProtection` does. It covers plain-HTTP proxies and proxies that drop `Sec-Fetch-Site`. Each user must find and set the option. Effort: Medium.
  - **F.** Rebuild the expected origin from `X-Forwarded-Proto` and `X-Forwarded-Host` when both are present. It covers a plain-HTTP proxy that sends both headers, with no setting. Serve must parse values from chains of proxies. The rule in `docs/protocol/mokly-component-controls.md:172-173` that forwarded headers grant nothing needs an exception. Effort: Medium.
- **Left out:** A same-site cookie that Serve sets as proof of the page. It adds cookie state to Serve and needs the proxy to pass Serve's cookies, and E covers the same plain-HTTP case without state.
- **Wider fix:** B. It needs no knowledge of the public address, so it still works when that address changes. D, E, and F must each learn the address.
- **Previous examples:** None found.
- **Related:** `plans/follow-ups/serve-public-host-names.md` has the same cause class: both rules assume that the browser reaches Serve directly. Option D here reuses its option B. Edits behind a proxy that keeps its own host name also need option B, D, E, or F here.
- **Recommendation:** B. It needs no setup behind an HTTPS proxy and keeps every current check against other sites and against DNS rebinding. Only an edit through a Conductor preview URL can confirm that Conductor forwards `Sec-Fetch-Site`. If it does not, E or C is the fallback.
- **Action:** ask the user, because the fix changes the exact-`Origin` rule in `docs/protocol/mokly-component-controls.md`, and no recorded decision covers that change.

The options of this item were checked on 2026-11-04. The check added E and F, the conditions of B, and the facts about who can edit behind a proxy.
