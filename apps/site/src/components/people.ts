/**
 * The people and agents who work in the depicted design file: Maya (pink),
 * Sam (blue), and the agents Claude (orange) and Codex (violet). Each keeps
 * its colour on every page. `Avatar.astro` and `Presence.astro` draw them;
 * both are depictions, hidden from assistive technology.
 */

/** One person or agent in the depicted design file. */
export type Person = "claude" | "codex" | "maya" | "sam";

/** How a person shows on the canvas. */
export interface PersonFacts {
  /** An agent's avatar draws a spark instead of an initial. */
  readonly agent: boolean;
  /** The name on a cursor; an avatar shows its first letter. */
  readonly name: string;
}

/** Everyone in the file, in the order the presence group draws them. */
export const PEOPLE: readonly Person[] = ["maya", "sam", "claude", "codex"];

/** The facts of each person and agent, by person. */
export const PERSON: Readonly<Record<Person, PersonFacts>> = {
  claude: { agent: true, name: "Claude" },
  codex: { agent: true, name: "Codex" },
  maya: { agent: false, name: "Maya" },
  sam: { agent: false, name: "Sam" },
};
