# Site Pricing

This is the pricing-page sub-contract of [Site](./site.md).
[Billing](./billing.md) owns every plan fact: the plans, the seat kinds and the
roles that hold them, the prices, the currency, tax and the trial.
[Billing plan gates](./billing-plan-gates.md) owns what each plan allows. The
page states those facts in reader words and states no plan fact of its own.
[Site design](./site-design.md) owns its look.

Decision 3 publishes `/pricing` before the cloud launch, with plan actions that
open the app's `/sign-up`. A page that waits for the cloud launch was rejected,
because the cloud features ship before go-live and the app's billing pane links
`/pricing` when it cannot show a verified price.

## Structure

Top to bottom, the page holds the hero, the plans, the comparison and the
questions. It has no floating panel and no seats section.

**Hero**: the kicker `Pricing`, the heading `Free for open source.` with the
second line `Team for private projects.`, and the lead `The Mokly CLI is free
and MIT licensed. Mokly Cloud is free for public projects. Team adds private
projects to the same workspace, billed monthly for the people who use it.`

**Plans**: two groups on the canvas. **Mokly CLI**, marked `@mokly/mokly`,
holds the Open source plan. **Mokly Cloud**, marked
`Every workspace is on a plan`, holds the Free and Team plans. Each plan
shows, in this order, its name and audience, its price, its one action and
what it holds:

- **Open source**, for building catalogues locally: `$0` under the MIT
  license. **Docs →** opens the documentation landing. It holds local authoring
  and builds, screens in Git and a static catalogue that you host anywhere.
- **Free**, for open-source catalogues: `$0`, and every project is public.
  **Create an account** opens `/sign-up`. It holds unlimited projects and
  seats, cloud publishing and builds for public projects, and an owner's
  upgrade to Team in Settings.
- **Team**, for teams with private catalogues: the monthly price of each seat
  kind from the [plan catalogue](./billing.md#plan-catalogue), with the roles
  that hold that seat, in US dollars before tax. The filled **Start a 7-day
  trial →** opens `/sign-up`. Team holds private projects in the same
  workspace, new projects that start private, cloud publishing and builds for
  private projects, and one trial for each workspace.

**Comparison**: the heading `Compare the plans.` and a table with one column
for each plan, under its product line, and one row for each property. The rows
form four groups: Open source, Mokly Cloud, People and Billing. Each value
states a fact of [Billing](./billing.md), of
[Billing plan gates](./billing-plan-gates.md) or of the MIT-licensed Mokly CLI.
A check reads to assistive technology as "Included", and a dash as "Not
included". The table keeps its row and column semantics at every width.

**Questions**: the heading `Questions, resolved.`, then **Read Plans and
billing →**, which opens the Plans and billing docs page at
`/docs/cloud/plans-and-billing/`, and eight resolved threads: Trial, Billing,
Seats, Price, Ending, Downgrade, Retention and Open source. Each thread holds
one question and Mokly's answer. Each answer about Mokly Cloud states only what
[Billing](./billing.md) and [Billing plan gates](./billing-plan-gates.md)
state. The Open source answer states only facts about the MIT-licensed Mokly
CLI.

The people who ask the questions and the cursor on the plans belong to the
depicted design file, under the source rule of [Site](./site.md#boundary).
