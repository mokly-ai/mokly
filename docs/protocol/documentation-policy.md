# Current Documentation Policy

Continuation of [README](./README.md).

## Current Documentation Rule

Former version names, removed field names and implementation plan or milestone
references belong only in `Delivery Status` sections or on a short reviewed
allow list. A status section ends at the next heading of equal or higher level.
Guides have no status notes; keep their delivery notes in the owning protocol.
There is no plans index. Link to the `plans/` directory. Each plan starts with
a `Status: Active` or `Status: Completed` paragraph directly below its title.

The guard scans Markdown in `docs/**`, the root README, module/package/example
READMEs, `xtask/README.md` and authored `notes.md` files. Historical plans,
`docs/reviews/**` and `CHANGELOG.md` stay unchanged. The guard fails closed and
reads complete statements across line breaks, including fenced examples. A
word such as "removed", "older" or "never" is not a general exemption.

Each allow-list entry names an exact file, bounded statement or section, and
reason. It may hold only:

- Removed-input type/warning contracts, exact diagnostics, rejection/privacy
  rules and consumer migration instructions that must name the removed input.
- Version-admission/rejection and release migration contracts that must name
  an earlier format; current independent protocols are not former formats.
- Frozen wire/hash identifiers, versioned compatibility fixtures and explicitly
  dated design snapshots retained as history, never as current behavior.
- The documentation policy and review-workflow instructions that discuss how
  to manage delivery references. Upload Plan operations and SVG path commands
  are domain terms, not implementation references.

No whole-directory exemption or broad keyword allowance is permitted. Match
each reviewed exception exactly and fail when it no longer matches its source.
