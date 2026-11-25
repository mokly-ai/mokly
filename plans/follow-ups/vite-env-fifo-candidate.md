# A FIFO env file reads as absent

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-25, from round 2 of the implementation review of the
  branch `calummoore/storybook-track-d-finish-nkpi`: a new problem that the
  finding check of finding 136 found.
- **Location:** `packages/mokly/src/sidecar/vite-setup-input.ts:45`,
  `packages/mokly/src/sidecar/vite-working-env.ts:169`, and
  `node_modules/vite/dist/node/chunks/node.js:6179`.
- **Reason:** No input rule says whether an env file can be a FIFO, and the
  options trade Vite's FIFO support against a failure.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Vite adapter:** The optional compile path that compiles JavaScript and
    transforms stylesheets through the project's own Vite setup.
  - **FIFO:** A named pipe. A read returns the bytes that a writer sends, and
    it waits while no writer has the pipe open.
  - **Setup key:** The identity of a Vite setup. Its env inputs move every
    render key.
- **Background:**
  - Vite 8.3.8 reads an env candidate that is a regular file or a FIFO, at
    `node_modules/vite/dist/node/chunks/node.js:6179`. Tools that supply
    secrets can give an env file as a FIFO.
  - `docs/protocol/mokly-vite-adapter-inputs.md:14` makes the env files that
    Vite reads setup inputs, present or absent. Each setup uses one snapshot
    of the bytes or absence of each dotenv candidate, at line 36. The page
    does not name FIFOs.
  - The read hook passes a read of a candidate that is not a regular file
    through, without a byte snapshot, at
    `packages/mokly/src/sidecar/vite-working-env.ts:169`.
  - `setupCandidate` records an existing path that is not a regular file as
    absent, at `packages/mokly/src/sidecar/vite-setup-input.ts:45`. Its
    comment gives the reason: a directory with a candidate's name stays
    watchable without being hashed.
  - Before the branch that found this item, the setup failed on a FIFO
    candidate, because the digest read of the candidate failed for it.
- **Problem:** For a FIFO env candidate, Vite reads its values and they reach
  the render, but the setup records the candidate as absent. So a change of
  those values moves no setup key and no render key.
- **Impact if no action:** A render can reuse output that holds old env
  values, with no error.
- **Root question:** Does the Vite adapter support an env file that is a
  FIFO, and if it does, how does the setup key follow its values?
- **Options:**
  - **A.** Fail the setup on an env candidate that exists and is neither a
    regular file nor a directory. The diagnostic names the candidate and the
    `envDir` setting, with no absolute path. The setup failed in this case
    before the branch that found this item, but with no clear message.
    Effort: Small.
  - **B.** Answer such a candidate as absent in the read hook too. Vite then
    skips it, and the record and the render agree. Cost: the values that
    `vite dev` reads from the FIFO are missing from every view. Effort:
    Small.
  - **C.** Support FIFO env files. Read a FIFO candidate once in the read
    hook, keep its bytes as the snapshot, and record their digest, as for a
    regular file. Do not read it again in the later checks, because a second
    read takes other bytes or waits. State the rule on the inputs page.
    Cost: a FIFO gives no file events, so Serve sees new values only after
    the next setup reload. A read waits while no writer has the pipe open, as
    in Vite. Effort: Medium.
- **Left out:** Change nothing. It fails the goal, because the setup key and
  the render disagree.
- **Wider fix:** None as a separate option. Each option must classify a
  candidate once and give the read hook and the record the same result.
  Today they classify it apart, at `vite-working-env.ts:169` and
  `vite-setup-input.ts:45`. One shared classification prevents the class for
  each special file kind.
- **Previous examples:** `plans/follow-ups/evidence-metadata-fifo-open.md`
  and `plans/follow-ups/module-source-read-fifo-wait.md` record FIFO waits on
  other read paths.
- **Recommendation:** A. A FIFO env file is rare, and a clear failure keeps
  the output right at Small effort. Choose C if the user wants Vite's FIFO
  support.
- **Action:** ask the user, because no input rule says whether an env file
  can be a FIFO, and the options trade Vite's FIFO support against a
  failure.
