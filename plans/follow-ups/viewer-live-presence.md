# Live presence in the viewer

- **Severity:** Low. **Effort:** Large. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-20, from `calummoore/mokly-website-redesign-plan-af84`, decision 9 of the Canvas redesign plan.
- **Location:** None
- **Reason:** Cal left presence out of the Canvas redesign, because it needs a new real-time backend, and asked for this item.

- **Terms:**
  - **Canvas:** the design language of the redesign. The site and the viewer look like a design file with labelled frames, selection boxes and cursors.
  - **Presence:** live signs of who looks at the same project now: avatars and cursors.
  - **Origin router:** the Cloudflare Worker under `apps/worker` that sends each public path to the site or the app.
- **Background:** The Canvas design shows the people in a file. The viewer bar
  holds collaborator avatars. Catalogue rows show who looks at each screen.
  The stage draws live cursors with name tags, for people and for agents. The
  public site draws all of this as a static demo. The app has no presence
  service, no WebSocket, no server-sent events and no Durable Object. No
  protocol doc describes presence.
- **Problem:** The app cannot show who is in a project, so the viewer differs
  from the site's demo.
- **Impact if no action:** The site shows presence that the product does not
  have at go-live.
- **Root question:** How does the viewer learn and show, in real time, who
  else looks at the same project?
- **Options:**
  - **A.** Show avatars only: the members who opened the project in the last
    minutes, from a heartbeat endpoint that the app polls. No cursors.
    Effort: Large.
  - **B.** A real-time channel per project, for example a Durable Object
    behind the origin router. It carries avatars, the screen that each person
    views, and cursor positions in stage coordinates. Effort: Large.
  - **C.** Remove presence from the site demo before go-live, and build
    nothing. Effort: Small.
- **Left out:** Fake avatars in the app, because the app shows only real
  data.
- **Wider fix:** B, because the same channel can later carry comments and
  agent edits live.
- **Previous examples:** None found.
- **Recommendation:** B. Cursors and per-screen avatars need a push channel,
  and the agent sessions will need one too.
- **Action:** ask the user, because it adds a backend and a protocol, and no
  requirement covers them.
