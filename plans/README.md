# Plans

Implementation plans live here. Each plan is scoped to one coherent change and
stays aligned with the README and protocol docs. Each plan records its status
in the first paragraph below its title. This index lists the plan files that
remain in this branch. Work that waits until after a merge is a follow-up item
under [follow-ups](./follow-ups/).

## Active Plans

- [Loading states match their content](./loading-states-match-content.md) —
  draw each wait of the app in the layout that it waits for, and show each
  write's wait on its own control.
- [Serve base attempts prepare their PostCSS context](./serve-base-postcss-preparation.md) —
  start the PostCSS child of a Serve base graph preparation with a `bundle`
  request directly after the base `hello`, as a Serve head startup does.

## Completed Plans

- [Privacy retention alignment](./privacy-retention-alignment.md) — keep
  successful publications until project or workspace deletion, schedule
  operational and GitHub cleanup, state exact retention in the Privacy Policy
  and route workspace deletion through contact.

The old `mokly-ai/mokly-cloud` repository archived its earlier plans in
[PR #83](https://github.com/mokly-ai/mokly-cloud/pull/83). Its
[archived index](https://github.com/mokly-ai/mokly-cloud/blob/31e810bd0d9ea113f88968b109eda60074845078/plans/README.md)
links to those plans and records their earlier status.
