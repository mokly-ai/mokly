---
title: "Build"
description: "Generate the catalogue and keep it beside your source."
section: "start"
order: 4
---

## Generate the catalogue

```shell
npx mokly build
```

Build validates your entries, renders every screen and writes the result
under `<mockupsDir>/.generated/`: one document per viewport and color scheme, plus
`mokly-manifest.json`. Writes are transactional, so a failed build leaves the
previous output in place.

## Ignore the output, or commit it

Choose with Git, not a config option. To keep generated output local, add
`/docs/mockups/.generated/` and `/.mokly-cache/` to `.gitignore`; Check
validates sources but ignores local generated files. To commit output, track
every file under `.generated/` and commit them after Build. Check then
compares the entire tree, reporting missing, stale or extra files. Partial
tracking is an error **to Check only**; Build succeeds when you add a new
entry, then Check lists its new route under `untracked:` until staged. Baseline
comparisons independently read complete Git output or rebuild that historical
commit without inspecting head tracking.

Use `npx mokly build --watch` to update the tree after every successful
compilation while editing. Plain `serve` and `export` do not write it; use
`serve --build` if browsing should also update generated files.

## Validate without writing

```shell
npx mokly check
```

Check calculates the same bytes without writing them. Untracked output need
not exist or match; tracked output must match exactly. Check alone rejects
indexed cache paths; writers never check the index.

## Next

Open the catalogue in your browser.
