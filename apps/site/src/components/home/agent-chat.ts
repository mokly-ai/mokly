/**
 * The Claude chat docked in the home's Edit window: the session's log, top
 * to bottom, and the diff of Claude's edit of the mockup source.
 * `AgentChat.astro` draws them. The log opens with the session's earlier
 * turn; the Edit demo plays the entries that name a `step`: the prompt with
 * the PriceCard chip, Claude's edit with its diff, and its answer. The
 * session is a depiction.
 */

/** A message's text: plain runs and code spans, in reading order. */
export type ChatText = readonly (string | { readonly code: string })[];

/** The turn of the Edit demo that shows an entry, in playing order. */
export type ChatStep = "done" | "edit" | "prompt";

/** One entry of the log. */
export type ChatEntry =
  /** A line of the session's own, such as the file it edits. */
  | { readonly kind: "note"; readonly text: string }
  /** A message of the person in the session; it leads with the chip of
   *  the element that they picked, the PriceCard. */
  | {
      readonly kind: "prompt";
      readonly step?: ChatStep;
      readonly text: string;
    }
  /** One of Claude's answers; `diff` closes it with the diff hunk. */
  | {
      readonly diff?: boolean;
      readonly kind: "reply";
      readonly step?: ChatStep;
      readonly text: ChatText;
    };

/** The session's log, top to bottom. */
export const CHAT_LOG: readonly ChatEntry[] = [
  { kind: "note", text: "src/mockups/pricing.mockup.tsx" },
  { kind: "prompt", text: "Make Regular the featured plan" },
  {
    kind: "reply",
    text: [
      "Done. Regular now passes ",
      { code: "featured" },
      ", so it shows the Most popular badge.",
    ],
  },
  { kind: "note", text: "Published to feat/checkout-v2" },
  {
    kind: "prompt",
    step: "prompt",
    text: "Make the PriceCard padding 24 and use the Primary button",
  },
  {
    diff: true,
    kind: "reply",
    step: "edit",
    text: ["Editing ", { code: "pricing.mockup.tsx" }],
  },
  {
    kind: "reply",
    step: "done",
    text: ["Done. The PriceCard now has padding 24 and the Primary button."],
  },
];

/** One line of the diff hunk: added, removed or unchanged. */
export interface DiffLine {
  readonly kind: "add" | "del" | "same";
  readonly text: string;
}

/** The file that Claude edits, which heads the diff hunk. */
export const DIFF_FILE = "pricing.mockup.tsx";

/** The lines of the diff hunk, as the hunk prints them. */
export const DIFF_LINES: readonly DiffLine[] = [
  { kind: "same", text: '    plan="regular"' },
  { kind: "del", text: "-   padding={16}" },
  { kind: "add", text: "+   padding={24}" },
  { kind: "same", text: "    featured" },
  { kind: "same", text: "  >" },
  { kind: "del", text: '-   <Button tone="secondary" … />' },
  { kind: "add", text: '+   <Button tone="primary" … />' },
];

/** How many lines of the hunk are of `kind`, for the hunk's head. */
export function diffCount(kind: DiffLine["kind"]): number {
  return DIFF_LINES.filter((line) => line.kind === kind).length;
}
