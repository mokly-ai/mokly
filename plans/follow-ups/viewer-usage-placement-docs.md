# Align the documented location of Used by

- **Severity:** Low (estimate). **Effort:** Small (estimate).
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #223 and its completed plan, which put the
  problem outside the scope of its review.
- **Location:** `docs/protocol/mokly-viewer.md:101` to line 103 and line 51,
  `packages/viewer/docs/concepts/README.md:114` to line 116,
  `docs/protocol/mokly-component-explorer.md:97`,
  `docs/protocol/mokly-component-inspector-design.md:24`,
  `docs/protocol/mokly-component-design.md:56`,
  `examples/basic/specs/design/library/inspector/inspector.tsx:54`, and
  `packages/viewer/src/shell/workspace.tsx:282`.
- **Reason:** The viewer pages and the component contracts state two
  different placement requirements, and the user must choose which
  requirement changes.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Used by list:** the `workspace.usedBy` list of an entry detail. It
    names the screens and components that use a component.
  - **Affected list:** the `workspace.affected` list of an entry detail. It
    names the consumers that a changed component affects.
  - **Details and Usage panels:** two inspector panels of the Browse shell.
    In the current shell, Details shows the entry's metadata, and Usage
    shows the Used by and Affected lists.
- **Background:**
  - These sources place the lists in Usage:
    - `docs/protocol/mokly-component-explorer.md:97`: Usage contains the
      Used by screens and components.
    - `docs/protocol/mokly-component-inspector-design.md:24`: Usage
      contains Used by and, when relevant, Affected screens. The same rule
      says never to combine all usage lists with the tree and the props in
      one panel.
    - `docs/protocol/mokly-component-design.md:56`: the inspector
      separates Details, Nested components, Props, and Usage, which holds
      Used by plus Affected screens.
    - The design mockup
      `examples/basic/specs/design/library/inspector/inspector.tsx:54`
      gives the Usage panel its Used by text.
    - The shell passes `WorkspaceUsage` as the Usage panel, at
      `packages/viewer/src/shell/workspace.tsx:282`. `WorkspaceUsage` in
      `packages/viewer/src/shell/workspace_usage.tsx:65` renders the Used by
      section, the Affected section, and the loading, error, and unavailable
      states of usage.
  - `docs/protocol/mokly-viewer.md:51`, in the viewer contract itself,
    already names Usage as a panel that waits for all route details.
  - These sources place the lists in Details:
    - `docs/protocol/mokly-viewer.md:101` to line 103 says that Details
      show the workspace of the entry detail in every delivery. That
      workspace holds Used by, Affected screens, related changed
      components, and input changes.
    - `packages/viewer/docs/concepts/README.md:114` to line 116 says the
      same of the Details panel.
  - The Details panel has its own "Used by" row in
    `packages/viewer/src/shell/details_rows.tsx:145`. That row lists the use
    cases that include the entry, not the Used by list.
  - No recorded user decision chooses the panel. The user's decision of
    2026-10-27 for PR #223 chose that a variant reads `usedBy` from its
    parent's detail. It did not choose where the shell shows the list.
  - The `documentation` skill says that each fact lives in one place, and
    that other docs link to it.
- **Problem:** The viewer contract and the viewer concepts README place the
  Used by and Affected lists in Details. Three component contracts, the
  design mockup, and the shell place them in Usage. Each side states a
  requirement, so a fix must change one of them.
- **Impact if no action:** An embedding host or a contributor reads the
  wrong panel for the list. A test or a host change written from the viewer
  pages can then check the wrong panel.
- **Root question:** Which panel shows the Used by and Affected lists, and
  which page owns that rule?
- **Options:**
  - **A.** Correct `docs/protocol/mokly-viewer.md` and
    `packages/viewer/docs/concepts/README.md`, so that they place the Used by
    and Affected lists in Usage, as the component pages contract does. This
    changes the requirement text of the viewer contract. Effort: Small.
  - **B.** Move the Used by list into the Details panel of the shell, and
    correct the component pages contract. The full scope of this option:
    - The mockups change first, in their own milestone: the inspector
      mockup at `inspector.tsx:54` and each design mockup that shows the
      Usage panel.
    - The shell moves the Used by section out of `WorkspaceUsage` into
      Details. The existing "Used by" row of use cases then needs another
      label, so that two lists do not share one name.
    - The user must choose the panel of the Affected list. It can stay in
      Usage, which then keeps Affected and the usage states. Or it can move
      to Details with Used by, as the viewer pages list it.
    - If Affected moves too, Usage keeps only its loading, error, and
      unavailable states. The user must then choose whether Usage stays or
      goes. Its removal deletes functionality on `origin/main`.
    - The contracts at `mokly-component-explorer.md:97`,
      `mokly-component-inspector-design.md:24`, and
      `mokly-component-design.md:56` change. `mokly-viewer.md:51` changes
      when Usage goes.
    - Effort: Large (estimate), because the shell code and the mockup code
      change in two packages.
  - **C.** Change nothing. Effort: Small.
  - **D.** Keep in the two viewer pages the rule that the lists show in every
    delivery. For the panel of each list, link to the component pages
    contract, and do not repeat the panel names. The viewer pages then hold
    no second copy of the placement fact. The two design pages keep their
    own statement for the mockups. This changes the requirement text of the
    viewer contract. Effort: Small (estimate).
- **Left out:**
  - Showing the lists in both Details and Usage. The inspector contracts
    give each group of content its own panel.
  - A new check that compares panel names across pages. It cannot tell a
    placement fact from other text, and a new check needs the user.
- **Wider fix:** D (estimate). It applies the rule of the `documentation`
  skill that each fact lives in one place. The viewer pages then cannot
  drift from the component contracts again. The rule is already in force,
  so no new rule or check is needed.
- **Previous examples:** None found.
- **Recommendation:** D (estimate). It removes the contradiction, and the
  viewer pages then hold no copy of the panel names that can drift. A is
  the smallest correction, but it keeps the second copy that drifted.
- **Action:** ask the user, because condition 1 holds (estimate): options A,
  B, and D each change a requirement in a protocol doc. No recorded user
  decision chooses the placement, and this branch approves none.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/usage-list-in-parent-detail.md?plain=1#L386).
