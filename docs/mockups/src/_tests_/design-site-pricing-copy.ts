/**
 * The expected copy of the pricing page for `design-site-pricing.test.ts`:
 * the plans, the comparison's groups and Team column, and the resolved
 * threads. The facts come from `docs/protocol/cloud/billing.md` and
 * `docs/protocol/cloud/billing-plan-gates.md`, in the words of the Canvas
 * prototype.
 */

/**
 * Each plan frame in reading order: its name, its prices with the words
 * under them, and its one action with the kind of button and the mockup it
 * opens. The cloud plans start at sign-up; the CLI's Get started opens the
 * docs.
 */
export const plans = [
  {
    action: ["Get started →", "site-button--secondary", "design/site/docs"],
    amounts: ["$0"],
    name: "Open source",
    notes: ["MIT license"],
  },
  {
    action: [
      "Create an account",
      "site-button--secondary",
      "product/account/sign-up",
    ],
    amounts: ["$0"],
    name: "Free",
    notes: ["Every project is public."],
  },
  {
    action: [
      "Start a 7-day trial →",
      "site-button--primary",
      "product/account/sign-up",
    ],
    amounts: ["$20", "$5"],
    name: "Team",
    notes: [
      "per Editor a month. Owners, admins and members",
      "per Collaborator a month. Reviewers",
    ],
  },
];

/** The comparison's groups with their properties, in reading order. */
export const groups = [
  [
    "Open source",
    "Mokly CLI MIT license",
    "Host the static catalogue anywhere",
  ],
  [
    "Mokly Cloud",
    "Public projects",
    "Private projects",
    "New projects start",
    "Publish to a private project",
    "Cloud builds",
  ],
  ["People", "Seats", "Invitations and project grants"],
  ["Billing", "Price", "Trial", "Currency and tax", "Annual price"],
];

/** What Team holds for each property of the comparison, as it is read. */
export const team = [
  "Included",
  "Included",
  "Unlimited",
  "Unlimited",
  "private",
  "Included",
  "Every project",
  "Billed per seat",
  "Not limited",
  "Editor $20 Collaborator $5 a month",
  "7 days, once per workspace",
  "US dollars, before tax",
  "None",
];

/** Each resolved thread: its topic, who asked and the question. */
export const threads = [
  ["Trial", "Maya Design", "How does the trial work?"],
  ["Billing", "Sam Engineering", "Who manages billing?"],
  ["Seats", "Maya Design", "Where do I see what a new seat costs?"],
  ["Price", "Sam Engineering", "Is there an annual price?"],
  ["Ending", "Maya Design", "How do I end Team?"],
  ["Downgrade", "Sam Engineering", "What happens when Team ends?"],
  [
    "Retention",
    "Maya Design",
    "Does the plan change how long publications are kept?",
  ],
  ["Open source", "Sam Engineering", "Do I need Mokly Cloud?"],
];
